package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

func (d *DatabaseService) InsertRows(connectionID string, inserts []RowInsert) error {
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

	for _, ins := range inserts {
		if len(ins.Values) == 0 {
			continue
		}

		cols := make([]string, 0, len(ins.Values))
		placeholders := make([]string, 0, len(ins.Values))
		args := make([]any, 0, len(ins.Values))
		i := 1
		for col, val := range ins.Values {
			cols = append(cols, quoteIdent(col))
			placeholders = append(placeholders, fmt.Sprintf("$%d", i))
			args = append(args, val)
			i++
		}

		query := fmt.Sprintf(
			"INSERT INTO %s.%s (%s) VALUES (%s)",
			quoteIdent(ins.Schema), quoteIdent(ins.Table),
			strings.Join(cols, ", "),
			strings.Join(placeholders, ", "),
		)

		if _, err := tx.ExecContext(ctx, query, args...); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Detail != "" {
				return fmt.Errorf("inserting row: ERROR: %s\nDETAIL: %s", pgErr.Message, pgErr.Detail)
			}
			return fmt.Errorf("inserting row: %w", err)
		}
	}

	return tx.Commit()
}

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

func (d *DatabaseService) DeleteRows(connectionID string, deletes []RowDelete) error {
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

	for _, del := range deletes {
		query := fmt.Sprintf(
			"DELETE FROM %s.%s WHERE ctid = $1::tid",
			quoteIdent(del.Schema), quoteIdent(del.Table),
		)
		if _, err := tx.ExecContext(ctx, query, del.RowID); err != nil {
			return fmt.Errorf("deleting row %s: %w", del.RowID, err)
		}
	}

	return tx.Commit()
}

// GetNextSequenceValues finds columns with nextval() defaults and advances each
// sequence, returning a map of column name → next value. Callers should treat
// sequence gaps from discarded rows as acceptable (standard PostgreSQL behaviour).
func (d *DatabaseService) GetNextSequenceValues(connectionID, schema, table string) (map[string]string, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Extract the sequence name from column_default (e.g. nextval('t_id_seq'::regclass))
	// and immediately advance it. The POSIX regex [^']+ matches non-quote chars.
	query := `
		SELECT column_name,
		       nextval(substring(column_default FROM '''([^'']+)''')::regclass)::text
		FROM information_schema.columns
		WHERE table_schema = $1
		  AND table_name  = $2
		  AND column_default LIKE 'nextval(%'
		ORDER BY ordinal_position`

	rows, err := conn.db.QueryContext(ctx, query, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]string)
	for rows.Next() {
		var col, val string
		if err := rows.Scan(&col, &val); err != nil {
			return nil, err
		}
		result[col] = val
	}
	return result, rows.Err()
}
