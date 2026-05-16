package config

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type SavedConnection struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Driver           string `json:"driver"`
	ConnectionString string `json:"connectionString"`
	PlanetScaleKey   string `json:"planetscaleKey,omitempty"` // "org/database/branch" for PS connections
}

func ConnectionsPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "basalt", "connections.json"), nil
}

func LoadSavedConnections() ([]SavedConnection, error) {
	path, err := ConnectionsPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return []SavedConnection{}, nil
	}
	if err != nil {
		return nil, err
	}
	var conns []SavedConnection
	if err := json.Unmarshal(data, &conns); err != nil {
		return nil, err
	}
	return conns, nil
}

func WriteSavedConnections(conns []SavedConnection) error {
	path, err := ConnectionsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(conns, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}

func NewID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x", b)
}

func PlanetScaleTokenPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "basalt", "planetscale_token"), nil
}

func LoadPlanetScaleToken() string {
	path, err := PlanetScaleTokenPath()
	if err != nil {
		return ""
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(data)
}

func SavePlanetScaleToken(token string) error {
	path, err := PlanetScaleTokenPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(token), 0600)
}
