package planetscale

import (
	"context"
	"fmt"
	"time"

	ps "github.com/planetscale/planetscale-go/planetscale"
)

type Database struct {
	Name          string
	DefaultBranch string
	Kind          string // "mysql" or "postgresql"
}

type Organization struct {
	Name string
}

type Password struct {
	Username     string
	PlainText    string
	Hostname     string
	DatabaseName string // actual PostgreSQL database name (may differ from PlanetScale DB name)
}

func newClient(token string) (*ps.Client, error) {
	return ps.NewClient(ps.WithAccessToken(token))
}

func ListOrganizations(token string) ([]Organization, error) {
	client, err := newClient(token)
	if err != nil {
		return nil, err
	}
	orgs, err := client.Organizations.List(context.Background())
	if err != nil {
		return nil, err
	}
	out := make([]Organization, len(orgs))
	for i, o := range orgs {
		out[i] = Organization{Name: o.Name}
	}
	return out, nil
}

func ListDatabases(token, org string) ([]Database, error) {
	client, err := newClient(token)
	if err != nil {
		return nil, err
	}
	dbs, err := client.Databases.List(context.Background(), &ps.ListDatabasesRequest{Organization: org})
	if err != nil {
		return nil, err
	}
	out := make([]Database, len(dbs))
	for i, d := range dbs {
		out[i] = Database{
			Name:          d.Name,
			DefaultBranch: "main",
			Kind:          string(d.Kind),
		}
	}
	return out, nil
}

func CreatePassword(token, org, database, branch, kind string) (*Password, error) {
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
		return &Password{
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
	return &Password{
		Username:  pwd.Username,
		PlainText: pwd.PlainText,
		Hostname:  pwd.Hostname,
	}, nil
}
