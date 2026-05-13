package main

import (
	"errors"
	"sync"
	"database/sql"
)

type DatabaseService struct {
	mu          sync.Mutex
	connections map[string]*openConnection
}

type openConnection struct {
	db      *sql.DB
	profile Connection
	driver  Driver
}

func NewDatabaseService() *DatabaseService {
	return &DatabaseService{
		connections: make(map[string]*openConnection),
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
