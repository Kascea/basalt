package db

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"strings"
	"time"

	"basalt/localdb"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/mattn/go-sqlite3"
)

func (d *DatabaseService) Connect(request ConnectRequest) (Connection, error) {
	driver := Driver(strings.TrimSpace(request.Driver))
	if driver == "" {
		driver = DriverPostgres
	}
	switch driver {
	case DriverPostgres, DriverSQLite:
		// supported
	default:
		return Connection{}, errors.New(string(driver) + " connections are not yet supported")
	}

	connectionString := strings.TrimSpace(request.ConnectionString)
	if connectionString == "" {
		connectionString = localdb.LoadEnvValue("DATABASE_URL")
	}
	if connectionString == "" {
		return Connection{}, errors.New("enter a connection string or set DATABASE_URL in .env")
	}

	if driver == DriverSQLite {
		connectionString = sqliteURI(connectionString)
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

	id := d.upsertSaved(request.Name, driver, connectionString, request.PlanetScaleKey)
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
	found, err := d.store.FindConnection(id)
	if err != nil {
		return Connection{}, errors.New("saved connection not found")
	}
	return d.Connect(ConnectRequest{
		Name:             found.Name,
		Driver:           found.Driver,
		ConnectionString: found.ConnectionString,
	})
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

// ListConnections returns all currently open (live) connections.
func (d *DatabaseService) ListConnections() []Connection {
	d.mu.Lock()
	defer d.mu.Unlock()

	out := make([]Connection, 0, len(d.connections))
	for _, conn := range d.connections {
		c := conn.profile
		c.Connected = true
		out = append(out, c)
	}
	return out
}

// upsertSaved persists a connection by connection string, creating or updating
// as needed. Returns the stable ID.
func (d *DatabaseService) upsertSaved(name string, driver Driver, connectionString, psKey string) string {
	existing, err := d.store.FindConnectionByString(connectionString)
	if err == nil {
		existing.Name = name
		if psKey != "" {
			existing.PlanetScaleKey = psKey
		}
		_ = d.store.UpsertConnection(*existing)
		d.notifyConnectionsChanged()
		return existing.ID
	}

	id := localdb.NewID()
	_ = d.store.UpsertConnection(localdb.SavedConnection{
		ID:               id,
		Name:             name,
		Driver:           string(driver),
		ConnectionString: connectionString,
		PlanetScaleKey:   psKey,
	})
	d.notifyConnectionsChanged()
	return id
}

func (d *DatabaseService) notifyConnectionsChanged() {
	if cb := d.OnConnectionsChanged; cb != nil {
		go cb()
	}
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
