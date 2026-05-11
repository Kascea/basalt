package main

import (
	"bufio"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type Driver string

const (
	DriverPostgres Driver = "postgres"
	DriverMySQL    Driver = "mysql"
	DriverSQLite   Driver = "sqlite"
)

type ConnectRequest struct {
	Name             string `json:"name"`
	Driver           string `json:"driver"`
	ConnectionString string `json:"connectionString"`
}

type Connection struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Driver   string `json:"driver"`
	User     string `json:"user"`
	Host     string `json:"host"`
	Database string `json:"database"`
	Status   string `json:"status"`
	LastUsed string `json:"lastUsed"`
}

type SchemaObject struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Schema   string `json:"schema"`
	Rows     int    `json:"rows"`
	Modified string `json:"modified"`
}

type QueryResult struct {
	Columns     []string              `json:"columns"`
	Rows        []map[string]string   `json:"rows"`
	RowIDs      []string              `json:"rowIds"`
	DurationMS  int                   `json:"durationMs"`
	Message     string                `json:"message"`
	Plan        []ExecutionPlanStep   `json:"plan"`
	ObjectStats []SchemaObjectSummary `json:"objectStats"`
}

type RowEdit struct {
	Schema  string            `json:"schema"`
	Table   string            `json:"table"`
	RowID   string            `json:"rowId"`
	Changes map[string]string `json:"changes"`
}

type ExecutionPlanStep struct {
	ID        int    `json:"id"`
	Operation string `json:"operation"`
	Object    string `json:"object"`
	Cost      int    `json:"cost"`
	Rows      int    `json:"rows"`
}

type SchemaObjectSummary struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

type Introspector interface {
	ListObjects(ctx context.Context, db *sql.DB) ([]SchemaObject, error)
	ObjectStats(ctx context.Context, db *sql.DB) ([]SchemaObjectSummary, error)
}

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

