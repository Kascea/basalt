package db

import (
	"context"
	"fmt"
	"time"
)

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
