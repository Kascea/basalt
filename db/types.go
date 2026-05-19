package db

import (
	"context"
	"database/sql"
)

type Driver string

const (
	DriverPostgres Driver = "postgres"
	DriverMySQL    Driver = "mysql"
	DriverSQLite   Driver = "sqlite"
)

// ── Connection types ──────────────────────────────────────────────────────────

type ConnectRequest struct {
	Name             string `json:"name"`
	Driver           string `json:"driver"`
	ConnectionString string `json:"connectionString"`
	PlanetScaleKey   string `json:"planetscaleKey,omitempty"` // set by PS flow to tag the saved connection
	SupabaseKey      string `json:"supabaseKey,omitempty"`    // set by Supabase flow to tag the saved connection
}

// Connection is a live (or previously live) connection summary shown in the UI.
type Connection struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Driver    string `json:"driver"`
	User      string `json:"user"`
	Host      string `json:"host"`
	Database  string `json:"database"`
	Status    string `json:"status"`
	LastUsed  string `json:"lastUsed"`
	Connected bool   `json:"connected"`
}

// ── Schema types ──────────────────────────────────────────────────────────────

type SchemaObject struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Schema   string `json:"schema"`
	Rows     int    `json:"rows"`
	Modified string `json:"modified"`
}

type SchemaObjectSummary struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

// ── Query types ───────────────────────────────────────────────────────────────

type QueryResult struct {
	Columns     []string              `json:"columns"`
	ColumnTypes []string              `json:"columnTypes"`
	PrimaryKeys []string              `json:"primaryKeys"`
	Rows        []map[string]string   `json:"rows"`
	RowIDs      []string              `json:"rowIds"`
	DurationMS  int                   `json:"durationMs"`
	Message     string                `json:"message"`
	Plan        []ExecutionPlanStep   `json:"plan"`
	ObjectStats []SchemaObjectSummary `json:"objectStats"`
}

type ExecutionPlanStep struct {
	ID        int    `json:"id"`
	Operation string `json:"operation"`
	Object    string `json:"object"`
	Cost      int    `json:"cost"`
	Rows      int    `json:"rows"`
}

// ── Mutation types ────────────────────────────────────────────────────────────

type RowInsert struct {
	Schema string            `json:"schema"`
	Table  string            `json:"table"`
	Values map[string]string `json:"values"`
}

type RowEdit struct {
	Schema  string            `json:"schema"`
	Table   string            `json:"table"`
	RowID   string            `json:"rowId"`
	Changes map[string]string `json:"changes"`
}

type RowDelete struct {
	Schema string `json:"schema"`
	Table  string `json:"table"`
	RowID  string `json:"rowId"`
}

type CommitPayload struct {
	Inserts []RowInsert `json:"inserts"`
	Edits   []RowEdit   `json:"edits"`
	Deletes []RowDelete `json:"deletes"`
}

// FKViolation is returned by CommitTableEdits when a foreign-key constraint is
// violated. The transaction is rolled back; callers should display this rather
// than treating it as an unexpected error.
type FKViolation struct {
	Column          string `json:"column"`
	Value           string `json:"value"`
	ReferencedTable string `json:"referencedTable"`
}

// ── Introspector interface ────────────────────────────────────────────────────

