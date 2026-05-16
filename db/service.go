package db

import (
	"database/sql"
	"errors"
	"sync"

	"basalt/localdb"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// DatabaseService manages live sql.DB connections to user-specified databases
// and exposes query and schema operations to the frontend via Wails.
type DatabaseService struct {
	mu          sync.Mutex
	connections map[string]*openConnection
	store       *localdb.Store
	App         *application.App
	// OnConnectionsChanged is called after Connect upserts a new saved connection.
	OnConnectionsChanged func()
}

type openConnection struct {
	db      *sql.DB
	profile Connection
	driver  Driver
}

func NewDatabaseService(store *localdb.Store) *DatabaseService {
	return &DatabaseService{
		connections: make(map[string]*openConnection),
		store:       store,
	}
}

func (d *DatabaseService) connection(connectionID string) (*openConnection, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if conn := d.connections[connectionID]; conn != nil {
		return conn, nil
	}

	return nil, errors.New("connect to a database first")
}
