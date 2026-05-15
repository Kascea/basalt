package db

import (
	"context"
	"fmt"
	"strings"
	"time"
)

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
	return d.execDDL(connectionID, 10*time.Second, query)
}

func (d *DatabaseService) DropSequence(connectionID, schema, name string) error {
	query := fmt.Sprintf("DROP SEQUENCE %s.%s", quoteIdent(schema), quoteIdent(name))
	return d.execDDL(connectionID, 10*time.Second, query)
}
