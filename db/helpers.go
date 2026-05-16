package db

import (
	"fmt"
	"net/url"
	"strings"
	"time"
)

// quoteIdent safely double-quotes a SQL identifier to prevent injection.
func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

func formatDBValue(value any) string {
	if value == nil {
		return ""
	}

	switch typed := value.(type) {
	case []byte:
		return string(typed)
	case time.Time:
		return typed.Format(time.RFC3339)
	default:
		return fmt.Sprint(typed)
	}
}

func introspectorFor(driver Driver) Introspector {
	switch driver {
	case DriverPostgres:
		return PostgresIntrospector{}
	case DriverSQLite:
		return SQLiteIntrospector{}
	default:
		return StaticIntrospector{driver: driver}
	}
}

// sqliteURI converts a plain file path to a SQLite URI so that paths
// containing spaces or other special characters open correctly via mattn/go-sqlite3.
func sqliteURI(s string) string {
	if s == ":memory:" || strings.HasPrefix(s, "file:") {
		return s
	}
	return (&url.URL{Scheme: "file", Path: s}).String()
}

func sqlDriverName(driver Driver) string {
	switch driver {
	case DriverPostgres:
		return "pgx"
	case DriverSQLite:
		return "sqlite3"
	default:
		return string(driver)
	}
}
