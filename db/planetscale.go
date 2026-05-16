package db

import (
	"fmt"
	"net/url"

	"basalt/config"
	"basalt/planetscale"

	"github.com/pkg/browser"
)

func (d *DatabaseService) PlanetScaleStartAuth() error {
	clientID := loadEnvValue("PLANETSCALE_CLIENT_ID")
	clientSecret := loadEnvValue("PLANETSCALE_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return fmt.Errorf("set PLANETSCALE_CLIENT_ID and PLANETSCALE_CLIENT_SECRET in your .env file")
	}

	token, err := planetscale.Authenticate(clientID, clientSecret, func(u string) {
		_ = browser.OpenURL(u)
	})
	if err != nil {
		return err
	}

	d.mu.Lock()
	d.planetscaleToken = token
	d.mu.Unlock()

	_ = config.SavePlanetScaleToken(token)
	return nil
}

// PlanetScaleIsSignedIn returns true if a valid token is loaded.
func (d *DatabaseService) PlanetScaleIsSignedIn() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.planetscaleToken != ""
}

// PlanetScaleGetUser returns the display name and email of the signed-in user.
func (d *DatabaseService) PlanetScaleGetUser() (planetscale.User, error) {
	d.mu.Lock()
	token := d.planetscaleToken
	d.mu.Unlock()
	if token == "" {
		return planetscale.User{}, fmt.Errorf("not signed in to PlanetScale")
	}
	return planetscale.GetUser(token)
}

// PlanetScaleSignOut clears the stored token from memory and disk.
func (d *DatabaseService) PlanetScaleSignOut() {
	d.mu.Lock()
	d.planetscaleToken = ""
	d.mu.Unlock()
	_ = config.SavePlanetScaleToken("")
}

func (d *DatabaseService) PlanetScaleListDatabases() ([]PlanetScaleDatabase, error) {
	d.mu.Lock()
	token := d.planetscaleToken
	d.mu.Unlock()

	if token == "" {
		return nil, fmt.Errorf("not signed in to PlanetScale")
	}

	orgs, err := planetscale.ListOrganizations(token)
	if err != nil {
		return nil, fmt.Errorf("listing organizations: %w", err)
	}

	var out []PlanetScaleDatabase
	for _, org := range orgs {
		dbs, err := planetscale.ListDatabases(token, org.Name)
		if err != nil {
			return nil, fmt.Errorf("listing databases for org %q: %w", org.Name, err)
		}
		for _, db := range dbs {
			out = append(out, PlanetScaleDatabase{
				Org:    org.Name,
				Name:   db.Name,
				Branch: db.DefaultBranch,
				Kind:   db.Kind,
			})
		}
	}
	return out, nil
}

// PlanetScaleGetConnectionString returns a postgres:// connection string for
// the given database branch. If credentials were previously saved for this
// database they are reused; otherwise new credentials are created and saved.
func (d *DatabaseService) PlanetScaleGetConnectionString(org, database, branch, kind string) (string, error) {
	d.mu.Lock()
	token := d.planetscaleToken

	psKey := org + "/" + database + "/" + branch
	for _, s := range d.saved {
		if s.PlanetScaleKey == psKey {
			d.mu.Unlock()
			return s.ConnectionString, nil
		}
	}
	d.mu.Unlock()

	if token == "" {
		return "", fmt.Errorf("not signed in to PlanetScale")
	}

	pwd, err := planetscale.CreatePassword(token, org, database, branch, kind)
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
	return cs, nil
}

