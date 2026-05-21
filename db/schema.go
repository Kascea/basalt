package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func (d *DatabaseService) GetTableColumns(connectionID, schema, table string) ([]ColumnInfo, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return conn.intr.GetTableColumns(ctx, conn.db, schema, table)
}

func (d *DatabaseService) GetTableDDL(connectionID, schema, table string) (string, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return conn.intr.GetTableDDL(ctx, conn.db, schema, table)
}

func (d *DatabaseService) ListSchemaObjects(connectionID string) ([]SchemaObject, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return conn.intr.ListObjects(ctx, conn.db)
}

// ── StaticIntrospector ────────────────────────────────────────────────────────

type StaticIntrospector struct{ driver Driver }

func (StaticIntrospector) ListObjects(context.Context, *sql.DB) ([]SchemaObject, error) {
	return []SchemaObject{}, nil
}
func (StaticIntrospector) ObjectStats(context.Context, *sql.DB) ([]SchemaObjectSummary, error) {
	return []SchemaObjectSummary{}, nil
}
func (s StaticIntrospector) ListColumnTypes(_ context.Context, _ *sql.DB) ([]TypeGroup, error) {
	return staticTypes(s.driver), nil
}
func (StaticIntrospector) GetTableColumns(_ context.Context, _ *sql.DB, _, _ string) ([]ColumnInfo, error) {
	return []ColumnInfo{}, nil
}
func (StaticIntrospector) GetPrimaryKeys(_ context.Context, _ *sql.DB, _, _ string) ([]string, error) {
	return []string{}, nil
}
func (StaticIntrospector) GetTableDDL(_ context.Context, _ *sql.DB, schema, table string) (string, error) {
	return "-- DDL not available for this driver", nil
}
func (StaticIntrospector) TableExpr(schema, table string) string {
	return quoteIdent(schema) + "." + quoteIdent(table)
}
func (StaticIntrospector) Placeholder(n int) string  { return fmt.Sprintf("$%d", n) }
func (StaticIntrospector) RowIDExpr() string         { return "null" }
func (StaticIntrospector) WhereRowID(_ int) string   { return "1 = 0" }

// ── SQLiteIntrospector ────────────────────────────────────────────────────────

type SQLiteIntrospector struct{}

func (SQLiteIntrospector) ListObjects(ctx context.Context, db *sql.DB) ([]SchemaObject, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT name, type
		FROM sqlite_master
		WHERE type IN ('table', 'view')
		  AND name NOT LIKE 'sqlite_%'
		ORDER BY type, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	objects := make([]SchemaObject, 0)
	for rows.Next() {
		var name, typ string
		if err := rows.Scan(&name, &typ); err != nil {
			return nil, err
		}
		label := "Table"
		if typ == "view" {
			label = "View"
		}
		objects = append(objects, SchemaObject{
			Schema:   "main",
			Name:     name,
			Type:     label,
			Modified: "Unknown",
		})
	}
	return objects, rows.Err()
}

func (SQLiteIntrospector) ObjectStats(ctx context.Context, db *sql.DB) ([]SchemaObjectSummary, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT CASE type WHEN 'table' THEN 'Tables' ELSE 'Views' END, count(*)
		FROM sqlite_master
		WHERE type IN ('table', 'view')
		  AND name NOT LIKE 'sqlite_%'
		GROUP BY type
		ORDER BY 1
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make([]SchemaObjectSummary, 0)
	for rows.Next() {
		var s SchemaObjectSummary
		if err := rows.Scan(&s.Label, &s.Count); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

func (SQLiteIntrospector) ListColumnTypes(_ context.Context, _ *sql.DB) ([]TypeGroup, error) {
	return staticTypes(DriverSQLite), nil
}

func (SQLiteIntrospector) GetTableColumns(ctx context.Context, db *sql.DB, _, table string) ([]ColumnInfo, error) {
	// PRAGMA doesn't support parameterized queries; quoteIdent escapes the name safely.
	rows, err := db.QueryContext(ctx, "PRAGMA table_info("+quoteIdent(table)+")")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols := make([]ColumnInfo, 0)
	for rows.Next() {
		var cid int
		var name, typ string
		var notNull int
		var dflt sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notNull, &dflt, &pk); err != nil {
			return nil, err
		}
		col := ColumnInfo{
			Name:       name,
			DataType:   typ,
			IsNullable: notNull == 0,
		}
		if dflt.Valid {
			col.ColumnDefault = &dflt.String
		}
		cols = append(cols, col)
	}
	return cols, rows.Err()
}

func (SQLiteIntrospector) GetPrimaryKeys(ctx context.Context, db *sql.DB, _, table string) ([]string, error) {
	rows, err := db.QueryContext(ctx, "SELECT name FROM pragma_table_info("+quoteIdent(table)+") WHERE pk > 0 ORDER BY pk")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var pks []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		pks = append(pks, name)
	}
	return pks, rows.Err()
}

func (SQLiteIntrospector) GetTableDDL(ctx context.Context, db *sql.DB, _, table string) (string, error) {
	var ddl string
	err := db.QueryRowContext(ctx,
		`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`, table,
	).Scan(&ddl)
	if err != nil {
		return "", err
	}
	return formatSQLiteDDL(ddl) + ";", nil
}

