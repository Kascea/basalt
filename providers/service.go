package providers

import (
	"fmt"

	"basalt/localdb"
	"basalt/providers/planetscale"
	"basalt/providers/supabase"
)

// AvailableConnection is a provider-hosted database not yet saved locally.
type AvailableConnection struct {
	Provider      string // "planetscale" | "supabase"
	Key           string // provider-specific unique key (ref or org/name/branch)
	Name          string
	Meta          string // e.g. "myorg · main" or "us-west-1"
	NeedsPassword bool

	// Internal params used by Connect — opaque to the frontend.
	Org    string
	Branch string
	Kind   string
}

// Service aggregates provider accounts and exposes a unified connection API.
type Service struct {
	store *localdb.Store
	ps    *planetscale.Service
	sb    *supabase.Service

	OnConnectionsChanged func()
}

func NewService(store *localdb.Store, ps *planetscale.Service, sb *supabase.Service) *Service {
	return &Service{store: store, ps: ps, sb: sb}
}

// ListAvailable returns all provider databases/projects that are not yet saved as connections.
func (s *Service) ListAvailable() ([]AvailableConnection, error) {
	saved := s.store.ListConnections()
	psKeys := make(map[string]bool, len(saved))
	sbKeys := make(map[string]bool, len(saved))
	for _, c := range saved {
		if c.PlanetScaleKey != "" {
			psKeys[c.PlanetScaleKey] = true
		}
		if c.SupabaseKey != "" {
			sbKeys[c.SupabaseKey] = true
		}
	}

	var result []AvailableConnection

	if s.ps.IsSignedIn() {
		dbs, err := s.ps.ListDatabases()
		if err == nil {
			for _, db := range dbs {
				key := db.Org + "/" + db.Name + "/" + db.Branch
				if !psKeys[key] {
					result = append(result, AvailableConnection{
						Provider:      "planetscale",
						Key:           key,
						Name:          db.Name,
						Meta:          db.Org + " · " + db.Branch,
						NeedsPassword: false,
						Org:           db.Org,
						Branch:        db.Branch,
						Kind:          string(db.Kind),
					})
				}
			}
		}
	}

	if s.sb.IsSignedIn() {
		projects, err := s.sb.ListProjects()
		if err == nil {
			for _, p := range projects {
				if !sbKeys[p.Ref] {
					result = append(result, AvailableConnection{
						Provider:      "supabase",
						Key:           p.Ref,
						Name:          p.Name,
						Meta:          p.Region,
						NeedsPassword: true,
					})
				}
			}
		}
	}

	return result, nil
}

// Connect fetches (or reuses) a connection string for the given available connection.
// password is only used for Supabase; pass "" for PlanetScale.
func (s *Service) Connect(ac AvailableConnection, password string) (string, error) {
	switch ac.Provider {
	case "planetscale":
		return s.ps.GetConnectionString(ac.Org, ac.Name, ac.Branch, ac.Kind)
	case "supabase":
		return s.sb.GetConnectionString(ac.Key, ac.Name, password)
	default:
		return "", fmt.Errorf("unknown provider: %s", ac.Provider)
	}
}

func (s *Service) notifyConnectionsChanged() {
	if s.OnConnectionsChanged != nil {
		go s.OnConnectionsChanged()
	}
}
