import { useEffect, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { Connection } from '../../bindings/basalt/db'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'
import type { Database as PSDatabase } from '../../bindings/basalt/planetscale/models'
import * as PlanetScaleService from '../../bindings/basalt/planetscale/service'
import { ConnectForm } from '../connection/ConnectForm'
import { DeleteConfirmModal } from '../ui/DeleteConfirmModal'
import styles from './settings.module.css'

interface Props {
  savedConnections: SavedConnection[]
  connections: Connection[]
  isConnecting: string | null
  onConnect: (name: string, driver: string, connectionString: string, planetscaleKey?: string) => Promise<void>
  onReconnect: (id: string) => void
  onDisconnect: (id: string) => void
  onEdit: (conn: SavedConnection) => void
  onDelete: (id: string) => void
  onOpen: (id: string) => void
}

export function SettingsConnections({
  savedConnections, connections, isConnecting,
  onConnect, onReconnect, onDisconnect, onEdit, onDelete, onOpen,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    if (!openMenuId) return
    const close = () => setOpenMenuId(null)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [openMenuId])

  const handleConnect = (name: string, driver: string, connectionString: string, planetscaleKey?: string) =>
    onConnect(name, driver, connectionString, planetscaleKey).then(() => setShowForm(false))

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Connections</h2>
          <p className={styles.sectionDesc}>Manage your saved database connections.</p>
        </div>
        <button className={styles.newBtn} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Manual Connection'}
        </button>
      </div>

      {/* PlanetScale databases — always visible when signed in with available databases */}
      <AvailablePSConnections savedConnections={savedConnections} onConnect={handleConnect} />

      {showForm && (
        <div className={styles.inlineForm}>
          <ConnectForm
            isConnecting={isConnecting === 'new'}
            onConnect={handleConnect}
          />
        </div>
      )}

      {savedConnections.length === 0 && !showForm ? (
        <p className={styles.empty}>No connections saved yet.</p>
      ) : (
        <div className={styles.connList}>
          {savedConnections.map((saved) => {
            const live = connections.find((c) => c.id === saved.id)
            const isConnected = !!live
            const loading = isConnecting === saved.id
            const menuOpen = openMenuId === saved.id

            return (
              <div key={saved.id} className={styles.connRow}>
                <span className={`${styles.connIcon}${!isConnected ? ` ${styles.connIconOff}` : ''}`}>⬡</span>
                <div className={styles.connInfo}>
                  <span className={styles.connName}>{live?.name ?? saved.name}</span>
                  {live && (
                    <span className={styles.connMeta}>
                      {[live.user, live.host, live.database].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  <span className={styles.connDriver}>{saved.driver}</span>
                </div>
                <div className={styles.connStatus}>
                  {isConnected ? (
                    <span className={`${styles.badge} ${styles.badgeOn}`}>Connected</span>
                  ) : loading ? (
                    <span className={`${styles.badge} ${styles.badgeLoading}`}>Connecting…</span>
                  ) : (
                    <span className={`${styles.badge} ${styles.badgeOff}`}>Disconnected</span>
                  )}
                </div>
                <div className={styles.connActions}>
                  <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={() => onOpen(saved.id)}>
                    Open
                  </button>
                  <div className={styles.connMenu} onPointerDown={e => e.stopPropagation()}>
                    <button
                      className={`${styles.actionBtn} ${styles.menuBtn}${menuOpen ? ` ${styles.menuBtnActive}` : ''}`}
                      onClick={() => setOpenMenuId(menuOpen ? null : saved.id)}
                      aria-label="More actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {menuOpen && (
                      <div className={styles.dropdown}>
                        {isConnected ? (
                          <button className={styles.dropdownItem} onClick={() => { onDisconnect(saved.id); setOpenMenuId(null) }}>
                            Disconnect
                          </button>
                        ) : (
                          <button className={styles.dropdownItem} disabled={!!loading} onClick={() => { onReconnect(saved.id); setOpenMenuId(null) }}>
                            {loading ? 'Connecting…' : 'Connect'}
                          </button>
                        )}
                        <button className={styles.dropdownItem} onClick={() => { onEdit(saved); setOpenMenuId(null) }}>
                          Edit
                        </button>
                        <div className={styles.dropdownDivider} />
                        <button
                          className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                          onClick={() => { setPendingDelete({ id: saved.id, name: saved.name }); setOpenMenuId(null) }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pendingDelete && (
        <DeleteConfirmModal
          message={`Remove "${pendingDelete.name}"? The saved credentials will be deleted.`}
          confirmText={pendingDelete.name}
          confirmLabel="Delete"
          onConfirm={() => { onDelete(pendingDelete.id); setPendingDelete(null) }}
          onCancel={() => setPendingDelete(null)}
        />
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
    <div className={styles.psAvailable}>
      <div className={styles.psAvailableLabel}>
        <PSLogo />
        PlanetScale
      </div>
      <div className={styles.connList}>
        {availableDbs.map(db => {
          const key = `${db.Org}/${db.Name}/${db.Branch}`
          return (
            <div key={key} className={styles.connRow}>
              <span className={`${styles.connIcon} ${styles.connIconOff}`}>⬡</span>
              <div className={styles.connInfo}>
                <span className={styles.connName}>{db.Name}</span>
                <span className={styles.connMeta}>{db.Org} · {db.Branch}</span>
              </div>
              <div className={styles.connStatus}>
                <span className={`${styles.badge} ${styles.badgeOff}`}>Not connected</span>
              </div>
              <div className={styles.connActions}>
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
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