// Introspector is the per-driver adapter for database metadata and row addressing.
// Each driver provides one concrete adapter; the adapter is bound to an openConnection at connect time.
type Introspector interface {
	ListObjects(ctx context.Context, db *sql.DB) ([]SchemaObject, error)
	ObjectStats(ctx context.Context, db *sql.DB) ([]SchemaObjectSummary, error)
	ListColumnTypes(ctx context.Context, db *sql.DB) ([]TypeGroup, error)
	GetTableColumns(ctx context.Context, db *sql.DB, schema, table string) ([]ColumnInfo, error)

	// TableExpr returns a quoted table reference. Postgres uses schema.table; SQLite omits the schema.
	TableExpr(schema, table string) string

	// Placeholder returns the driver-appropriate parameter placeholder for position n.
	// Postgres uses $1, $2, …; SQLite uses ? for every position.
	Placeholder(n int) string

	// RowIDExpr returns a SQL expression that selects a stable physical row identifier.
	// The result is aliased to __rowid by FetchTable and consumed opaquely as a RowID.
	RowIDExpr() string

	// WhereRowID returns a parameterised WHERE predicate matching a row by its RowID.
	// param is the placeholder index (e.g. 2 → "$2::tid" for Postgres).
	WhereRowID(param int) string

	// GetPrimaryKeys returns the primary-key column names for the given table in order.
	GetPrimaryKeys(ctx context.Context, db *sql.DB, schema, table string) ([]string, error)
}

// ── Object operation types ────────────────────────────────────────────────────

type SequenceInfo struct {
	Schema      string `json:"schema"`
	Name        string `json:"name"`
	LastValue   string `json:"lastValue"`
	IncrementBy string `json:"incrementBy"`
	MinValue    string `json:"minValue"`
	MaxValue    string `json:"maxValue"`
	IsCycled    bool   `json:"isCycled"`
}

type IndexInfo struct {
	Schema     string `json:"schema"`
	Name       string `json:"name"`
	TableName  string `json:"tableName"`
	IsUnique   bool   `json:"isUnique"`
	IsPrimary  bool   `json:"isPrimary"`
	Definition string `json:"definition"`
}

type ForeignKeyInfo struct {
	Schema        string `json:"schema"`
	Name          string `json:"name"`
	TableName     string `json:"tableName"`
	ColumnName    string `json:"columnName"`
	ForeignSchema string `json:"foreignSchema"`
	ForeignTable  string `json:"foreignTable"`
	ForeignColumn string `json:"foreignColumn"`
	OnDelete      string `json:"onDelete"`
	OnUpdate      string `json:"onUpdate"`
}

type CreateSequenceRequest struct {
	Schema      string `json:"schema"`
	Name        string `json:"name"`
	IncrementBy int64  `json:"incrementBy"`
	StartValue  int64  `json:"startValue"`
	MinValue    int64  `json:"minValue"`
	MaxValue    int64  `json:"maxValue"`
	IsCycled    bool   `json:"isCycled"`
}

type CreateIndexRequest struct {
	Schema   string `json:"schema"`
	Table    string `json:"table"`
	Name     string `json:"name"`
	Columns  string `json:"columns"`
	IsUnique bool   `json:"isUnique"`
	Method   string `json:"method"`
}

type AddForeignKeyRequest struct {
	Schema        string `json:"schema"`
	Table         string `json:"table"`
	Name          string `json:"name"`
	Column        string `json:"column"`
	ForeignSchema string `json:"foreignSchema"`
	ForeignTable  string `json:"foreignTable"`
	ForeignColumn string `json:"foreignColumn"`
	OnDelete      string `json:"onDelete"`
	OnUpdate      string `json:"onUpdate"`
}

type ColumnDef struct {
	Name     string `json:"name"`
	DataType string `json:"dataType"`
	Nullable bool   `json:"nullable"`
	Default  string `json:"default"`
}

type CreateTableRequest struct {
	Schema  string      `json:"schema"`
	Name    string      `json:"name"`
	Columns []ColumnDef `json:"columns"`
}

// ── Table column metadata ─────────────────────────────────────────────────────

type ColumnInfo struct {
	Name          string  `json:"name"`
	DataType      string  `json:"dataType"`
	IsNullable    bool    `json:"isNullable"`
	ColumnDefault *string `json:"columnDefault"`
}

// ── Column type catalog ───────────────────────────────────────────────────────

type TypeEntry struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type TypeGroup struct {
	Label string      `json:"label"`
	Types []TypeEntry `json:"types"`
}
