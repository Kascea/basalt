package db

import (
	"context"
	"fmt"
	"strings"
	"time"
)

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
