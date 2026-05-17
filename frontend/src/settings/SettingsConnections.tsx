import { useEffect, useState } from 'react'
import type { Connection } from '../../bindings/basalt/db'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'
import type { Database as PSDatabase } from '../../bindings/basalt/planetscale/models'
import * as PlanetScaleService from '../../bindings/basalt/planetscale/service'
import { ConnectForm } from '../connection/ConnectForm'

interface Props {
  savedConnections: SavedConnection[]
  connections: Connection[]
  isConnecting: string | null
  onConnect: (name: string, driver: string, connectionString: string, planetscaleKey?: string) => Promise<void>
  onReconnect: (id: string) => void
  onDisconnect: (id: string) => void
  onEdit: (conn: SavedConnection) => void
  onDelete: (id: string) => void
}

export function SettingsConnections({
  savedConnections, connections, isConnecting,
  onConnect, onReconnect, onDisconnect, onEdit, onDelete,
}: Props) {
  const [showForm, setShowForm] = useState(false)

  const handleConnect = (name: string, driver: string, connectionString: string, planetscaleKey?: string) =>
    onConnect(name, driver, connectionString, planetscaleKey).then(() => setShowForm(false))

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <div>
          <h2 className="settings-section-title">Connections</h2>
          <p className="settings-section-desc">Manage your saved database connections.</p>
        </div>
        <button className="settings-new-btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Manual Connection'}
        </button>
      </div>

      {/* PlanetScale databases — always visible when signed in with available databases */}
      <AvailablePSConnections savedConnections={savedConnections} onConnect={handleConnect} />

      {showForm && (
        <div className="settings-inline-form">
          <ConnectForm
            isConnecting={isConnecting === 'new'}
            onConnect={handleConnect}
          />
        </div>
      )}

      {savedConnections.length === 0 && !showForm ? (
        <p className="settings-empty">No connections saved yet.</p>
      ) : (
        <div className="settings-conn-list">
          {savedConnections.map((saved) => {
            const live = connections.find((c) => c.id === saved.id)
            const isConnected = !!live
            const loading = isConnecting === saved.id

            return (
              <div key={saved.id} className="settings-conn-row">
                <span className={`settings-conn-icon${!isConnected ? ' settings-conn-icon--off' : ''}`}>⬡</span>
                <div className="settings-conn-info">
                  <span className="settings-conn-name">{live?.name ?? saved.name}</span>
                  {live && (
                    <span className="settings-conn-meta">
                      {[live.user, live.host, live.database].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  <span className="settings-conn-driver">{saved.driver}</span>
                </div>
                <div className="settings-conn-status">
                  {isConnected ? (
                    <span className="conn-badge conn-badge--on">Connected</span>
                  ) : loading ? (
                    <span className="conn-badge conn-badge--loading">Connecting…</span>
                  ) : (
                    <span className="conn-badge conn-badge--off">Disconnected</span>
                  )}
                </div>
                <div className="settings-conn-actions">
                  {isConnected ? (
                    <button className="settings-action-btn" onClick={() => onDisconnect(saved.id)}>Disconnect</button>
                  ) : (
                    <button className="settings-action-btn settings-action-btn--primary" onClick={() => onReconnect(saved.id)} disabled={!!loading}>
                      Connect
                    </button>
                  )}
                  <button className="settings-action-btn" onClick={() => onEdit(saved)}>Edit</button>
                  <button className="settings-action-btn settings-action-btn--danger" onClick={() => onDelete(saved.id)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Available PlanetScale connections ─────────────────────────────────────────

function PSLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M-0.0981445 16C-0.0981438 7.16344 7.0653 -7.52254e-07 15.9019 0C22.399 5.67998e-07 27.9917 3.87258 30.4975 9.43544L9.3373 30.5956C8.42926 30.1866 7.56625 29.6953 6.75778 29.1313L19.8891 16H15.9019L4.58815 27.3137C1.69272 24.4183 -0.0981449 20.4183 -0.0981445 16Z" fill="currentColor" />
      <path d="M31.9019 16.0055L15.9074 32C24.7396 31.997 31.8989 24.8377 31.9019 16.0055Z" fill="currentColor" />
    </svg>
  )
}

interface AvailablePSProps {
  savedConnections: SavedConnection[]
  onConnect: (name: string, driver: string, cs: string, psKey: string) => Promise<void>
}

function AvailablePSConnections({ savedConnections, onConnect }: AvailablePSProps) {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [databases, setDatabases] = useState<PSDatabase[]>([])
  const [connectingKey, setConnectingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const savedKeys = new Set(
    savedConnections.filter(c => c.planetscaleKey).map(c => c.planetscaleKey!)
  )
  const availableDbs = databases.filter(db => !savedKeys.has(`${db.Org}/${db.Name}/${db.Branch}`))

  useEffect(() => {
    PlanetScaleService.IsSignedIn()
      .then(async (signedIn) => {
        setIsSignedIn(signedIn)
        if (signedIn) {
          const dbs = await PlanetScaleService.ListDatabases()
          setDatabases(dbs ?? [])
        }
      })
      .catch(() => {})
  }, [])

  if (!isSignedIn || availableDbs.length === 0) return null

  const handleConnect = async (db: PSDatabase) => {
    const key = `${db.Org}/${db.Name}/${db.Branch}`
    setConnectingKey(key)
    setError(null)
    try {
      const cs = await PlanetScaleService.GetConnectionString(db.Org, db.Name, db.Branch, db.Kind)
      await onConnect(db.Name, 'postgres', cs, key)
    } catch (err) {
      setError(String(err).replace(/^Error:\s*/, ''))
    } finally {
      setConnectingKey(null)
    }
  }

  return (
    <div className="settings-ps-available">
      <div className="settings-ps-available-label">
        <PSLogo />
        PlanetScale
      </div>
      <div className="settings-conn-list">
        {availableDbs.map(db => {
          const key = `${db.Org}/${db.Name}/${db.Branch}`
          return (
            <div key={key} className="settings-conn-row">
              <span className="settings-conn-icon settings-conn-icon--off">⬡</span>
              <div className="settings-conn-info">
                <span className="settings-conn-name">{db.Name}</span>
                <span className="settings-conn-meta">{db.Org} · {db.Branch}</span>
              </div>
              <div className="settings-conn-status">
                <span className="conn-badge conn-badge--off">Not connected</span>
              </div>
              <div className="settings-conn-actions">
                <button
                  className="settings-action-btn settings-action-btn--primary"
                  onClick={() => handleConnect(db)}
                  disabled={!!connectingKey}
                >
                  {connectingKey === key ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {error && <div className="connect-error">{error}</div>}
    </div>
  )
}
