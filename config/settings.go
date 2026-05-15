package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type AppSettings struct {
	RowDensity        string `json:"rowDensity"`        // "compact" | "normal" | "comfortable"
	NullText          string `json:"nullText"`           // e.g. "NULL"
	FontSize          int    `json:"fontSize"`           // 12 | 13 | 14
	DefaultRowLimit   int    `json:"defaultRowLimit"`    // 0 = unlimited
	QueryTimeoutSec   int    `json:"queryTimeoutSec"`
	ConfirmDropTable  bool   `json:"confirmDropTable"`
	ConfirmDeleteRows bool   `json:"confirmDeleteRows"`
}

var DefaultSettings = AppSettings{
	RowDensity:        "normal",
	NullText:          "NULL",
	FontSize:          13,
	DefaultRowLimit:   1000,
	QueryTimeoutSec:   30,
	ConfirmDropTable:  true,
	ConfirmDeleteRows: false,
}

func SettingsPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "basalt", "settings.json"), nil
}

func LoadAppSettings() AppSettings {
	path, err := SettingsPath()
	if err != nil {
		return DefaultSettings
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return DefaultSettings
	}
	s := DefaultSettings
	if err := json.Unmarshal(data, &s); err != nil {
		return DefaultSettings
	}
	if s.QueryTimeoutSec <= 0 {
		s.QueryTimeoutSec = DefaultSettings.QueryTimeoutSec
	}
	return s
}

func SaveAppSettings(s AppSettings) error {
	path, err := SettingsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
