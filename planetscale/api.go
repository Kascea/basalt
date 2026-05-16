package planetscale

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	ps "github.com/planetscale/planetscale-go/planetscale"
)

const apiBase = "https://api.planetscale.com/v1"

// User is the Wails-facing type for the signed-in PlanetScale account.
type User struct {
	DisplayName string
	Email       string
}

type apiDatabase struct {
	Name          string
	DefaultBranch string
	Kind          string
}

type apiOrganization struct {
	Name string
}

type apiPassword struct {
	Username     string
	PlainText    string
	Hostname     string
	DatabaseName string
}

func newClient(token string) (*ps.Client, error) {
	return ps.NewClient(ps.WithAccessToken(token))
}

func getUser(token string) (User, error) {
	req, err := http.NewRequest("GET", apiBase+"/user", nil)
	if err != nil {
		return User{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return User{}, err
	}
	defer resp.Body.Close()

	var u struct {
		DisplayName string `json:"display_name"`
		Name        string `json:"name"`
		Email       string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return User{}, err
	}
	name := u.DisplayName
	if name == "" {
		name = u.Name
	}
	return User{DisplayName: name, Email: u.Email}, nil
}

func listOrganizations(token string) ([]apiOrganization, error) {
	client, err := newClient(token)
	if err != nil {
		return nil, err
	}
	orgs, err := client.Organizations.List(context.Background())
	if err != nil {
		return nil, err
	}
	out := make([]apiOrganization, len(orgs))
	for i, o := range orgs {
		out[i] = apiOrganization{Name: o.Name}
	}
	return out, nil
}

func listDatabases(token, org string) ([]apiDatabase, error) {
	client, err := newClient(token)
	if err != nil {
		return nil, err
	}
	dbs, err := client.Databases.List(context.Background(), &ps.ListDatabasesRequest{Organization: org})
	if err != nil {
		return nil, err
	}
	out := make([]apiDatabase, len(dbs))
	for i, d := range dbs {
		out[i] = apiDatabase{
			Name:          d.Name,
			DefaultBranch: "main",
			Kind:          string(d.Kind),
		}
	}
	return out, nil
}

func createPassword(token, org, database, branch, kind string) (*apiPassword, error) {
	client, err := newClient(token)
	if err != nil {
		return nil, err
	}
	name := "basalt-" + time.Now().Format("20060102150405")
	ctx := context.Background()

	if kind == "postgresql" {
		role, err := client.PostgresRoles.ResetDefaultRole(ctx, &ps.ResetDefaultRoleRequest{
			Organization: org,
			Database:     database,
			Branch:       branch,
		})
		if err != nil {
			return nil, err
		}
		return &apiPassword{
			Username:     role.Username,
			PlainText:    role.Password,
			Hostname:     role.AccessHostURL,
			DatabaseName: role.DatabaseName,
		}, nil
	}

	// Vitess (MySQL)
	pwd, err := client.Passwords.Create(ctx, &ps.DatabaseBranchPasswordRequest{
		Organization: org,
		Database:     database,
		Branch:       branch,
		Name:         name,
	})
	if err != nil {
		return nil, err
	}
	if pwd.PlainText == "" {
		return nil, fmt.Errorf("PlanetScale did not return a password")
	}
	return &apiPassword{
		Username:  pwd.Username,
		PlainText: pwd.PlainText,
		Hostname:  pwd.Hostname,
	}, nil
}
