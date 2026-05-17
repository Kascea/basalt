package localdb

import (
	"bufio"
	"crypto/rand"
	"fmt"
	"os"
	"strings"
)

type AppSettings struct {
	RowDensity        string `json:"rowDensity"`        // "compact" | "normal" | "comfortable"
	DefaultRowLimit   int    `json:"defaultRowLimit"`    // 0 = unlimited
	QueryTimeoutSec   int    `json:"queryTimeoutSec"`
	ConfirmDropTable  bool   `json:"confirmDropTable"`
	ConfirmDeleteRows bool   `json:"confirmDeleteRows"`
}

var DefaultSettings = AppSettings{
	RowDensity:        "normal",
	DefaultRowLimit:   1000,
	QueryTimeoutSec:   30,
	ConfirmDropTable:  true,
	ConfirmDeleteRows: false,
}

type SavedConnection struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Driver           string `json:"driver"`
	ConnectionString string `json:"connectionString"`
	PlanetScaleKey   string `json:"planetscaleKey,omitempty"`
}

// SavedTab represents a persisted tab entry in the open_tabs table.
type SavedTab struct {
	ID           string `json:"id"`
	Kind         string `json:"kind"`         // worksheet | table | schema | sequences | indexes | foreignkeys
	ConnectionID string `json:"connectionID"`
	SchemaName   string `json:"schemaName"`
	TableName    string `json:"tableName"`
	Name         string `json:"name"`
	Pinned       bool   `json:"pinned"`
	SortOrder    int    `json:"sortOrder"`
	SQLContent   string `json:"sqlContent"`
	IsActive     bool   `json:"isActive"`
}

// PlanetScaleProvider is the provider key used to look up the PlanetScale OAuth token.
const PlanetScaleProvider = "planetscale"

// LoadEnvValue reads a value from the environment, falling back to a .env file.
func LoadEnvValue(key string) string {
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

func NewID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x", b)
}
