package supabase

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
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

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		switch resp.StatusCode {
		case http.StatusUnauthorized:
			return fmt.Errorf("session expired — please sign in to Supabase again")
		case http.StatusForbidden:
			return fmt.Errorf("access denied to Supabase resource")
		case http.StatusNotFound:
			return fmt.Errorf("Supabase resource not found")
		default:
			if len(body) > 0 {
				return fmt.Errorf("Supabase API error (HTTP %d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
			}
			return fmt.Errorf("Supabase API error (HTTP %d)", resp.StatusCode)
		}
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

// PoolerConn holds the details needed to build a pooler connection string.
type PoolerConn struct {
	Host   string
	Port   int
	User   string
	DbName string
}

// getPoolerConn returns the best available connection details for a Supabase project.
//
// Strategy (in order):
//  1. Direct host with IPv4 A records → full-featured, no pooler limitations
//  2. Session pooler derived from the pooler API (same host as transaction, port 5432)
//  3. Direct host anyway — lets the DB return the real error (wrong password, etc.)
//     rather than surfacing a misleading "pooler not found" message to the user.
func getPoolerConn(token, ref string) (*PoolerConn, error) {
	directHost := fmt.Sprintf("db.%s.supabase.co", ref)

	// 1. Direct connection when IPv4 A records exist.
	if addrs, err := net.LookupHost(directHost); err == nil {
		for _, addr := range addrs {
			if !strings.Contains(addr, ":") { // no colons → IPv4
				return &PoolerConn{Host: directHost, Port: 5432, User: "postgres", DbName: "postgres"}, nil
			}
		}
	}

	// 2. Session pooler via the Management API. The API only advertises transaction
	//    mode (port 6543), but session mode runs on the same host at port 5432.
	var configs []struct {
		DbHost string `json:"db_host"`
		DbUser string `json:"db_user"`
		DbName string `json:"db_name"`
	}
	if err := apiGet(token, "/projects/"+ref+"/config/database/pooler", &configs); err != nil {
		return nil, err
	}
	for _, cfg := range configs {
		if cfg.DbHost != "" {
			dbName := cfg.DbName
			if dbName == "" {
				dbName = "postgres"
			}
			return &PoolerConn{Host: cfg.DbHost, Port: 5432, User: cfg.DbUser, DbName: dbName}, nil
		}
	}

	// 3. Last resort: return the direct host anyway so the DB connection attempt
	//    produces the real error (e.g. wrong password) instead of a misleading message.
	return &PoolerConn{Host: directHost, Port: 5432, User: "postgres", DbName: "postgres"}, nil
}
