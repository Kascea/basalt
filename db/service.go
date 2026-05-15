package db

import (
	"database/sql"
	"errors"
	"sync"

	"basalt/config"
)

type DatabaseService struct {
	mu                   sync.Mutex
	connections          map[string]*openConnection
	saved                []config.SavedConnection
	settings             config.AppSettings
	OnConnectionsChanged func()
}

type openConnection struct {
	db      *sql.DB
	profile Connection
	driver  Driver
}

func NewDatabaseService() *DatabaseService {
	saved, _ := config.LoadSavedConnections()
	return &DatabaseService{
		connections: make(map[string]*openConnection),
		saved:       saved,
		settings:    config.LoadAppSettings(),
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
