package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ── Info types ────────────────────────────────────────────────────────────────

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

// ── Request types ─────────────────────────────────────────────────────────────

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
	Columns  string `json:"columns"` // comma-separated column names
	IsUnique bool   `json:"isUnique"`
	Method   string `json:"method"` // btree, hash, gin, gist
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

// ── Sequence methods ──────────────────────────────────────────────────────────

func (d *DatabaseService) ListSequences(connectionID, schema string) ([]SequenceInfo, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	rows, err := conn.db.QueryContext(ctx, `
		SELECT schemaname, sequencename,
		       coalesce(last_value::text, '—'),
		       increment_by::text,
		       min_value::text,
		       max_value::text,
		       cycle
		FROM pg_sequences
		WHERE schemaname = $1
		ORDER BY sequencename
	`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	seqs := make([]SequenceInfo, 0)
	for rows.Next() {
		var s SequenceInfo
		if err := rows.Scan(&s.Schema, &s.Name, &s.LastValue, &s.IncrementBy, &s.MinValue, &s.MaxValue, &s.IsCycled); err != nil {
			return nil, err
		}
		seqs = append(seqs, s)
	}
	return seqs, rows.Err()
}

func (d *DatabaseService) CreateSequence(connectionID string, req CreateSequenceRequest) error {
	conn, err := d.connection(connectionID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(req.Name) == "" {
		return fmt.Errorf("sequence name is required")
	}

	cycleClause := "NO CYCLE"
	if req.IsCycled {
		cycleClause = "CYCLE"
	}

	maxVal := req.MaxValue
	if maxVal == 0 {
		maxVal = 9223372036854775807
	}
	minVal := req.MinValue
	if minVal == 0 {
		minVal = 1
	}
	incr := req.IncrementBy
	if incr == 0 {
		incr = 1
	}
	start := req.StartValue
	if start == 0 {
		start = minVal
	}

	query := fmt.Sprintf(
		"CREATE SEQUENCE %s.%s INCREMENT BY %d MINVALUE %d MAXVALUE %d START WITH %d CACHE 1 %s",
		quoteIdent(req.Schema), quoteIdent(req.Name),
		incr, minVal, maxVal, start, cycleClause,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = conn.db.ExecContext(ctx, query)
	return err
}

func (d *DatabaseService) DropSequence(connectionID, schema, name string) error {
	conn, err := d.connection(connectionID)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := fmt.Sprintf("DROP SEQUENCE %s.%s", quoteIdent(schema), quoteIdent(name))
	_, err = conn.db.ExecContext(ctx, query)
	return err
}

// ── Index methods ─────────────────────────────────────────────────────────────

func (d *DatabaseService) ListIndexes(connectionID, schema string) ([]IndexInfo, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	rows, err := conn.db.QueryContext(ctx, `
		SELECT
		    n.nspname,
		    i.relname,
		    t.relname,
		    ix.indisunique,
		    ix.indisprimary,
		    pg_get_indexdef(ix.indexrelid)
		FROM pg_index ix
		JOIN pg_class i ON i.oid = ix.indexrelid
		JOIN pg_class t ON t.oid = ix.indrelid
		JOIN pg_namespace n ON n.oid = t.relnamespace
		WHERE n.nspname = $1
		ORDER BY t.relname, i.relname
	`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indexes := make([]IndexInfo, 0)
	for rows.Next() {
		var idx IndexInfo
		if err := rows.Scan(&idx.Schema, &idx.Name, &idx.TableName, &idx.IsUnique, &idx.IsPrimary, &idx.Definition); err != nil {
			return nil, err
		}
		indexes = append(indexes, idx)
	}
	return indexes, rows.Err()
}

func (d *DatabaseService) CreateIndex(connectionID string, req CreateIndexRequest) error {
	conn, err := d.connection(connectionID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Table) == "" || strings.TrimSpace(req.Columns) == "" {
		return fmt.Errorf("name, table, and columns are required")
	}

	method := strings.TrimSpace(req.Method)
	if method == "" {
		method = "btree"
	}

	// Quote each column name individually.
	rawCols := strings.Split(req.Columns, ",")
	quotedCols := make([]string, 0, len(rawCols))
	for _, c := range rawCols {
		c = strings.TrimSpace(c)
		if c != "" {
			quotedCols = append(quotedCols, quoteIdent(c))
		}
	}
	if len(quotedCols) == 0 {
		return fmt.Errorf("at least one column is required")
	}

	unique := ""
	if req.IsUnique {
		unique = "UNIQUE "
	}

	query := fmt.Sprintf(
		"CREATE %sINDEX %s ON %s.%s USING %s (%s)",
		unique,
		quoteIdent(req.Name),
		quoteIdent(req.Schema), quoteIdent(req.Table),
		method,
		strings.Join(quotedCols, ", "),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err = conn.db.ExecContext(ctx, query)
	return err
}

func (d *DatabaseService) DropIndex(connectionID, schema, name string) error {
	conn, err := d.connection(connectionID)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := fmt.Sprintf("DROP INDEX %s.%s", quoteIdent(schema), quoteIdent(name))
	_, err = conn.db.ExecContext(ctx, query)
	return err
}

// ── Foreign key methods ───────────────────────────────────────────────────────

func (d *DatabaseService) ListForeignKeys(connectionID, schema string) ([]ForeignKeyInfo, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	rows, err := conn.db.QueryContext(ctx, `
		SELECT
		    tc.table_schema,
		    tc.constraint_name,
		    tc.table_name,
		    kcu.column_name,
		    ccu.table_schema AS foreign_schema,
		    ccu.table_name  AS foreign_table,
		    ccu.column_name AS foreign_column,
		    rc.delete_rule,
		    rc.update_rule
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		    ON kcu.constraint_name = tc.constraint_name
		    AND kcu.table_schema   = tc.table_schema
		    AND kcu.table_name     = tc.table_name
		JOIN information_schema.referential_constraints rc
		    ON rc.constraint_name  = tc.constraint_name
		    AND rc.constraint_schema = tc.constraint_schema
		JOIN information_schema.constraint_column_usage ccu
		    ON ccu.constraint_name  = rc.unique_constraint_name
		    AND ccu.table_schema    = rc.unique_constraint_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
		    AND tc.table_schema = $1
		ORDER BY tc.table_name, tc.constraint_name
	`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fks := make([]ForeignKeyInfo, 0)
	for rows.Next() {
		var fk ForeignKeyInfo
		if err := rows.Scan(
			&fk.Schema, &fk.Name, &fk.TableName, &fk.ColumnName,
			&fk.ForeignSchema, &fk.ForeignTable, &fk.ForeignColumn,
			&fk.OnDelete, &fk.OnUpdate,
		); err != nil {
			return nil, err
		}
		fks = append(fks, fk)
	}
	return fks, rows.Err()
}

func (d *DatabaseService) AddForeignKey(connectionID string, req AddForeignKeyRequest) error {
	conn, err := d.connection(connectionID)
	if err != nil {
		return err
	}
	if req.Name == "" || req.Table == "" || req.Column == "" || req.ForeignTable == "" || req.ForeignColumn == "" {
		return fmt.Errorf("name, table, column, foreign table, and foreign column are required")
	}

	onDelete := req.OnDelete
	if onDelete == "" {
		onDelete = "NO ACTION"
	}
	onUpdate := req.OnUpdate
	if onUpdate == "" {
		onUpdate = "NO ACTION"
	}

	foreignSchema := req.ForeignSchema
	if foreignSchema == "" {
		foreignSchema = req.Schema
	}

	query := fmt.Sprintf(
		"ALTER TABLE %s.%s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s.%s (%s) ON DELETE %s ON UPDATE %s",
		quoteIdent(req.Schema), quoteIdent(req.Table),
		quoteIdent(req.Name),
		quoteIdent(req.Column),
		quoteIdent(foreignSchema), quoteIdent(req.ForeignTable),
		quoteIdent(req.ForeignColumn),
		onDelete, onUpdate,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = conn.db.ExecContext(ctx, query)
	return err
}

// ── Table methods ─────────────────────────────────────────────────────────────

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

func (d *DatabaseService) CreateTable(connectionID string, req CreateTableRequest) error {
	conn, err := d.connection(connectionID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(req.Name) == "" {
		return fmt.Errorf("table name is required")
	}
	if len(req.Columns) == 0 {
		return fmt.Errorf("at least one column is required")
	}

	colDefs := make([]string, 0, len(req.Columns))
	for _, col := range req.Columns {
		if strings.TrimSpace(col.Name) == "" || strings.TrimSpace(col.DataType) == "" {
			continue
		}
		def := fmt.Sprintf("%s %s", quoteIdent(col.Name), col.DataType)
		if !col.Nullable {
			def += " NOT NULL"
		}
		if strings.TrimSpace(col.Default) != "" {
			def += " DEFAULT " + col.Default
		}
		colDefs = append(colDefs, def)
	}
	if len(colDefs) == 0 {
		return fmt.Errorf("at least one valid column is required")
	}

	query := fmt.Sprintf(
		"CREATE TABLE %s.%s (\n  %s\n)",
		quoteIdent(req.Schema), quoteIdent(req.Name),
		strings.Join(colDefs, ",\n  "),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = conn.db.ExecContext(ctx, query)
	return err
}

func (d *DatabaseService) DropTable(connectionID, schema, name string) error {
	conn, err := d.connection(connectionID)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := fmt.Sprintf("DROP TABLE %s.%s", quoteIdent(schema), quoteIdent(name))
	_, err = conn.db.ExecContext(ctx, query)
	return err
}

func (d *DatabaseService) DropForeignKey(connectionID, schema, tableName, constraintName string) error {
	conn, err := d.connection(connectionID)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := fmt.Sprintf(
		"ALTER TABLE %s.%s DROP CONSTRAINT %s",
		quoteIdent(schema), quoteIdent(tableName), quoteIdent(constraintName),
	)
	_, err = conn.db.ExecContext(ctx, query)
	return err
}
