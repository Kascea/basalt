import { useEffect, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { Connection } from '../../bindings/basalt/db'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'
import type { AvailableConnection } from '../../bindings/basalt/providers/models'
import * as ProvidersService from '../../bindings/basalt/providers/service'
import { ConnectForm } from '../connection/ConnectForm'
import { DeleteConfirmModal } from '../ui/DeleteConfirmModal'
import { PasswordModal } from '../ui/PasswordModal'
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

function PSLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M-0.0981445 16C-0.0981438 7.16344 7.0653 -7.52254e-07 15.9019 0C22.399 5.67998e-07 27.9917 3.87258 30.4975 9.43544L9.3373 30.5956C8.42926 30.1866 7.56625 29.6953 6.75778 29.1313L19.8891 16H15.9019L4.58815 27.3137C1.69272 24.4183 -0.0981449 20.4183 -0.0981445 16Z" fill="currentColor" />
      <path d="M31.9019 16.0055L15.9074 32C24.7396 31.997 31.8989 24.8377 31.9019 16.0055Z" fill="currentColor" />
    </svg>
  )
}

function SBLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-43.151 54.347Z" fill="url(#sbc-a)" />
      <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-43.151 54.347Z" fill="url(#sbc-b)" fillOpacity=".2" />
      <path d="M45.317 2.071C48.177-1.53 53.976.443 54.044 5.041l.562 67.252H9.386c-8.19 0-12.758-9.46-7.665-15.875L45.317 2.071Z" fill="#3ECF8E" />
      <defs>
        <linearGradient id="sbc-a" x1="53.974" y1="40.063" x2="94.163" y2="52.409" gradientUnits="userSpaceOnUse">
          <stop stopColor="#249361" /><stop offset="1" stopColor="#3ECF8E" />
        </linearGradient>
        <linearGradient id="sbc-b" x1="36.156" y1="30.578" x2="54.484" y2="65.081" gradientUnits="userSpaceOnUse">
          <stop /><stop offset="1" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const PROVIDER_LOGO: Record<string, React.ReactNode> = {
  planetscale: <PSLogo />,
  supabase: <SBLogo />,
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

      {showForm && (
        <div className={styles.inlineForm}>
          <ConnectForm
            isConnecting={isConnecting === 'new'}
            onConnect={handleConnect}
          />
        </div>
      )}

      {/* Saved connections */}
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
                <span className={`${styles.connIcon}${!isConnected ? ` ${styles.connIconOff}` : ''}`}>
                  {saved.planetscaleKey
                    ? PROVIDER_LOGO.planetscale
                    : saved.supabaseKey
                    ? PROVIDER_LOGO.supabase
                    : '⬡'}
                </span>
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

      {/* Available provider connections */}
      <AvailableProviderConnections savedConnections={savedConnections} onConnect={onConnect} />

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

// ── Available provider connections ────────────────────────────────────────────

interface AvailableProps {
  savedConnections: SavedConnection[]
  onConnect: (name: string, driver: string, cs: string) => Promise<void>
}

function AvailableProviderConnections({ savedConnections, onConnect }: AvailableProps) {
  const [available, setAvailable] = useState<AvailableConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingKey, setConnectingKey] = useState<string | null>(null)
  const [passwordModal, setPasswordModal] = useState<AvailableConnection | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    ProvidersService.ListAvailable()
      .then(res => setAvailable(res ?? []))
      .catch(() => setAvailable([]))
      .finally(() => setLoading(false))
  }, [savedConnections.length])

  if (loading) {
    return (
      <div className={styles.psAvailable}>
        <div className={styles.psAvailableLabel}>Available Connections</div>
        <div className={styles.loadingRow}>
          <span className={styles.spinner} />
          <span className={styles.loadingText}>Finding available connections…</span>
        </div>
      </div>
    )
  }

  if (available.length === 0) return null

  const byProvider = available.reduce<Record<string, AvailableConnection[]>>((acc, ac) => {
    if (!acc[ac.Provider]) acc[ac.Provider] = []
    acc[ac.Provider].push(ac)
    return acc
  }, {})

  const handleConnect = async (ac: AvailableConnection, pwd = '') => {
    setConnectingKey(ac.Key)
    setError(null)
    try {
      const cs = await ProvidersService.Connect(ac, pwd)
      await onConnect(ac.Name, 'postgres', cs)
      setPasswordModal(null)
      setAvailable(prev => prev.filter(a => a.Key !== ac.Key))
    } catch (err) {
      setError(String(err).replace(/^Error:\s*/, ''))
    } finally {
      setConnectingKey(null)
    }
  }

  const PROVIDER_LABEL: Record<string, string> = {
    planetscale: 'PlanetScale',
    supabase: 'Supabase',
  }

  return (
    <>
      <div className={styles.psAvailable}>
        <div className={styles.psAvailableLabel}>Available Connections</div>
        {Object.entries(byProvider).map(([provider, items]) => (
          <div key={provider}>
            <div className={styles.providerSubLabel}>
              {PROVIDER_LOGO[provider]}
              {PROVIDER_LABEL[provider] ?? provider}
            </div>
            <div className={styles.connList}>
              {items.map(ac => {
                const isConnecting = connectingKey === ac.Key

                return (
                  <div key={ac.Key} className={styles.connRow}>
                    <span className={`${styles.connIcon} ${styles.connIconOff}`}>
                      {PROVIDER_LOGO[ac.Provider] ?? '⬡'}
                    </span>
                    <div className={styles.connInfo}>
                      <span className={styles.connName}>{ac.Name}</span>
                      <span className={styles.connMeta}>{ac.Meta}</span>
                    </div>
                    <div className={styles.connActions}>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        onClick={() => {
                          if (ac.NeedsPassword) {
                            setError(null)
                            setPasswordModal(ac)
                          } else {
                            handleConnect(ac)
                          }
                        }}
                        disabled={!!connectingKey}
                      >
                        {isConnecting ? 'Connecting…' : 'Connect'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {passwordModal && (
        <PasswordModal
          title={`Connect to ${passwordModal.Name}`}
          description={passwordModal.Meta || undefined}
          error={error}
          isConnecting={!!connectingKey}
          onConfirm={pwd => handleConnect(passwordModal, pwd)}
          onCancel={() => { setPasswordModal(null); setError(null) }}
        />
      )}
    </>
  )
}
