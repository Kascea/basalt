package main

import (
	"database/sql"
	"errors"
	"sync"
)

type DatabaseService struct {
	mu          sync.Mutex
	connections map[string]*openConnection
	saved       []SavedConnection
	settings    AppSettings
}

type openConnection struct {
	db      *sql.DB
	profile Connection
	driver  Driver
}

func NewDatabaseService() *DatabaseService {
	saved, _ := loadSavedConnections()
	return &DatabaseService{
		connections: make(map[string]*openConnection),
		saved:       saved,
		settings:    loadAppSettings(),
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
