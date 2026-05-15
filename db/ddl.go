package db

import (
	"context"
	"time"
)

// execDDL acquires the connection for connectionID, runs query with the given
// timeout, and returns any error. All DDL operations (Create/Drop) share this
// path so connection-lookup, context, and exec errors are handled in one place.
func (d *DatabaseService) execDDL(connectionID string, timeout time.Duration, query string) error {
	conn, err := d.connection(connectionID)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	_, err = conn.db.ExecContext(ctx, query)
	return err
}
