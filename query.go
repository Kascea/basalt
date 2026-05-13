package main

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

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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

	stats, _ := introspectorFor(conn.driver).ObjectStats(ctx, conn.db)

	return QueryResult{
		Columns:     columns,
		Rows:        resultRows,
		DurationMS:  int(time.Since(started).Milliseconds()),
		Message:     fmt.Sprintf("%d rows fetched", len(resultRows)),
		ObjectStats: stats,
	}, nil
}

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

	return QueryResult{
		Columns:     columns,
		ColumnTypes: columnTypes,
		Rows:        resultRows,
		RowIDs:      rowIDs,
		DurationMS:  int(time.Since(started).Milliseconds()),
		Message:     fmt.Sprintf("%d rows fetched from %s.%s", len(resultRows), schema, table),
	}, nil
}
