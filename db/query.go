package db

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (d *DatabaseService) ExecuteQuery(connectionID string, statement string) (QueryResult, error) {
	trimmed := strings.TrimSpace(statement)
	if trimmed == "" {
		return QueryResult{}, errors.New("write a SQL statement before running")
	}

	conn, err := d.connection(connectionID)
	if err != nil {
		return QueryResult{}, err
	}

	settings := d.store.GetSettings()
	timeout := time.Duration(settings.QueryTimeoutSec) * time.Second

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	started := time.Now()
	rows, err := conn.db.QueryContext(ctx, trimmed)
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
		for i := range values {
			valuePointers[i] = &values[i]
		}

		if err := rows.Scan(valuePointers...); err != nil {
			return QueryResult{}, err
		}

		row := make(map[string]string, len(columns))
		for i, col := range columns {
			row[col] = formatDBValue(values[i])
		}
		resultRows = append(resultRows, row)
	}
	if err := rows.Err(); err != nil {
		return QueryResult{}, err
	}

	return QueryResult{
		Columns:    columns,
		Rows:       resultRows,
		DurationMS: int(time.Since(started).Milliseconds()),
		Message:    fmt.Sprintf("%d rows fetched", len(resultRows)),
	}, nil
}

func (d *DatabaseService) ExplainQuery(connectionID string, statement string) ([]string, error) {
	trimmed := strings.TrimSpace(statement)
	if trimmed == "" {
		return nil, errors.New("write a SQL statement before running")
	}
	conn, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}
	settings := d.store.GetSettings()
	timeout := time.Duration(settings.QueryTimeoutSec) * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return explainLines(ctx, conn, trimmed)
}

func explainLines(ctx context.Context, conn *openConnection, statement string) ([]string, error) {
	var explainSQL string
	if conn.driver == DriverSQLite {
		explainSQL = "EXPLAIN QUERY PLAN " + statement
	} else {
		explainSQL = "EXPLAIN " + statement
	}

	rows, err := conn.db.QueryContext(ctx, explainSQL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var lines []string
	for rows.Next() {
		values := make([]any, len(columns))
		ptrs := make([]any, len(columns))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		// SQLite EXPLAIN QUERY PLAN: id, parent, notused, detail
		if conn.driver == DriverSQLite && len(values) >= 4 {
			lines = append(lines, formatDBValue(values[3]))
		} else {
			parts := make([]string, len(values))
			for i, v := range values {
				parts[i] = formatDBValue(v)
			}
			lines = append(lines, strings.Join(parts, " "))
		}
	}
	return lines, rows.Err()
}

func validateWhereClause(where string) error {
	for _, ch := range where {
		if ch == ';' || ch == '\x00' {
			return fmt.Errorf("filter may not contain semicolons or null bytes")
		}
	}
	return nil
}

func (d *DatabaseService) FetchTable(connectionID, schema, table, where string, page, pageSize int) (QueryResult, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return QueryResult{}, err
	}

	trimmedWhere := strings.TrimSpace(where)
	if trimmedWhere != "" {
		if err := validateWhereClause(trimmedWhere); err != nil {
			return QueryResult{}, err
		}
	}

	settings := d.store.GetSettings()
	rowLimit := settings.DefaultRowLimit
	if pageSize > 0 {
		rowLimit = pageSize
	}
	timeout := time.Duration(settings.QueryTimeoutSec) * time.Second

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	baseFrom := fmt.Sprintf("FROM %s.%s", quoteIdent(schema), quoteIdent(table))
	if trimmedWhere != "" {
		baseFrom += " WHERE " + trimmedWhere
	}

	// Count total rows for pagination (skip when unlimited).
	totalRows := 0
	if rowLimit > 0 {
		countQuery := "SELECT COUNT(*) " + baseFrom
		if err := conn.db.QueryRowContext(ctx, countQuery).Scan(&totalRows); err != nil {
			return QueryResult{}, err
		}
	}

	if page < 0 {
		page = 0
	}

	query := fmt.Sprintf("SELECT %s AS __rowid, * %s", conn.intr.RowIDExpr(), baseFrom)
	if rowLimit > 0 {
		offset := page * rowLimit
		query += fmt.Sprintf(" LIMIT %d OFFSET %d", rowLimit, offset)
	}

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
	allColTypes, err := rows.ColumnTypes()
	if err != nil {
		return QueryResult{}, err
	}

	// allColumns[0] is __rowid; the rest are real columns.
	columns := allColumns[1:]
	columnTypes := make([]string, len(columns))
	for i, ct := range allColTypes[1:] {
		columnTypes[i] = ct.DatabaseTypeName()
	}
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

	msg := fmt.Sprintf("%d rows fetched from %s.%s", len(resultRows), schema, table)
	if rowLimit > 0 {
		msg += fmt.Sprintf(" (page %d of %d, limit %d)", page+1, max(1, (totalRows+rowLimit-1)/rowLimit), rowLimit)
	}

	pks, _ := conn.intr.GetPrimaryKeys(ctx, conn.db, schema, table)
	if pks == nil {
		pks = []string{}
	}

	return QueryResult{
		Columns:     columns,
		ColumnTypes: columnTypes,
		PrimaryKeys: pks,
		Rows:        resultRows,
		RowIDs:      rowIDs,
		DurationMS:  int(time.Since(started).Milliseconds()),
		Message:     msg,
		TotalRows:   totalRows,
		PageSize:    rowLimit,
	}, nil
}
