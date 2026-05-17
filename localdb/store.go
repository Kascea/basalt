package localdb

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

// Store wraps gorm.DB and exposes typed repository methods for all local state.
type Store struct {
	db             *gorm.DB
	settingsMu     sync.RWMutex
	cachedSettings *AppSettings
}

// --- GORM models ---

type settingsRow struct {
	gorm.Model
	RowDensity        string
	DefaultRowLimit   int
	QueryTimeoutSec   int
	ConfirmDropTable  bool
	ConfirmDeleteRows bool
}

func (settingsRow) TableName() string { return "settings" }

type connectionRow struct {
	ID               string `gorm:"primarykey"`
	Name             string
	Driver           string
	ConnectionString string `gorm:"uniqueIndex"`
	PlanetScaleKey   string `gorm:"index"`
}

func (connectionRow) TableName() string { return "connections" }

type connectedAccount struct {
	gorm.Model
	Provider    string `gorm:"uniqueIndex"`
	Token       string
	DisplayName string
	Email       string
}

func (connectedAccount) TableName() string { return "connected_accounts" }

type openTab struct {
	ID           string `gorm:"primarykey"`
	Kind         string
	ConnectionID string
	SchemaName   string
	TabTable     string `gorm:"column:table_name"`
	Name         string
	Pinned       bool
	SortOrder    int
	SQLContent   string
	IsActive     bool
}

func (openTab) TableName() string { return "open_tabs" }

// --- Open ---

// Open opens (or creates) the SQLite database at
// ~/Library/Application Support/basalt/basalt.db (macOS) or the platform
// equivalent, runs auto-migrations, then performs a one-time import from any
// legacy JSON files that still exist.
func Open() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	basaltDir := filepath.Join(dir, "basalt")
	if err := os.MkdirAll(basaltDir, 0700); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(basaltDir, "basalt.db")

	// WAL mode allows concurrent readers alongside the single writer.
	// busy_timeout prevents "database is locked" under brief write contention.
	dsn := dbPath + "?_journal_mode=WAL&_busy_timeout=5000"
	gormDB, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}

	// Limit to one open connection so CGO-SQLite write serialisation is handled
	// at the driver level rather than via GORM's connection pool.
	sqlDB, err := gormDB.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(1)

	if err := gormDB.AutoMigrate(&settingsRow{}, &connectionRow{}, &connectedAccount{}, &openTab{}); err != nil {
		return nil, err
	}

	s := &Store{db: gormDB}
	s.migrateFromJSON(basaltDir)
	return s, nil
}

// --- JSON migration (one-time, runs on first launch after upgrade) ---

func (s *Store) migrateFromJSON(basaltDir string) {
	var wg sync.WaitGroup
	wg.Add(3)
	go func() { defer wg.Done(); s.migrateSettings(filepath.Join(basaltDir, "settings.json")) }()
	go func() { defer wg.Done(); s.migrateConnections(filepath.Join(basaltDir, "connections.json")) }()
	go func() { defer wg.Done(); s.migratePlanetScaleToken(filepath.Join(basaltDir, "planetscale_token")) }()
	wg.Wait()
}

func (s *Store) migrateSettings(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var parsed AppSettings
	if json.Unmarshal(data, &parsed) != nil {
		return
	}
	var count int64
	s.db.Model(&settingsRow{}).Count(&count)
	if count == 0 {
		_ = s.SaveSettings(parsed)
	}
	_ = os.Remove(path)
}

func (s *Store) migrateConnections(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var parsed []SavedConnection
	if json.Unmarshal(data, &parsed) != nil {
		return
	}
	var count int64
	s.db.Model(&connectionRow{}).Count(&count)
	if count == 0 {
		for _, c := range parsed {
			_ = s.UpsertConnection(c)
		}
	}
	_ = os.Remove(path)
}

func (s *Store) migratePlanetScaleToken(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	token := strings.TrimSpace(string(data))
	if token == "" {
		_ = os.Remove(path)
		return
	}
	// Guard by row existence so a previously cleared token doesn't get re-imported.
	var count int64
	s.db.Model(&connectedAccount{}).Where("provider = ?", PlanetScaleProvider).Count(&count)
	if count == 0 {
		_ = s.SetToken(PlanetScaleProvider, token)
	}
	_ = os.Remove(path)
}

// --- Settings ---

func (s *Store) GetSettings() AppSettings {
	s.settingsMu.RLock()
	if s.cachedSettings != nil {
		v := *s.cachedSettings
		s.settingsMu.RUnlock()
		return v
	}
	s.settingsMu.RUnlock()

	var row settingsRow
	if s.db.First(&row).Error != nil {
		return DefaultSettings
	}
	result := settingsFromRow(row)

	s.settingsMu.Lock()
	s.cachedSettings = &result
	s.settingsMu.Unlock()
	return result
}

func (s *Store) SaveSettings(settings AppSettings) error {
	if settings.QueryTimeoutSec <= 0 {
		settings.QueryTimeoutSec = DefaultSettings.QueryTimeoutSec
	}
	row := settingsRowFrom(settings)
	var existing settingsRow
	if s.db.First(&existing).Error != nil {
		err := s.db.Create(&row).Error
		if err == nil {
			s.invalidateSettingsCache()
		}
		return err
	}
	row.Model = existing.Model
	err := s.db.Save(&row).Error
	if err == nil {
		s.invalidateSettingsCache()
	}
	return err
}

func (s *Store) invalidateSettingsCache() {
	s.settingsMu.Lock()
	s.cachedSettings = nil
	s.settingsMu.Unlock()
}

