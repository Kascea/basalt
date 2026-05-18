package supabase

import (
	"fmt"
	"net/url"

	"basalt/localdb"

	"github.com/pkg/browser"
)

// Service is the Wails service that exposes Supabase OAuth and project
// discovery to the frontend.
type Service struct {
	store                *localdb.Store
	OnConnectionsChanged func()
}

func NewService(store *localdb.Store) *Service {
	return &Service{store: store}
}

func (s *Service) StartAuth() error {
	clientID := localdb.LoadEnvValue("SUPABASE_CLIENT_ID")
	clientSecret := localdb.LoadEnvValue("SUPABASE_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return fmt.Errorf("set SUPABASE_CLIENT_ID and SUPABASE_CLIENT_SECRET in your .env file")
	}

	tok, err := authenticate(clientID, clientSecret, func(u string) {
		_ = browser.OpenURL(u)
	})
	if err != nil {
		return err
	}

	u, err := getUser(tok.AccessToken)
	if err != nil {
		// Non-fatal: store the token even if profile fetch fails.
		u = User{DisplayName: "Supabase User"}
	}

	return s.store.SetConnectedAccount(localdb.SupabaseProvider, localdb.ConnectedAccount{
		Token:        tok.AccessToken,
		RefreshToken: tok.RefreshToken,
		DisplayName:  u.DisplayName,
		Email:        u.Email,
	})
}

// IsSignedIn returns true if a valid Supabase token is stored.
func (s *Service) IsSignedIn() bool {
	return s.store.GetToken(localdb.SupabaseProvider) != ""
}

// GetUser returns the display name and email of the signed-in Supabase user
// by reading from the local store — no network call.
func (s *Service) GetUser() (User, error) {
	acc, ok := s.store.GetConnectedAccount(localdb.SupabaseProvider)
	if !ok || acc.Token == "" {
		return User{}, fmt.Errorf("not signed in to Supabase")
	}
	return User{DisplayName: acc.DisplayName, Email: acc.Email}, nil
}

// SignOut clears the stored Supabase token and user info.
func (s *Service) SignOut() {
	_ = s.store.SetToken(localdb.SupabaseProvider, "")
}

// ListProjects returns all Supabase projects accessible to the signed-in user.
// It automatically refreshes the access token if the initial request fails.
func (s *Service) ListProjects() ([]Project, error) {
	acc, ok := s.store.GetConnectedAccount(localdb.SupabaseProvider)
	if !ok || acc.Token == "" {
		return nil, fmt.Errorf("not signed in to Supabase")
	}

	projects, err := listProjects(acc.Token)
	if err != nil && acc.RefreshToken != "" {
		clientID := localdb.LoadEnvValue("SUPABASE_CLIENT_ID")
		clientSecret := localdb.LoadEnvValue("SUPABASE_CLIENT_SECRET")
		newTok, refreshErr := refreshAccessToken(clientID, clientSecret, acc.RefreshToken)
		if refreshErr == nil {
			acc.Token = newTok.AccessToken
			acc.RefreshToken = newTok.RefreshToken
			_ = s.store.SetConnectedAccount(localdb.SupabaseProvider, acc)
			projects, err = listProjects(newTok.AccessToken)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("listing projects: %w", err)
	}
	return projects, nil
}

// GetConnectionString builds a connection string for the given Supabase project.
// It does NOT save — the caller must pass the returned string and the project ref
// (as supabaseKey) to db.Connect, which saves only on successful connection.
func (s *Service) GetConnectionString(ref, name, password string) (string, error) {
	acc, ok := s.store.GetConnectedAccount(localdb.SupabaseProvider)
	if !ok || acc.Token == "" {
		return "", fmt.Errorf("not signed in to Supabase")
	}

	conn, err := getPoolerConn(acc.Token, ref)
	if err != nil {
		return "", err
	}
	if conn.User == "" {
		conn.User = fmt.Sprintf("postgres.%s", ref)
	}
	if conn.DbName == "" {
		conn.DbName = "postgres"
	}
	return fmt.Sprintf("postgresql://%s:%s@%s:%d/%s",
		url.QueryEscape(conn.User), url.QueryEscape(password), conn.Host, conn.Port, conn.DbName), nil
}

func (s *Service) notifyConnectionsChanged() {
	if s.OnConnectionsChanged != nil {
		go s.OnConnectionsChanged()
	}
}
