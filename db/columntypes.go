package db

import (
	"context"
	"database/sql"
	"time"
)

// pgCategoryLabel maps pg_type.typcategory codes to human-readable group names.
var pgCategoryLabel = map[string]string{
	"N": "Numeric",
	"S": "Text",
	"B": "Boolean",
	"D": "Date / Time",
	"T": "Timespan",
	"U": "User-defined",
	"E": "Enum",
	"G": "Geometric",
	"I": "Network",
	"R": "Range",
	"V": "Bit-string",
}

// pgCategoryOrder controls the display order of groups in the UI.
var pgCategoryOrder = []string{"N", "S", "B", "D", "T", "U", "E", "G", "I", "R", "V"}

// pgTypeDesc provides human-readable descriptions for well-known Postgres types
// when pg_catalog does not carry a description comment.
var pgTypeDesc = map[string]string{
	// Numeric
	"int2":        "2-byte signed integer",
	"int4":        "4-byte signed integer",
	"int8":        "8-byte signed integer",
	"float4":      "4-byte floating-point",
	"float8":      "8-byte floating-point",
	"numeric":     "exact decimal, arbitrary precision",
	"money":       "currency amount (locale-specific)",
	"oid":         "object identifier",
	"serial":      "auto-incrementing 4-byte integer",
	"bigserial":   "auto-incrementing 8-byte integer",
	"smallserial": "auto-incrementing 2-byte integer",
	// Text
	"text":    "variable-length string (unlimited)",
	"varchar": "variable-length string with optional limit",
	"bpchar":  "fixed-length, space-padded string",
	"name":    "internal 63-byte identifier",
	"citext":  "case-insensitive text",
	// Boolean
	"bool": "true / false",
	// Date / Time
	"date":        "calendar date (year, month, day)",
	"time":        "time of day (no timezone)",
	"timetz":      "time of day with timezone",
	"timestamp":   "date and time (no timezone)",
	"timestamptz": "date and time with timezone",
	// Timespan
	"interval": "time span",
	// UUID
	"uuid": "128-bit universally unique identifier",
	// JSON
	"json":  "text JSON, stored as-is",
	"jsonb": "binary JSON, indexed and preferred",
	// Binary
	"bytea": "variable-length binary data",
	// Network
	"inet":    "IPv4/IPv6 host or network address",
	"cidr":    "IPv4/IPv6 network address",
	"macaddr": "MAC address",
	"macaddr8": "MAC address (EUI-64)",
	// Geometric
	"point":   "geometric point (x,y)",
	"line":    "infinite line",
	"lseg":    "finite line segment",
	"box":     "rectangular box",
	"path":    "geometric path",
	"polygon": "closed geometric path",
	"circle":  "circle",
	// Bit-string
	"bit":    "fixed-length bit string",
	"varbit": "variable-length bit string",
	// Range
	"int4range":  "range of integer",
	"int8range":  "range of bigint",
	"numrange":   "range of numeric",
	"tsrange":    "range of timestamp (no tz)",
	"tstzrange":  "range of timestamp with tz",
	"daterange":  "range of date",
	"int4multirange":   "multirange of integer",
	"int8multirange":   "multirange of bigint",
	"nummultirange":    "multirange of numeric",
	"tsmultirange":     "multirange of timestamp (no tz)",
	"tstzmultirange":   "multirange of timestamp with tz",
	"datemultirange":   "multirange of date",
	// Full-text search
	"tsvector": "text search document",
	"tsquery":  "text search query",
	// XML
	"xml": "XML data",
}