func settingsRowFrom(a AppSettings) settingsRow {
	return settingsRow{
		RowDensity:        a.RowDensity,
		DefaultRowLimit:   a.DefaultRowLimit,
		QueryTimeoutSec:   a.QueryTimeoutSec,
		ConfirmDropTable:  a.ConfirmDropTable,
		ConfirmDeleteRows: a.ConfirmDeleteRows,
	}
}

func settingsFromRow(r settingsRow) AppSettings {
	return AppSettings{
		RowDensity:        r.RowDensity,
		DefaultRowLimit:   r.DefaultRowLimit,
		QueryTimeoutSec:   r.QueryTimeoutSec,
		ConfirmDropTable:  r.ConfirmDropTable,
		ConfirmDeleteRows: r.ConfirmDeleteRows,
	}
}

// --- Connections ---

func rowToConn(r connectionRow) SavedConnection {
	return SavedConnection{
		ID:               r.ID,
		Name:             r.Name,
		Driver:           r.Driver,
		ConnectionString: r.ConnectionString,
		PlanetScaleKey:   r.PlanetScaleKey,
	}
}

func (s *Store) ListConnections() []SavedConnection {
	var rows []connectionRow
	s.db.Find(&rows)
	out := make([]SavedConnection, len(rows))
	for i, r := range rows {
		out[i] = rowToConn(r)
	}
	return out
}

func (s *Store) FindConnection(id string) (*SavedConnection, error) {
	var row connectionRow
	if err := s.db.First(&row, "id = ?", id).Error; err != nil {
		return nil, err
	}
	c := rowToConn(row)
	return &c, nil
}

func (s *Store) FindConnectionByString(connectionString string) (*SavedConnection, error) {
	var row connectionRow
	if err := s.db.First(&row, "connection_string = ?", connectionString).Error; err != nil {
		return nil, err
	}
	c := rowToConn(row)
	return &c, nil
}

func (s *Store) FindConnectionByPlanetScaleKey(key string) (*SavedConnection, error) {
	var row connectionRow
	if err := s.db.First(&row, "planet_scale_key = ?", key).Error; err != nil {
		return nil, err
	}
	c := rowToConn(row)
	return &c, nil
}

// UpsertConnection inserts or replaces a connection by ID.
func (s *Store) UpsertConnection(conn SavedConnection) error {
	if conn.ID == "" {
		conn.ID = NewID()
	}
	return s.db.Save(&connectionRow{
		ID:               conn.ID,
		Name:             conn.Name,
		Driver:           conn.Driver,
		ConnectionString: conn.ConnectionString,
		PlanetScaleKey:   conn.PlanetScaleKey,
	}).Error
}

func (s *Store) DeleteConnection(id string) error {
	return s.db.Delete(&connectionRow{}, "id = ?", id).Error
}

// --- Connected accounts (OAuth tokens) ---

type ConnectedAccount struct {
	Token       string
	DisplayName string
	Email       string
}

func (s *Store) GetConnectedAccount(provider string) (ConnectedAccount, bool) {
	var row connectedAccount
	if err := s.db.First(&row, "provider = ?", provider).Error; err != nil {
		return ConnectedAccount{}, false
	}
	return ConnectedAccount{Token: row.Token, DisplayName: row.DisplayName, Email: row.Email}, true
}

func (s *Store) GetToken(provider string) string {
	acc, ok := s.GetConnectedAccount(provider)
	if !ok {
		return ""
	}
	return acc.Token
}

func (s *Store) SetToken(provider, token string) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "provider"}},
		DoUpdates: clause.AssignmentColumns([]string{"token", "display_name", "email"}),
	}).Create(&connectedAccount{Provider: provider, Token: token}).Error
}

func (s *Store) SetConnectedAccount(provider string, acc ConnectedAccount) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "provider"}},
		DoUpdates: clause.AssignmentColumns([]string{"token", "display_name", "email"}),
	}).Create(&connectedAccount{
		Provider:    provider,
		Token:       acc.Token,
		DisplayName: acc.DisplayName,
		Email:       acc.Email,
	}).Error
}

// --- Open tabs ---

func (s *Store) SaveTabs(tabs []SavedTab) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&openTab{}, "1=1").Error; err != nil {
			return err
		}
		if len(tabs) == 0 {
			return nil
		}
		rows := make([]openTab, len(tabs))
		for i, t := range tabs {
			rows[i] = openTab{
				ID:           t.ID,
				Kind:         t.Kind,
				ConnectionID: t.ConnectionID,
				SchemaName:   t.SchemaName,
				TabTable:     t.TableName,
				Name:         t.Name,
				Pinned:       t.Pinned,
				SortOrder:    i,
				SQLContent:   t.SQLContent,
				IsActive:     t.IsActive,
			}
		}
		return tx.Create(&rows).Error
	})
}

func (s *Store) LoadTabs() ([]SavedTab, error) {
	var rows []openTab
	if err := s.db.Order("sort_order").Find(&rows).Error; err != nil {
		return nil, err
	}
	tabs := make([]SavedTab, len(rows))
	for i, r := range rows {
		tabs[i] = SavedTab{
			ID:           r.ID,
			Kind:         r.Kind,
			ConnectionID: r.ConnectionID,
			SchemaName:   r.SchemaName,
			TableName:    r.TabTable,
			Name:         r.Name,
			Pinned:       r.Pinned,
			SortOrder:    r.SortOrder,
			SQLContent:   r.SQLContent,
			IsActive:     r.IsActive,
		}
	}
	return tabs, nil
}
