package db

import (
	"context"
	"fmt"
	"strings"
	"time"
)


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
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Table) == "" || strings.TrimSpace(req.Columns) == "" {
		return fmt.Errorf("name, table, and columns are required")
	}

	method := strings.TrimSpace(req.Method)
	if method == "" {
		method = "btree"
	}

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
	return d.execDDL(connectionID, 30*time.Second, query)
}

func (d *DatabaseService) DropIndex(connectionID, schema, name string) error {
	query := fmt.Sprintf("DROP INDEX %s.%s", quoteIdent(schema), quoteIdent(name))
	return d.execDDL(connectionID, 10*time.Second, query)
}
