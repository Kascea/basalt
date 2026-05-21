package localdb

import "errors"

// Service is the Wails service for all app-level persistence: settings and
// saved connection profiles, backed by the GORM SQLite store.
type Service struct {
	store                *Store
	OnConnectionsChanged func()
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

// --- Settings ---

func (s *Service) GetSettings() AppSettings {
	return s.store.GetSettings()
}

func (s *Service) SaveSettings(settings AppSettings) error {
	return s.store.SaveSettings(settings)
}

// --- Saved connections ---

// ListSavedConnections returns all persisted connection profiles.
func (s *Service) ListSavedConnections() []SavedConnection {
	return s.store.ListConnections()
}

// DeleteSavedConnection removes a saved connection by ID.
func (s *Service) DeleteSavedConnection(id string) error {
	if err := s.store.DeleteConnection(id); err != nil {
		return err
	}
	s.notifyConnectionsChanged()
	return nil
}

// UpdateSavedConnection persists changes to an existing connection.
func (s *Service) UpdateSavedConnection(conn SavedConnection) error {
	if _, err := s.store.FindConnection(conn.ID); err != nil {
		return errors.New("connection not found")
	}
	return s.store.UpsertConnection(conn)
}

// ReorderConnections persists a new display order for connections.
func (s *Service) ReorderConnections(ids []string) error {
	return s.store.ReorderConnections(ids)
}

func (s *Service) notifyConnectionsChanged() {
	if s.OnConnectionsChanged != nil {
		go s.OnConnectionsChanged()
	}
}
