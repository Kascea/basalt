package supabase

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const apiBase = "https://api.supabase.com/v1"

// User is the Wails-facing type for the signed-in Supabase account.
type User struct {
	DisplayName string
	Email       string
}

// Project is the Wails-facing type for a connectable Supabase project.
type Project struct {
	Ref    string
	Name   string
	Region string
	Status string
}

func apiGet(token, path string, dest any) error {
	req, err := http.NewRequest("GET", apiBase+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("unauthorized: token may have expired")
	}
	return json.NewDecoder(resp.Body).Decode(dest)
}

func getUser(token string) (User, error) {
	var profile struct {
		Email    string `json:"email"`
		FullName string `json:"full_name"`
		Username string `json:"username"`
	}
	if err := apiGet(token, "/profile", &profile); err != nil {
		return User{}, err
	}
	name := profile.FullName
	if name == "" {
		name = profile.Username
	}
	if name == "" {
		name = profile.Email
	}
	return User{DisplayName: name, Email: profile.Email}, nil
}

func listProjects(token string) ([]Project, error) {
	var raw []struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		Region string `json:"region"`
		Status string `json:"status"`
	}
	if err := apiGet(token, "/projects", &raw); err != nil {
		return nil, err
	}
	out := make([]Project, len(raw))
	for i, p := range raw {
		out[i] = Project{
			Ref:    p.ID,
			Name:   p.Name,
			Region: p.Region,
			Status: p.Status,
		}
	}
	return out, nil
}

// getSessionPoolerHost fetches the pooler config for the given project ref and
// returns the session-mode pooler hostname (e.g. aws-1-us-west-1.pooler.supabase.com).
func getSessionPoolerHost(token, ref string) (string, error) {
	var configs []struct {
		DbHost   string `json:"db_host"`
		DbPort   int    `json:"db_port"`
		PoolMode string `json:"pool_mode"`
	}
	if err := apiGet(token, "/projects/"+ref+"/config/database/pooler", &configs); err != nil {
		return "", fmt.Errorf("fetching pooler config: %w", err)
	}
	for _, cfg := range configs {
		if strings.EqualFold(cfg.PoolMode, "session") && cfg.DbHost != "" {
			return cfg.DbHost, nil
		}
	}
	// Fall back to any non-empty host if no session entry found.
	for _, cfg := range configs {
		if cfg.DbHost != "" {
			return cfg.DbHost, nil
		}
	}
	return "", fmt.Errorf("pooler host not found in API response")
}
