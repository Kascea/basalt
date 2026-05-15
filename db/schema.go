package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

func (d *DatabaseService) GetTableColumns(connectionID, schema, table string) ([]ColumnInfo, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := conn.db.QueryContext(ctx, `
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

func (d *DatabaseService) ListSchemaObjects(connectionID string) ([]SchemaObject, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	return introspectorFor(conn.driver).ListObjects(ctx, conn.db)
}

// ── Introspector implementations ──────────────────────────────────────────────

// StaticIntrospector is the adapter for drivers whose metadata cannot be queried
// at runtime (MySQL, SQLite, or unknown drivers). It returns static type catalogs
// and does not support physical row addressing.
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

// Row addressing is not supported for static drivers; RowIDExpr produces a NULL
// placeholder and WhereRowID produces an always-false predicate so mutations
// on unsupported drivers are safe no-ops until a real adapter is wired up.
func (StaticIntrospector) RowIDExpr() string            { return "null" }
func (StaticIntrospector) WhereRowID(_ int) string      { return "1 = 0" }

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
		var stat SchemaObjectSummary
		if err := rows.Scan(&stat.Label, &stat.Count); err != nil {
			return nil, err
		}
		stats = append(stats, stat)
	}

	return stats, rows.Err()
}

func (PostgresIntrospector) ListColumnTypes(ctx context.Context, db *sql.DB) ([]TypeGroup, error) {
	return listPostgresTypes(ctx, db)
}

func (PostgresIntrospector) RowIDExpr() string { return "ctid::text" }

func (PostgresIntrospector) WhereRowID(param int) string {
	return fmt.Sprintf("ctid = $%d::tid", param)
}
