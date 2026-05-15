package db

import (
	"bufio"
	"fmt"
	"os"
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

func loadEnvValue(key string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}

	file, err := os.Open(".env")
	if err != nil {
		return ""
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		name, value, ok := strings.Cut(line, "=")
		if !ok || strings.TrimSpace(name) != key {
			continue
		}

		return strings.Trim(strings.TrimSpace(value), `"'`)
	}

	return ""
}

func introspectorFor(driver Driver) Introspector {
	switch driver {
	case DriverPostgres:
		return PostgresIntrospector{}
	default:
		return StaticIntrospector{driver: driver}
	}
}

func sqlDriverName(driver Driver) string {
	switch driver {
	case DriverPostgres:
		return "pgx"
	default:
		return string(driver)
	}
}