func (d *DatabaseService) Connect(request ConnectRequest) (Connection, error) {
	driver := Driver(strings.TrimSpace(request.Driver))
	if driver == "" {
		driver = DriverPostgres
	}
	if driver != DriverPostgres {
		return Connection{}, fmt.Errorf("%s connections are planned, but only postgres is wired right now", driver)
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
	for _, connection := range d.connections {
		connections = append(connections, connection.profile)
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

func (d *DatabaseService) ListSchemaObjects(connectionID string) ([]SchemaObject, error) {
	connection, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	return introspectorFor(connection.driver).ListObjects(ctx, connection.db)
}

func (d *DatabaseService) ExecuteQuery(connectionID string, statement string) (QueryResult, error) {
	trimmed := strings.TrimSpace(statement)
	if trimmed == "" {
		return QueryResult{}, errors.New("write a SQL statement before running")
	}

	connection, err := d.connection(connectionID)
	if err != nil {
		return QueryResult{}, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	started := time.Now()
	rows, err := connection.db.QueryContext(ctx, trimmed)
	if err != nil {
		return QueryResult{}, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return QueryResult{}, err
	}

	resultRows := make([]map[string]string, 0)
	for rows.Next() {
		values := make([]any, len(columns))
		valuePointers := make([]any, len(columns))
		for index := range values {
			valuePointers[index] = &values[index]
		}

		if err := rows.Scan(valuePointers...); err != nil {
			return QueryResult{}, err
		}

		row := make(map[string]string, len(columns))
		for index, column := range columns {
			row[column] = formatDBValue(values[index])
		}
		resultRows = append(resultRows, row)
	}
	if err := rows.Err(); err != nil {
		return QueryResult{}, err
	}

	stats, _ := introspectorFor(connection.driver).ObjectStats(ctx, connection.db)

	return QueryResult{
		Columns:     columns,
		Rows:        resultRows,
		DurationMS:  int(time.Since(started).Milliseconds()),
		Message:     fmt.Sprintf("%d rows fetched", len(resultRows)),
		ObjectStats: stats,
	}, nil
}

// FetchTable loads all rows from a table, including ctid for row-level updates.
func (d *DatabaseService) FetchTable(connectionID, schema, table string) (QueryResult, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return QueryResult{}, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	query := fmt.Sprintf(
		"SELECT ctid::text AS __rowid, * FROM %s.%s LIMIT 5000",
		quoteIdent(schema), quoteIdent(table),
	)

	started := time.Now()
	rows, err := conn.db.QueryContext(ctx, query)
	if err != nil {
		return QueryResult{}, err
	}
	defer rows.Close()

	allColumns, err := rows.Columns()
	if err != nil {
		return QueryResult{}, err
	}

	// allColumns[0] is __rowid; the rest are real columns.
	columns := allColumns[1:]
	resultRows := make([]map[string]string, 0)
	rowIDs := make([]string, 0)

	for rows.Next() {
		values := make([]any, len(allColumns))
		ptrs := make([]any, len(allColumns))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return QueryResult{}, err
		}

		rowIDs = append(rowIDs, formatDBValue(values[0]))
		row := make(map[string]string, len(columns))
		for i, col := range columns {
			row[col] = formatDBValue(values[i+1])
		}
		resultRows = append(resultRows, row)
	}
	if err := rows.Err(); err != nil {
		return QueryResult{}, err
	}

	return QueryResult{
		Columns:    columns,
		Rows:       resultRows,
		RowIDs:     rowIDs,
		DurationMS: int(time.Since(started).Milliseconds()),
		Message:    fmt.Sprintf("%d rows fetched from %s.%s", len(resultRows), schema, table),
	}, nil
}

// CommitEdits applies a set of row edits as UPDATE statements inside a transaction.
func (d *DatabaseService) CommitEdits(connectionID string, edits []RowEdit) error {
	conn, err := d.connection(connectionID)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tx, err := conn.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck

	for _, edit := range edits {
		if len(edit.Changes) == 0 {
			continue
		}

		setClauses := make([]string, 0, len(edit.Changes))
		args := make([]any, 0, len(edit.Changes)+1)
		i := 1
		for col, val := range edit.Changes {
			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", quoteIdent(col), i))
			args = append(args, val)
			i++
		}
		args = append(args, edit.RowID)

		query := fmt.Sprintf(
			"UPDATE %s.%s SET %s WHERE ctid = $%d::tid",
			quoteIdent(edit.Schema), quoteIdent(edit.Table),
			strings.Join(setClauses, ", "), i,
		)

		if _, err := tx.ExecContext(ctx, query, args...); err != nil {
			return fmt.Errorf("updating row %s: %w", edit.RowID, err)
		}
	}

	return tx.Commit()
}

// quoteIdent safely double-quotes a SQL identifier to prevent injection.
func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

func (d *DatabaseService) connection(connectionID string) (*openConnection, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if connection := d.connections[connectionID]; connection != nil {
		return connection, nil
	}

	return nil, errors.New("connect to a database first")
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

func formatDBValue(value any) string {
	if value == nil {
		return ""
	}

	switch typed := value.(type) {
	case []byte:
		return string(typed)
	case time.Time:
		return typed.Format(time.RFC3339)
	default:
		return fmt.Sprint(typed)
	}
}

func loadEnvValue(key string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}

	file, err := os.Open(".env")
	if err != nil {
		return ""
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		name, value, ok := strings.Cut(line, "=")
		if !ok || strings.TrimSpace(name) != key {
			continue
		}

		return strings.Trim(strings.TrimSpace(value), `"'`)
	}

	return ""
}

func introspectorFor(driver Driver) Introspector {
	switch driver {
	case DriverPostgres:
		return PostgresIntrospector{}
	default:
		return UnsupportedIntrospector{}
	}
}

func sqlDriverName(driver Driver) string {
	switch driver {
	case DriverPostgres:
		return "pgx"
	default:
		return string(driver)
	}
}

type UnsupportedIntrospector struct{}

func (UnsupportedIntrospector) ListObjects(context.Context, *sql.DB) ([]SchemaObject, error) {
	return []SchemaObject{}, nil
}

func (UnsupportedIntrospector) ObjectStats(context.Context, *sql.DB) ([]SchemaObjectSummary, error) {
	return []SchemaObjectSummary{}, nil
}

type PostgresIntrospector struct{}

func (PostgresIntrospector) ListObjects(ctx context.Context, db *sql.DB) ([]SchemaObject, error) {
	rows, err := db.QueryContext(ctx, `
		select
			n.nspname as schema_name,
			c.relname as object_name,
			case c.relkind
				when 'r' then 'Table'
				when 'v' then 'View'
				when 'm' then 'Materialized View'
				when 'i' then 'Index'
				when 'S' then 'Sequence'
				else 'Object'
			end as object_type,
			coalesce(c.reltuples::bigint, 0) as estimated_rows
		from pg_catalog.pg_class c
		join pg_catalog.pg_namespace n on n.oid = c.relnamespace
		where n.nspname not in ('pg_catalog', 'information_schema')
			and n.nspname not like 'pg_toast%'
			and c.relkind in ('r', 'v', 'm', 'i', 'S')
		order by n.nspname, c.relkind, c.relname
		limit 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	objects := make([]SchemaObject, 0)
	for rows.Next() {
		var object SchemaObject
		if err := rows.Scan(&object.Schema, &object.Name, &object.Type, &object.Rows); err != nil {
			return nil, err
		}
		object.Modified = "Unknown"
		objects = append(objects, object)
	}

	return objects, rows.Err()
}

func (PostgresIntrospector) ObjectStats(ctx context.Context, db *sql.DB) ([]SchemaObjectSummary, error) {
	rows, err := db.QueryContext(ctx, `
		select label, count(*)::int
		from (
			select case c.relkind
				when 'r' then 'Tables'
				when 'v' then 'Views'
				when 'm' then 'Materialized Views'
				when 'i' then 'Indexes'
				when 'S' then 'Sequences'
				else 'Objects'
			end as label
			from pg_catalog.pg_class c
			join pg_catalog.pg_namespace n on n.oid = c.relnamespace
			where n.nspname not in ('pg_catalog', 'information_schema')
				and n.nspname not like 'pg_toast%'
				and c.relkind in ('r', 'v', 'm', 'i', 'S')
		) objects
		group by label
		order by label
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make([]SchemaObjectSummary, 0)
	for rows.Next() {
		var stat SchemaObjectSummary
		if err := rows.Scan(&stat.Label, &stat.Count); err != nil {
			return nil, err
		}
		stats = append(stats, stat)
	}

	return stats, rows.Err()
}
