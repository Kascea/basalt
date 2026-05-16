import { useEffect, useState } from 'react'
import * as PlanetScaleService from '../../../bindings/basalt/planetscale/service'
import type { SavedConnection } from '../../../bindings/basalt/localdb/models'
import type { User as PSUser } from '../../../bindings/basalt/planetscale/models'
import { DeleteConfirmModal } from '../DeleteConfirmModal'

interface Props {
  savedConnections: SavedConnection[]
  onDeleteSaved: (id: string) => void
}

function PSLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M-0.0981445 16C-0.0981438 7.16344 7.0653 -7.52254e-07 15.9019 0C22.399 5.67998e-07 27.9917 3.87258 30.4975 9.43544L9.3373 30.5956C8.42926 30.1866 7.56625 29.6953 6.75778 29.1313L19.8891 16H15.9019L4.58815 27.3137C1.69272 24.4183 -0.0981449 20.4183 -0.0981445 16Z" fill="white" />
      <path d="M31.9019 16.0055L15.9074 32C24.7396 31.997 31.8989 24.8377 31.9019 16.0055Z" fill="white" />
    </svg>
  )
}

export function SettingsConnectedAccounts({ savedConnections, onDeleteSaved }: Props) {
  return (
    <div className="settings-section">
      <h2 className="settings-section-title">Connected Accounts</h2>
      <p className="settings-section-desc">Manage third-party database providers connected to Basalt.</p>

      <div className="settings-fields">
        <PlanetScaleAccount savedConnections={savedConnections} onDeleteSaved={onDeleteSaved} />
      </div>
    </div>
  )
}

function PlanetScaleAccount({ savedConnections, onDeleteSaved }: Props) {
  const [user, setUser] = useState<PSUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const psConnections = savedConnections.filter(s => s.planetscaleKey && s.planetscaleKey !== '')

  useEffect(() => {
    PlanetScaleService.GetUser()
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const handleSignOut = () => {
    setSigningOut(true)
    PlanetScaleService.SignOut()
      .then(() => setUser(null))
      .finally(() => setSigningOut(false))
  }

  const formatPSKey = (key: string) => {
    const [org, db, branch] = key.split('/')
    return { org, db, branch }
  }

  const pendingConn = confirmDeleteId
    ? psConnections.find(c => c.id === confirmDeleteId)
    : null

  return (
    <>
      <div className="connected-account-card">
        <div className="connected-account-header">
          <div className="connected-account-identity">
            <span className="connected-account-logo">
              <PSLogo size={16} />
            </span>
            <span className="connected-account-name">PlanetScale</span>
          </div>

          {loading ? (
            <span className="connected-account-status">Loading…</span>
          ) : user ? (
            <button
              className="connected-account-signout"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          ) : (
            <span className="connected-account-status is-disconnected">Not connected</span>
          )}
        </div>

        {user && (
          <div className="connected-account-user">
            <span className="connected-account-user-name">{user.DisplayName}</span>
            <span className="connected-account-user-email">{user.Email}</span>
          </div>
        )}

        {user && (
          <div className="connected-account-dbs">
            <div className="connected-account-dbs-label">Connected databases</div>
            {psConnections.length === 0 ? (
              <p className="connected-account-empty">No databases connected yet. Use the connect form to add one.</p>
            ) : (
              <ul className="connected-account-db-list">
                {psConnections.map(conn => {
                  const { org, db, branch } = formatPSKey(conn.planetscaleKey!)
                  return (
                    <li key={conn.id} className="connected-account-db-row">
                      <div className="connected-account-db-info">
                        <span className="connected-account-db-name">{db}</span>
                        <span className="connected-account-db-meta">{org} · {branch}</span>
                      </div>
                      <button
                        className="connected-account-db-remove"
                        onClick={() => setConfirmDeleteId(conn.id)}
                        title="Remove connection"
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {confirmDeleteId && pendingConn && (() => {
        const { db } = formatPSKey(pendingConn.planetscaleKey!)
        return (
          <DeleteConfirmModal
            message={`Remove "${db}"? The saved credentials will be deleted.`}
            confirmText={db}
            onConfirm={() => { onDeleteSaved(confirmDeleteId); setConfirmDeleteId(null) }}
            onCancel={() => setConfirmDeleteId(null)}
          />
        )
      })()}
    </>
  )
}
