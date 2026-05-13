package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

var defaultSettings = AppSettings{
	RowDensity:        "normal",
	NullText:          "NULL",
	FontSize:          13,
	DefaultRowLimit:   1000,
	QueryTimeoutSec:   30,
	ConfirmDropTable:  true,
	ConfirmDeleteRows: false,
}

func settingsPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "basalt", "settings.json"), nil
}

func loadAppSettings() AppSettings {
	path, err := settingsPath()
	if err != nil {
		return defaultSettings
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return defaultSettings
	}
	s := defaultSettings
	if err := json.Unmarshal(data, &s); err != nil {
		return defaultSettings
	}
	if s.QueryTimeoutSec <= 0 {
		s.QueryTimeoutSec = defaultSettings.QueryTimeoutSec
	}
	return s
}

func saveAppSettings(s AppSettings) error {
	path, err := settingsPath()
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

func (d *DatabaseService) GetSettings() AppSettings {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.settings
}

func (d *DatabaseService) SaveSettings(s AppSettings) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.settings = s
	return saveAppSettings(s)
}
