package localdb

import (
	"os"
	"path/filepath"
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
	SupabaseKey      string `gorm:"index"`
	SortOrder        int
}

func (connectionRow) TableName() string { return "connections" }

type connectedAccount struct {
	gorm.Model
	Provider     string `gorm:"uniqueIndex"`
	Token        string
	RefreshToken string
	DisplayName  string
	Email        string
}

func (connectedAccount) TableName() string { return "connected_accounts" }

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

	if err := gormDB.AutoMigrate(&settingsRow{}, &connectionRow{}, &connectedAccount{}); err != nil {
		return nil, err
	}

	return &Store{db: gormDB}, nil
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
		SupabaseKey:      r.SupabaseKey,
	}
}

func (s *Store) ListConnections() []SavedConnection {
	var rows []connectionRow
	s.db.Order("sort_order").Find(&rows)
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
// For existing rows the SortOrder is preserved; new rows are appended at the end.
func (s *Store) UpsertConnection(conn SavedConnection) error {
	if conn.ID == "" {
		conn.ID = NewID()
	}
	row := connectionRow{
		ID:               conn.ID,
		Name:             conn.Name,
		Driver:           conn.Driver,
		ConnectionString: conn.ConnectionString,
		PlanetScaleKey:   conn.PlanetScaleKey,
		SupabaseKey:      conn.SupabaseKey,
	}
	var existing connectionRow
	if s.db.First(&existing, "id = ?", conn.ID).Error == nil {
		row.SortOrder = existing.SortOrder
	} else {
		var maxOrder int
		s.db.Model(&connectionRow{}).Select("COALESCE(MAX(sort_order), -1)").Scan(&maxOrder)
		row.SortOrder = maxOrder + 1
	}
	return s.db.Save(&row).Error
}

func (s *Store) FindConnectionBySupabaseKey(key string) (*SavedConnection, error) {
	var row connectionRow
	if err := s.db.First(&row, "supabase_key = ?", key).Error; err != nil {
		return nil, err
	}
	c := rowToConn(row)
	return &c, nil
}

func (s *Store) DeleteConnection(id string) error {
	return s.db.Delete(&connectionRow{}, "id = ?", id).Error
}

// ReorderConnections sets sort_order on each connection according to the given ID slice.
func (s *Store) ReorderConnections(ids []string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for i, id := range ids {
			if err := tx.Model(&connectionRow{}).Where("id = ?", id).Update("sort_order", i).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// --- Connected accounts (OAuth tokens) ---

type ConnectedAccount struct {
	Token        string
	RefreshToken string
	DisplayName  string
	Email        string
}

func (s *Store) GetConnectedAccount(provider string) (ConnectedAccount, bool) {
	var row connectedAccount
	if err := s.db.First(&row, "provider = ?", provider).Error; err != nil {
		return ConnectedAccount{}, false
	}
	return ConnectedAccount{Token: row.Token, RefreshToken: row.RefreshToken, DisplayName: row.DisplayName, Email: row.Email}, true
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
		DoUpdates: clause.AssignmentColumns([]string{"token", "refresh_token", "display_name", "email"}),
	}).Create(&connectedAccount{
		Provider:     provider,
		Token:        acc.Token,
		RefreshToken: acc.RefreshToken,
		DisplayName:  acc.DisplayName,
		Email:        acc.Email,
	}).Error
}

