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

	// Find or create the saved connection entry to get a stable ID.
	id := d.upsertSaved(request.Name, driver, connectionString)

	profile := connectionFromURL(id, request.Name, driver, connectionString)

	d.mu.Lock()
	if existing := d.connections[id]; existing != nil {
		existing.db.Close()
	}
	d.connections[id] = &openConnection{db: db, profile: profile, driver: driver}
	d.mu.Unlock()

	return profile, nil
}

// ConnectSaved reconnects using stored credentials for the given saved connection ID.
func (d *DatabaseService) ConnectSaved(id string) (Connection, error) {
	d.mu.Lock()
	var found *SavedConnection
	for i := range d.saved {
		if d.saved[i].ID == id {
			found = &d.saved[i]
			break
		}
	}
	d.mu.Unlock()

	if found == nil {
		return Connection{}, errors.New("saved connection not found")
	}

	return d.Connect(ConnectRequest{
		Name:             found.Name,
		Driver:           found.Driver,
		ConnectionString: found.ConnectionString,
	})
}

// ListSavedConnections returns all persisted connection profiles.
func (d *DatabaseService) ListSavedConnections() []SavedConnection {
	d.mu.Lock()
	defer d.mu.Unlock()
	out := make([]SavedConnection, len(d.saved))
	copy(out, d.saved)
	return out
}

// DeleteSavedConnection removes a saved connection from disk (does not disconnect if active).
func (d *DatabaseService) DeleteSavedConnection(id string) error {
	d.mu.Lock()

	filtered := d.saved[:0]
	for _, s := range d.saved {
		if s.ID != id {
			filtered = append(filtered, s)
		}
	}
	d.saved = filtered
	err := writeSavedConnections(d.saved)
	cb := d.onConnectionsChanged
	d.mu.Unlock()
	if cb != nil {
		go cb()
	}
	return err
}

// UpdateSavedConnection updates the name and/or connection string of a saved connection.
func (d *DatabaseService) UpdateSavedConnection(conn SavedConnection) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	for i, s := range d.saved {
		if s.ID == conn.ID {
			d.saved[i] = conn
			return writeSavedConnections(d.saved)
		}
	}
	return errors.New("connection not found")
}

// DisconnectConnection closes the live DB connection but keeps the saved entry.
func (d *DatabaseService) DisconnectConnection(id string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if conn := d.connections[id]; conn != nil {
		conn.db.Close()
		delete(d.connections, id)
	}
	return nil
}

func (d *DatabaseService) ListConnections() []Connection {
	d.mu.Lock()
	defer d.mu.Unlock()

	connections := make([]Connection, 0, len(d.connections))
	for _, conn := range d.connections {
		c := conn.profile
		c.Connected = true
		connections = append(connections, c)
	}
	return connections
}

// upsertSaved finds an existing saved connection with the same connection string,
// or creates a new one. Returns the stable ID. Must be called without the lock held.
func (d *DatabaseService) upsertSaved(name string, driver Driver, connectionString string) string {
	d.mu.Lock()

	for i, s := range d.saved {
		if s.ConnectionString == connectionString {
			d.saved[i].Name = name
			_ = writeSavedConnections(d.saved)
			id := s.ID
			cb := d.onConnectionsChanged
			d.mu.Unlock()
			if cb != nil {
				go cb()
			}
			return id
		}
	}

	id := newID()
	d.saved = append(d.saved, SavedConnection{
		ID:               id,
		Name:             name,
		Driver:           string(driver),
		ConnectionString: connectionString,
	})
	_ = writeSavedConnections(d.saved)
	cb := d.onConnectionsChanged
	d.mu.Unlock()
	if cb != nil {
		go cb()
	}
	return id
}

func connectionFromURL(id, name string, driver Driver, connectionString string) Connection {
	parsed, err := url.Parse(connectionString)
	if err != nil {
		return Connection{
			ID:        id,
			Name:      fallbackName(name, "Database"),
			Driver:    string(driver),
			Status:    "Connected",
			LastUsed:  "Now",
			Connected: true,
		}
	}

	database := strings.TrimPrefix(parsed.Path, "/")
	return Connection{
		ID:        id,
		Name:      fallbackName(name, parsed.Hostname()),
		Driver:    string(driver),
		User:      parsed.User.Username(),
		Host:      parsed.Hostname(),
		Database:  database,
		Status:    "Connected",
		LastUsed:  "Now",
		Connected: true,
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