// ListColumnTypes returns the types supported by the connected database,
// grouped by category. For PostgreSQL this queries pg_catalog; for other
// drivers it returns a curated static list.
func (d *DatabaseService) ListColumnTypes(connectionID string) ([]TypeGroup, error) {
	conn, err := d.connection(connectionID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return introspectorFor(conn.driver).ListColumnTypes(ctx, conn.db)
}

func listPostgresTypes(ctx context.Context, db *sql.DB) ([]TypeGroup, error) {
	// Return a curated set of common base/range types plus all user-defined
	// enums and domains from the actual database.
	rows, err := db.QueryContext(ctx, `
		SELECT t.typname, t.typcategory
		FROM pg_catalog.pg_type t
		JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
		WHERE t.typisdefined = true
		  AND n.nspname NOT IN ('information_schema', 'pg_catalog')
		  AND (
		    -- User-defined enums and domains from non-system schemas
		    t.typtype IN ('e', 'd')
		  )
		UNION ALL
		-- Curated whitelist of common base, range, and multirange types from pg_catalog
		SELECT t.typname, t.typcategory
		FROM pg_catalog.pg_type t
		JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'pg_catalog'
		  AND t.typtype IN ('b', 'r', 'm')
		  AND t.typname IN (
		    'int2','int4','int8','float4','float8','numeric','money',
		    'bool',
		    'text','varchar','bpchar','citext',
		    'date','time','timetz','timestamp','timestamptz',
		    'interval',
		    'uuid','json','jsonb','bytea','xml',
		    'inet','cidr','macaddr','macaddr8',
		    'point','box','circle','polygon',
		    'bit','varbit',
		    'int4range','int8range','numrange','tsrange','tstzrange','daterange',
		    'int4multirange','int8multirange','nummultirange','tsmultirange','tstzmultirange','datemultirange',
		    'tsvector','tsquery'
		  )
		ORDER BY typcategory, typname
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Collect by category code.
	byCategory := make(map[string][]TypeEntry)
	for rows.Next() {
		var name, cat string
		if err := rows.Scan(&name, &cat); err != nil {
			return nil, err
		}
		entry := TypeEntry{
			Name:        name,
			Description: pgTypeDesc[name],
		}
		byCategory[cat] = append(byCategory[cat], entry)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	groups := make([]TypeGroup, 0, len(pgCategoryOrder))
	for _, cat := range pgCategoryOrder {
		entries, ok := byCategory[cat]
		if !ok {
			continue
		}
		label, ok := pgCategoryLabel[cat]
		if !ok {
			label = cat
		}
		groups = append(groups, TypeGroup{Label: label, Types: entries})
	}
	return groups, nil
}

func staticTypes(driver Driver) []TypeGroup {
	switch driver {
	case DriverMySQL:
		return []TypeGroup{
			{Label: "Integer", Types: []TypeEntry{
				{Name: "INT", Description: "4-byte signed integer"},
				{Name: "BIGINT", Description: "8-byte signed integer"},
				{Name: "SMALLINT", Description: "2-byte signed integer"},
				{Name: "TINYINT", Description: "1-byte signed integer"},
				{Name: "INT UNSIGNED", Description: "4-byte unsigned integer"},
			}},
			{Label: "Decimal / Float", Types: []TypeEntry{
				{Name: "DECIMAL(10,2)", Description: "exact decimal"},
				{Name: "FLOAT", Description: "4-byte floating point"},
				{Name: "DOUBLE", Description: "8-byte floating point"},
			}},
			{Label: "Text", Types: []TypeEntry{
				{Name: "VARCHAR(255)", Description: "variable-length string"},
				{Name: "TEXT", Description: "long text"},
				{Name: "CHAR(1)", Description: "fixed-length string"},
				{Name: "MEDIUMTEXT", Description: "up to 16 MB text"},
				{Name: "LONGTEXT", Description: "up to 4 GB text"},
			}},
			{Label: "Boolean", Types: []TypeEntry{
				{Name: "TINYINT(1)", Description: "0 or 1, used as boolean"},
			}},
			{Label: "Date & Time", Types: []TypeEntry{
				{Name: "DATE", Description: "calendar date"},
				{Name: "DATETIME", Description: "date and time (no timezone)"},
				{Name: "TIMESTAMP", Description: "date and time (auto UTC-adjusted)"},
				{Name: "TIME", Description: "time of day"},
				{Name: "YEAR", Description: "4-digit year"},
			}},
			{Label: "JSON", Types: []TypeEntry{
				{Name: "JSON", Description: "JSON document"},
			}},
			{Label: "Binary", Types: []TypeEntry{
				{Name: "BLOB", Description: "binary large object"},
				{Name: "BINARY(16)", Description: "fixed-length binary"},
				{Name: "VARBINARY(255)", Description: "variable-length binary"},
			}},
		}
	case DriverSQLite:
		return []TypeGroup{
			{Label: "Integer", Types: []TypeEntry{
				{Name: "INTEGER", Description: "signed integer, 1–8 bytes"},
			}},
			{Label: "Float", Types: []TypeEntry{
				{Name: "REAL", Description: "8-byte floating point"},
				{Name: "NUMERIC", Description: "may be stored as integer or real"},
			}},
			{Label: "Text", Types: []TypeEntry{
				{Name: "TEXT", Description: "UTF-8 string"},
			}},
			{Label: "Binary", Types: []TypeEntry{
				{Name: "BLOB", Description: "binary data stored as-is"},
			}},
		}
	default:
		return nil
	}
}