// formatSQLiteDDL pretty-prints a compact CREATE TABLE statement from sqlite_master.
// It splits column/constraint definitions at top-level commas and indents each one.
func formatSQLiteDDL(ddl string) string {
	open := strings.Index(ddl, "(")
	if open < 0 {
		return ddl
	}
	close := strings.LastIndex(ddl, ")")
	if close < 0 || close <= open {
		return ddl
	}

	header := strings.TrimRight(ddl[:open], " \t")
	inner := ddl[open+1 : close]

	// Split at top-level commas (not inside nested parens).
	var parts []string
	depth := 0
	start := 0
	for i, ch := range inner {
		switch ch {
		case '(':
			depth++
		case ')':
			depth--
		case ',':
			if depth == 0 {
				parts = append(parts, strings.TrimSpace(inner[start:i]))
				start = i + 1
			}
		}
	}
	if tail := strings.TrimSpace(inner[start:]); tail != "" {
		parts = append(parts, tail)
	}

	var b strings.Builder
	b.WriteString(header)
	b.WriteString(" (\n")
	for i, p := range parts {
		b.WriteString("    ")
		b.WriteString(p)
		if i < len(parts)-1 {
			b.WriteString(",")
		}
		b.WriteString("\n")
	}
	b.WriteString(")")
	return b.String()
}

func (SQLiteIntrospector) TableExpr(_, table string) string { return quoteIdent(table) }
func (SQLiteIntrospector) Placeholder(_ int) string         { return "?" }
func (SQLiteIntrospector) RowIDExpr() string                { return "rowid" }
func (SQLiteIntrospector) WhereRowID(_ int) string          { return "rowid = ?" }

// ── PostgresIntrospector ──────────────────────────────────────────────────────

type PostgresIntrospector struct{}

func (PostgresIntrospector) ListObjects(ctx context.Context, db *sql.DB) ([]SchemaObject, error) {
	rows, err := db.QueryContext(ctx, `
		select
			n.nspname,
			c.relname,
			case c.relkind
				when 'r' then 'Table'
				when 'v' then 'View'
				when 'm' then 'Materialized View'
				when 'i' then 'Index'
				when 'S' then 'Sequence'
				else 'Object'
			end,
			coalesce(c.reltuples::bigint, 0)
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
		var obj SchemaObject
		if err := rows.Scan(&obj.Schema, &obj.Name, &obj.Type, &obj.Rows); err != nil {
			return nil, err
		}
		obj.Modified = "Unknown"
		objects = append(objects, obj)
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
		var s SchemaObjectSummary
		if err := rows.Scan(&s.Label, &s.Count); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

func (PostgresIntrospector) ListColumnTypes(ctx context.Context, db *sql.DB) ([]TypeGroup, error) {
	return listPostgresTypes(ctx, db)
}

func (PostgresIntrospector) GetTableColumns(ctx context.Context, db *sql.DB, schema, table string) ([]ColumnInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT
			column_name,
			udt_name || CASE
				WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')'
				WHEN data_type = 'numeric' AND numeric_precision IS NOT NULL
					THEN '(' || numeric_precision || ',' || numeric_scale || ')'
				ELSE ''
			END,
			is_nullable = 'YES',
			column_default
		FROM information_schema.columns
		WHERE table_schema = $1 AND table_name = $2
		ORDER BY ordinal_position
	`, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols := make([]ColumnInfo, 0)
	for rows.Next() {
		var col ColumnInfo
		if err := rows.Scan(&col.Name, &col.DataType, &col.IsNullable, &col.ColumnDefault); err != nil {
			return nil, err
		}
		cols = append(cols, col)
	}
	return cols, rows.Err()
}

func (PostgresIntrospector) GetPrimaryKeys(ctx context.Context, db *sql.DB, schema, table string) ([]string, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		  ON tc.constraint_name = kcu.constraint_name
		  AND tc.table_schema = kcu.table_schema
		  AND tc.table_name = kcu.table_name
		WHERE tc.constraint_type = 'PRIMARY KEY'
		  AND tc.table_schema = $1
		  AND tc.table_name = $2
		ORDER BY kcu.ordinal_position
	`, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var pks []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		pks = append(pks, name)
	}
	return pks, rows.Err()
}

func (PostgresIntrospector) GetTableDDL(ctx context.Context, db *sql.DB, schema, table string) (string, error) {
	var ddl string
	err := db.QueryRowContext(ctx, `
		SELECT
			'CREATE TABLE ' || quote_ident(n.nspname) || '.' || quote_ident(c.relname) || E' (\n' ||
			string_agg(
				'    ' || quote_ident(a.attname) || ' ' ||
				pg_catalog.format_type(a.atttypid, a.atttypmod) ||
				CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
				CASE WHEN ad.adbin IS NOT NULL
					THEN ' DEFAULT ' || pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
					ELSE '' END,
				E',\n' ORDER BY a.attnum
			) ||
			COALESCE(E',\n' || (
				SELECT string_agg('    ' || pg_catalog.pg_get_constraintdef(con.oid, true), E',\n')
				FROM pg_catalog.pg_constraint con
				WHERE con.conrelid = c.oid AND con.contype IN ('p', 'u', 'c', 'f')
			), '') ||
			E'\n);'
		FROM pg_catalog.pg_class c
		JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
		JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
		LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
		WHERE n.nspname = $1 AND c.relname = $2
		GROUP BY n.nspname, c.relname, c.oid
	`, schema, table).Scan(&ddl)
	if err != nil {
		return "", err
	}
	return ddl, nil
}

func (PostgresIntrospector) TableExpr(schema, table string) string {
	return quoteIdent(schema) + "." + quoteIdent(table)
}
func (PostgresIntrospector) Placeholder(n int) string { return fmt.Sprintf("$%d", n) }
func (PostgresIntrospector) RowIDExpr() string        { return "ctid::text" }
func (PostgresIntrospector) WhereRowID(param int) string {
	return fmt.Sprintf("ctid = $%d::tid", param)
}
