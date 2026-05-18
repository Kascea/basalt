import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import * as PlanetScaleService from '../../bindings/basalt/providers/planetscale/service'
import * as SupabaseService from '../../bindings/basalt/providers/supabase/service'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'
import type { User as PSUser, Database as PSDatabase } from '../../bindings/basalt/providers/planetscale/models'
import type { User as SBUser, Project as SBProject } from '../../bindings/basalt/providers/supabase/models'
import { DeleteConfirmModal } from '../ui/DeleteConfirmModal'
import { ConfirmModal } from '../ui/ConfirmModal'
import { PasswordModal } from '../ui/PasswordModal'
import { parseError } from '../lib/parseError'
import styles from './settings.module.css'

interface Props {
  savedConnections: SavedConnection[]
  onDeleteSaved: (id: string) => void
  onConnect: (name: string, driver: string, connectionString: string, planetscaleKey?: string, supabaseKey?: string) => Promise<void>
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
        <SupabaseAccount savedConnections={savedConnections} onDeleteSaved={onDeleteSaved} onConnect={onConnect} />
      </div>
    </div>
  )
}

function SBLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-43.151 54.347Z" fill="url(#a)" />
      <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-43.151 54.347Z" fill="url(#b)" fillOpacity=".2" />
      <path d="M45.317 2.071C48.177-1.53 53.976.443 54.044 5.041l.562 67.252H9.386c-8.19 0-12.758-9.46-7.665-15.875L45.317 2.071Z" fill="#3ECF8E" />
      <defs>
        <linearGradient id="a" x1="53.974" y1="40.063" x2="94.163" y2="52.409" gradientUnits="userSpaceOnUse">
          <stop stopColor="#249361" />
          <stop offset="1" stopColor="#3ECF8E" />
        </linearGradient>
        <linearGradient id="b" x1="36.156" y1="30.578" x2="54.484" y2="65.081" gradientUnits="userSpaceOnUse">
          <stop />
          <stop offset="1" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function PlanetScaleAccount({ savedConnections, onDeleteSaved, onConnect }: Props) {
  const [user, setUser] = useState<PSUser | null>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
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
    loadAccountState()
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
    setConfirmSignOut(false)
    setUser(null)
    setIsSignedIn(false)
    setPSDatabases([])
    psConnections.forEach(conn => onDeleteSaved(conn.id))
    PlanetScaleService.SignOut().catch(() => {})
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

          {isSignedIn ? (
            <button className={styles.signout} onClick={() => setConfirmSignOut(true)}>
              Sign out
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

        {!isSignedIn && (
          <p className={styles.acctEmpty}>
            {connectError ?? 'Not connected. Click Connect to sign in with PlanetScale.'}
          </p>
        )}

        {isSignedIn && (
          <div className={styles.dbs}>
            <div className={styles.dbsLabel}>Databases</div>

            {loadingDbs ? (
              <div className={styles.loadingRow}>
                <span className={styles.spinner} />
                <span className={styles.loadingText}>Loading databases…</span>
              </div>
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

function SupabaseAccount({ savedConnections, onDeleteSaved, onConnect }: Props) {
  const [user, setUser] = useState<SBUser | null>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [sbProjects, setSBProjects] = useState<SBProject[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [connectingProject, setConnectingProject] = useState<string | null>(null)
  const [projectConnectError, setProjectConnectError] = useState<string | null>(null)
  const [passwordProject, setPasswordProject] = useState<SBProject | null>(null)

  const sbConnections = savedConnections.filter(s => s.supabaseKey && s.supabaseKey !== '')

  const savedKeyFor = (project: SBProject) =>
    sbConnections.find(c => c.supabaseKey === project.Ref)

  const loadProjects = async () => {
    setLoadingProjects(true)
    try {
      const projects = await SupabaseService.ListProjects()
      setSBProjects(projects ?? [])
    } catch {
      setSBProjects([])
    } finally {
      setLoadingProjects(false)
    }
  }

  const loadAccountState = () => {
    return Promise.all([
      SupabaseService.GetUser().then(u => setUser(u)).catch(() => setUser(null)),
      SupabaseService.IsSignedIn().then(async (signedIn) => {
        setIsSignedIn(signedIn)
        if (signedIn) await loadProjects()
      }).catch(() => setIsSignedIn(false)),
    ])
  }

  useEffect(() => {
    loadAccountState()
  }, [])

  const handleConnect = () => {
    setConnecting(true)
    setConnectError(null)
    SupabaseService.StartAuth()
      .then(() => loadAccountState())
      .catch(err => setConnectError(String(err)))
      .finally(() => setConnecting(false))
  }

  const handleSignOut = () => {
    setConfirmSignOut(false)
    setUser(null)
    setIsSignedIn(false)
    setSBProjects([])
    sbConnections.forEach(conn => onDeleteSaved(conn.id))
    SupabaseService.SignOut().catch(() => {})
  }

  const handleConnectProject = async (project: SBProject, pwd: string) => {
    setConnectingProject(project.Ref)
    setProjectConnectError(null)
    try {
      const cs = await SupabaseService.GetConnectionString(project.Ref, project.Name, pwd)
      await onConnect(project.Name, 'postgres', cs, undefined, project.Ref)
      setPasswordProject(null)
    } catch (err) {
      setProjectConnectError(parseError(err))
    } finally {
      setConnectingProject(null)
    }
  }

  const pendingConn = confirmDeleteId
    ? sbConnections.find(c => c.id === confirmDeleteId)
    : null

  return (
    <>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.identity}>
            <span className={styles.logo}>
              <SBLogo size={16} />
            </span>
            <span>Supabase</span>
          </div>

          {isSignedIn ? (
            <button className={styles.signout} onClick={() => setConfirmSignOut(true)}>
              Sign out
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

        {!isSignedIn && (
          <p className={styles.acctEmpty}>
            {connectError ?? 'Not connected. Click Connect to sign in with Supabase.'}
          </p>
        )}

        {isSignedIn && (
          <div className={styles.dbs}>
            <div className={styles.dbsLabel}>Projects</div>

            {loadingProjects ? (
              <div className={styles.loadingRow}>
                <span className={styles.spinner} />
                <span className={styles.loadingText}>Loading projects…</span>
              </div>
            ) : sbProjects.length === 0 ? (
              <p className={styles.acctEmpty}>No projects found in your Supabase account.</p>
            ) : (
              <ul className={styles.dbList}>
                {sbProjects.map(project => {
                  const saved = savedKeyFor(project)

                  return (
                    <li key={project.Ref} className={styles.dbRow}>
                      <div className={styles.dbInfo}>
                        <span className={styles.dbName}>{project.Name}</span>
                        <span className={styles.dbMeta}>{project.Region}</span>
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
                          onClick={() => { setProjectConnectError(null); setPasswordProject(project) }}
                          disabled={!!connectingProject}
                        >
                          Connect
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {projectConnectError && <div className="connect-error">{projectConnectError}</div>}
          </div>
        )}
      </div>

      {confirmSignOut && (
        <ConfirmModal
          message="Are you sure you want to sign out of Supabase? This will disconnect all projects currently using this account."
          confirmLabel="Sign out"
          onConfirm={handleSignOut}
          onCancel={() => setConfirmSignOut(false)}
        />
      )}

      {confirmDeleteId && pendingConn && (
        <DeleteConfirmModal
          message={`Remove "${pendingConn.name}"? The saved credentials will be deleted.`}
          confirmText={pendingConn.name}
          onConfirm={() => { onDeleteSaved(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {passwordProject && (
        <PasswordModal
          title={`Connect to ${passwordProject.Name}`}
          description={passwordProject.Region}
          error={projectConnectError}
          isConnecting={connectingProject === passwordProject.Ref}
          onConfirm={pwd => handleConnectProject(passwordProject, pwd)}
          onCancel={() => { setPasswordProject(null); setProjectConnectError(null) }}
        />
      )}
    </>
  )
}
