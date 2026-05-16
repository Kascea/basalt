package planetscale

import (
	"fmt"
	"net/url"

	"basalt/localdb"

	"github.com/pkg/browser"
)

// Database is the Wails-facing type for a connectable PlanetScale database branch.
type Database struct {
	Org    string
	Name   string
	Branch string
	Kind   string
}

// Service is the Wails service that exposes PlanetScale OAuth and database
// discovery to the frontend.
type Service struct {
	store                *localdb.Store
	OnConnectionsChanged func()
}

func NewService(store *localdb.Store) *Service {
	return &Service{store: store}
}

func (s *Service) StartAuth() error {
	clientID := localdb.LoadEnvValue("PLANETSCALE_CLIENT_ID")
	clientSecret := localdb.LoadEnvValue("PLANETSCALE_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return fmt.Errorf("set PLANETSCALE_CLIENT_ID and PLANETSCALE_CLIENT_SECRET in your .env file")
	}

	token, err := authenticate(clientID, clientSecret, func(u string) {
		_ = browser.OpenURL(u)
	})
	if err != nil {
		return err
	}

	u, err := getUser(token)
	if err != nil {
		return err
	}

	return s.store.SetConnectedAccount(localdb.PlanetScaleProvider, localdb.ConnectedAccount{
		Token:       token,
		DisplayName: u.DisplayName,
		Email:       u.Email,
	})
}

// IsSignedIn returns true if a valid PlanetScale token is stored.
func (s *Service) IsSignedIn() bool {
	return s.store.GetToken(localdb.PlanetScaleProvider) != ""
}

// GetUser returns the display name and email of the signed-in PlanetScale user
// by reading from the local store — no network call.
func (s *Service) GetUser() (User, error) {
	acc, ok := s.store.GetConnectedAccount(localdb.PlanetScaleProvider)
	if !ok || acc.Token == "" {
		return User{}, fmt.Errorf("not signed in to PlanetScale")
	}
	return User{DisplayName: acc.DisplayName, Email: acc.Email}, nil
}

// SignOut clears the stored PlanetScale token and user info.
func (s *Service) SignOut() {
	_ = s.store.SetToken(localdb.PlanetScaleProvider, "")
}

// ListDatabases returns all PlanetScale database branches accessible to the signed-in user.
func (s *Service) ListDatabases() ([]Database, error) {
	token := s.store.GetToken(localdb.PlanetScaleProvider)
	if token == "" {
		return nil, fmt.Errorf("not signed in to PlanetScale")
	}

	orgs, err := listOrganizations(token)
	if err != nil {
		return nil, fmt.Errorf("listing organizations: %w", err)
	}

	var out []Database
	for _, org := range orgs {
		dbs, err := listDatabases(token, org.Name)
		if err != nil {
			return nil, fmt.Errorf("listing databases for org %q: %w", org.Name, err)
		}
		for _, db := range dbs {
			out = append(out, Database{
				Org:    org.Name,
				Name:   db.Name,
				Branch: db.DefaultBranch,
				Kind:   db.Kind,
			})
		}
	}
	return out, nil
}

// GetConnectionString returns a postgres:// connection string for the given
// database branch. Reuses saved credentials when available; otherwise creates
// new credentials and saves them.
func (s *Service) GetConnectionString(org, database, branch, kind string) (string, error) {
	psKey := org + "/" + database + "/" + branch
	if saved, err := s.store.FindConnectionByPlanetScaleKey(psKey); err == nil {
		return saved.ConnectionString, nil
	}

	token := s.store.GetToken(localdb.PlanetScaleProvider)
	if token == "" {
		return "", fmt.Errorf("not signed in to PlanetScale")
	}

	pwd, err := createPassword(token, org, database, branch, kind)
	if err != nil {
		return "", err
	}

	dbName := pwd.DatabaseName
	if dbName == "" {
		dbName = database
	}
	cs := fmt.Sprintf("postgres://%s:%s@%s/%s?sslmode=require",
		url.QueryEscape(pwd.Username),
		url.QueryEscape(pwd.PlainText),
		pwd.Hostname,
		dbName,
	)

	_ = s.store.UpsertConnection(localdb.SavedConnection{
		ID:               localdb.NewID(),
		Name:             database,
		Driver:           "postgres",
		ConnectionString: cs,
		PlanetScaleKey:   psKey,
	})
	s.notifyConnectionsChanged()

	return cs, nil
}

func (s *Service) notifyConnectionsChanged() {
	if s.OnConnectionsChanged != nil {
		go s.OnConnectionsChanged()
	}
}
