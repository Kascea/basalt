package main

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func (d *DatabaseService) Connect(request ConnectRequest) (Connection, error) {
	driver := Driver(strings.TrimSpace(request.Driver))
	if driver == "" {
		driver = DriverPostgres
	}
	if driver != DriverPostgres {
		return Connection{}, errors.New(string(driver) + " connections are planned, but only postgres is wired right now")
	}

	connectionString := strings.TrimSpace(request.ConnectionString)
	if connectionString == "" {
		connectionString = loadEnvValue("DATABASE_URL")
	}
	if connectionString == "" {
		return Connection{}, errors.New("enter a connection string or set DATABASE_URL in .env")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := sql.Open(sqlDriverName(driver), connectionString)
	if err != nil {
		return Connection{}, err
	}
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return Connection{}, err
	}

	profile := connectionFromURL(request.Name, driver, connectionString)

	d.mu.Lock()
	if existing := d.connections[profile.ID]; existing != nil {
		existing.db.Close()
	}
	d.connections[profile.ID] = &openConnection{db: db, profile: profile, driver: driver}
	d.mu.Unlock()

	return profile, nil
}

func (d *DatabaseService) ListConnections() []Connection {
	d.mu.Lock()
	defer d.mu.Unlock()

	connections := make([]Connection, 0, len(d.connections)+1)
	for _, conn := range d.connections {
		connections = append(connections, conn.profile)
	}

	if len(connections) == 0 && loadEnvValue("DATABASE_URL") != "" {
		connections = append(connections, Connection{
			ID:       "env-postgres",
			Name:     "DATABASE_URL",
			Driver:   string(DriverPostgres),
			Status:   "Ready",
			LastUsed: "From .env",
		})
	}

	return connections
}

func connectionFromURL(name string, driver Driver, connectionString string) Connection {
	parsed, err := url.Parse(connectionString)
	if err != nil {
		return Connection{
			ID:       "active",
			Name:     fallbackName(name, "Database"),
			Driver:   string(driver),
			Status:   "Connected",
			LastUsed: "Now",
		}
	}

	database := strings.TrimPrefix(parsed.Path, "/")
	return Connection{
		ID:       "active",
		Name:     fallbackName(name, parsed.Hostname()),
		Driver:   string(driver),
		User:     parsed.User.Username(),
		Host:     parsed.Hostname(),
		Database: database,
		Status:   "Connected",
		LastUsed: "Now",
	}
}

func fallbackName(value string, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	if strings.TrimSpace(fallback) != "" {
		return strings.TrimSpace(fallback)
	}
	return "Database"
}
