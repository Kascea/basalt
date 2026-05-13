import type { Connection, SavedConnection } from '../../../bindings/basalt'

interface Props {
  savedConnections: SavedConnection[]
  connections: Connection[]
  isConnecting: string | null
  onNewConnection: () => void
  onReconnect: (id: string) => void
  onDisconnect: (id: string) => void
  onEdit: (conn: SavedConnection) => void
  onDelete: (id: string) => void
}

export function SettingsConnections({
  savedConnections, connections, isConnecting,
  onNewConnection, onReconnect, onDisconnect, onEdit, onDelete,
}: Props) {
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <div>
          <h2 className="settings-section-title">Connections</h2>
          <p className="settings-section-desc">Manage your saved database connections.</p>
        </div>
        <button className="settings-new-btn" onClick={onNewConnection}>+ New Connection</button>
      </div>

      {savedConnections.length === 0 ? (
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
