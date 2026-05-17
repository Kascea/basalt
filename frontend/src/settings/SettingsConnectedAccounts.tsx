import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import * as PlanetScaleService from '../../bindings/basalt/planetscale/service'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'
import type { User as PSUser, Database as PSDatabase } from '../../bindings/basalt/planetscale/models'
import { DeleteConfirmModal } from '../ui/DeleteConfirmModal'
import { ConfirmModal } from '../ui/ConfirmModal'
import styles from './settings.module.css'

interface Props {
  savedConnections: SavedConnection[]
  onDeleteSaved: (id: string) => void
  onConnect: (name: string, driver: string, connectionString: string, planetscaleKey?: string) => Promise<void>
}

function PSLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M-0.0981445 16C-0.0981438 7.16344 7.0653 -7.52254e-07 15.9019 0C22.399 5.67998e-07 27.9917 3.87258 30.4975 9.43544L9.3373 30.5956C8.42926 30.1866 7.56625 29.6953 6.75778 29.1313L19.8891 16H15.9019L4.58815 27.3137C1.69272 24.4183 -0.0981449 20.4183 -0.0981445 16Z" fill="white" />
      <path d="M31.9019 16.0055L15.9074 32C24.7396 31.997 31.8989 24.8377 31.9019 16.0055Z" fill="white" />
    </svg>
  )
}

export function SettingsConnectedAccounts({ savedConnections, onDeleteSaved, onConnect }: Props) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Connected Accounts</h2>
      <p className={styles.sectionDesc}>Manage third-party database providers connected to Basalt.</p>

      <div className={styles.fields}>
        <PlanetScaleAccount savedConnections={savedConnections} onDeleteSaved={onDeleteSaved} onConnect={onConnect} />
      </div>
    </div>
  )
}

function PlanetScaleAccount({ savedConnections, onDeleteSaved, onConnect }: Props) {
  const [user, setUser] = useState<PSUser | null>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [psDatabases, setPSDatabases] = useState<PSDatabase[]>([])
  const [loadingDbs, setLoadingDbs] = useState(false)
  const [connectingDb, setConnectingDb] = useState<string | null>(null)
  const [dbConnectError, setDbConnectError] = useState<string | null>(null)

  const psConnections = savedConnections.filter(s => s.planetscaleKey && s.planetscaleKey !== '')

  const savedKeyFor = (db: PSDatabase) =>
    psConnections.find(c => c.planetscaleKey === `${db.Org}/${db.Name}/${db.Branch}`)

  const loadDatabases = async () => {
    setLoadingDbs(true)
    try {
      const dbs = await PlanetScaleService.ListDatabases()
      setPSDatabases(dbs ?? [])
    } catch {
      setPSDatabases([])
    } finally {
      setLoadingDbs(false)
    }
  }

  const loadAccountState = () => {
    return Promise.all([
      PlanetScaleService.GetUser().then(u => setUser(u)).catch(() => setUser(null)),
      PlanetScaleService.IsSignedIn().then(async (signedIn) => {
        setIsSignedIn(signedIn)
        if (signedIn) await loadDatabases()
      }).catch(() => setIsSignedIn(false)),
    ])
  }

  useEffect(() => {
    loadAccountState().finally(() => setLoading(false))
  }, [])

  const handleConnect = () => {
    setConnecting(true)
    setConnectError(null)
    PlanetScaleService.StartAuth()
      .then(() => loadAccountState())
      .catch(err => setConnectError(String(err)))
      .finally(() => setConnecting(false))
  }

  const handleSignOut = () => {
    setSigningOut(true)
    setConfirmSignOut(false)
    PlanetScaleService.SignOut()
      .then(() => {
        setUser(null)
        setIsSignedIn(false)
        setPSDatabases([])
        psConnections.forEach(conn => onDeleteSaved(conn.id))
      })
      .finally(() => setSigningOut(false))
  }

  const handleConnectDb = async (db: PSDatabase) => {
    const key = `${db.Org}/${db.Name}/${db.Branch}`
    setConnectingDb(key)
    setDbConnectError(null)
    try {
      const cs = await PlanetScaleService.GetConnectionString(db.Org, db.Name, db.Branch, db.Kind)
      await onConnect(db.Name, 'postgres', cs, key)
    } catch (err) {
      setDbConnectError(String(err).replace(/^Error:\s*/, ''))
    } finally {
      setConnectingDb(null)
    }
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
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.identity}>
            <span className={styles.logo}>
              <PSLogo size={16} />
            </span>
            <span>PlanetScale</span>
          </div>

          {loading ? (
            <span className={styles.status}>Loading…</span>
          ) : isSignedIn ? (
            <button
              className={styles.signout}
              onClick={() => setConfirmSignOut(true)}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          ) : (
            <button
              className={styles.connect}
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>

        {user && (
          <div className={styles.user}>
            <span className={styles.userName}>{user.DisplayName}</span>
            <span className={styles.userEmail}>{user.Email}</span>
          </div>
        )}

        {!loading && !isSignedIn && (
          <p className={styles.acctEmpty}>
            {connectError ?? 'Not connected. Click Connect to sign in with PlanetScale.'}
          </p>
        )}

        {isSignedIn && (
          <div className={styles.dbs}>
            <div className={styles.dbsLabel}>Databases</div>

            {loadingDbs ? (
              <p className={styles.acctEmpty}>Loading databases…</p>
            ) : psDatabases.length === 0 ? (
              <p className={styles.acctEmpty}>No databases found in your PlanetScale account.</p>
            ) : (
              <ul className={styles.dbList}>
                {psDatabases.map(db => {
                  const saved = savedKeyFor(db)
                  const key = `${db.Org}/${db.Name}/${db.Branch}`
                  const isConnecting = connectingDb === key

                  return (
                    <li key={key} className={styles.dbRow}>
                      <div className={styles.dbInfo}>
                        <span className={styles.dbName}>{db.Name}</span>
                        <span className={styles.dbMeta}>{db.Org} · {db.Branch}</span>
                      </div>
                      {saved ? (
                        <div className={styles.dbActions}>
                          <span className={`${styles.badge} ${styles.badgeOn}`}>Connected</span>
                          <button
                            className={styles.dbRemove}
                            onClick={() => setConfirmDeleteId(saved.id)}
                            title="Remove connection"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                          onClick={() => handleConnectDb(db)}
                          disabled={isConnecting || !!connectingDb}
                        >
                          {isConnecting ? 'Connecting…' : 'Connect'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {dbConnectError && <div className="connect-error">{dbConnectError}</div>}
          </div>
        )}
      </div>

      {confirmSignOut && (
        <ConfirmModal
          message="Are you sure you want to sign out of PlanetScale? This will disconnect all databases currently using this account."
          confirmLabel="Sign out"
          onConfirm={handleSignOut}
          onCancel={() => setConfirmSignOut(false)}
        />
      )}

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
