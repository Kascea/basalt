import { useState } from 'react'
import type { SavedConnection } from '../../bindings/basalt/config'
import { DatabaseService, type PlanetScaleDatabase } from '../../bindings/basalt/db'

type ConnectionMode = 'url' | 'fields'
type PSState = 'idle' | 'signing-in' | 'listing' | 'ready' | 'connecting'

interface FieldsState {
  host: string
  port: string
  database: string
  username: string
  password: string
}

const DEFAULT_PORT: Record<string, string> = {
  postgres: '5432',
  mysql: '3306',
  sqlite: '',
}

interface Props {
  isConnecting: boolean
  initialValues?: SavedConnection
  onConnect: (name: string, driver: string, connectionString: string, planetscaleKey?: string) => Promise<void>
  onSaveOnly?: (conn: SavedConnection) => void
}

function extractErrorMessage(err: unknown): string {
  const raw = String(err).replace(/^Error:\s*/, '')
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.message === 'string') return parsed.message
  } catch {
    // not JSON, use as-is
  }
  return raw
}

export function ConnectForm({ isConnecting, initialValues, onConnect, onSaveOnly }: Props) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [driver, setDriver] = useState(initialValues?.driver ?? 'postgres')
  const [mode, setMode] = useState<ConnectionMode>('url')
  const [connectionString, setConnectionString] = useState(initialValues?.connectionString ?? '')
  const [fields, setFields] = useState<FieldsState>({
    host: 'localhost',
    port: '5432',
    database: '',
    username: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)

  // PlanetScale state
  const [psState, setPSState] = useState<PSState>('idle')
  const [psDatabases, setPSDatabases] = useState<PlanetScaleDatabase[]>([])
  const [psError, setPSError] = useState<string | null>(null)

  const isEditing = !!initialValues

  const handleDriverChange = (d: string) => {
    setDriver(d)
    setFields(prev => ({ ...prev, port: DEFAULT_PORT[d] ?? '' }))
  }

  const setField = (key: keyof FieldsState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(prev => ({ ...prev, [key]: e.target.value }))

  const buildConnectionString = (): string => {
    if (mode === 'url') return connectionString
    if (driver === 'sqlite') return fields.database
    const proto = driver === 'mysql' ? 'mysql' : 'postgres'
    const userPart = fields.username
      ? `${encodeURIComponent(fields.username)}${fields.password ? `:${encodeURIComponent(fields.password)}` : ''}@`
      : ''
    const host = fields.host || 'localhost'
    const portPart = fields.port ? `:${fields.port}` : ''
    const dbPart = fields.database ? `/${fields.database}` : ''
    return `${proto}://${userPart}${host}${portPart}${dbPart}`
  }

  const handleBrowseSQLite = async () => {
    const path = await DatabaseService.PickSQLiteFile()
    if (path) setConnectionString(path)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    onConnect(name, driver, buildConnectionString())
      .catch((err: unknown) => setError(extractErrorMessage(err)))
  }

  const handleSaveOnly = () => {
    if (!onSaveOnly || !initialValues) return
    onSaveOnly({ ...initialValues, name, driver, connectionString: buildConnectionString() })
  }

  const handlePSSignIn = async () => {
    setPSError(null)
    setPSState('signing-in')
    try {
      await DatabaseService.PlanetScaleStartAuth()
      setPSState('listing')
      const dbs = await DatabaseService.PlanetScaleListDatabases()
      setPSDatabases(dbs ?? [])
      setPSState('ready')
    } catch (err: unknown) {
      setPSError(extractErrorMessage(err))
      setPSState('idle')
    }
  }

  const handlePSConnect = async (db: PlanetScaleDatabase) => {
    setPSError(null)
    setPSState('connecting')
    try {
      const cs = await DatabaseService.PlanetScaleGetConnectionString(db.org, db.name, db.branch, db.kind)
      await onConnect(db.name, 'postgres', cs, `${db.org}/${db.name}/${db.branch}`)
    } catch (err: unknown) {
      setPSError(extractErrorMessage(err))
      setPSState('ready')
    }
  }

  const handlePSSignOut = () => {
    setPSState('idle')
    setPSDatabases([])
    setPSError(null)
  }

  return (
    <form className="connect-form" onSubmit={handleSubmit}>
      {/* ── Manual connection ── */}
      <label>
        <span>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Database"
          required
        />
      </label>

      <label>
        <span>Driver</span>
        <select value={driver} onChange={(e) => handleDriverChange(e.target.value)}>
          <option value="postgres">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="sqlite">SQLite</option>
        </select>
      </label>

      {driver !== 'sqlite' && (
        <div className="connect-mode-tabs">
          <button
            type="button"
            className={`connect-mode-tab${mode === 'url' ? ' connect-mode-tab--active' : ''}`}
            onClick={() => setMode('url')}
          >
            Connection URL
          </button>
          <button
            type="button"
            className={`connect-mode-tab${mode === 'fields' ? ' connect-mode-tab--active' : ''}`}
            onClick={() => setMode('fields')}
          >
            Host / Port
          </button>
        </div>
      )}

      {(mode === 'url' || driver === 'sqlite') ? (
        <label>
          <span>{driver === 'sqlite' ? 'File path' : 'Connection URL'}</span>
          {driver === 'sqlite' ? (
            <div className="sqlite-file-row">
              <input
                className="sqlite-file-input"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="/path/to/database.db"
                spellCheck={false}
                required
              />
              <button type="button" className="sqlite-browse-btn" onClick={handleBrowseSQLite}>
                Browse…
              </button>
            </div>
          ) : (
            <textarea
              className="connection-string"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              placeholder={
                driver === 'mysql'
                  ? 'mysql://user:password@host:3306/database'
                  : 'postgres://user:password@host:5432/database'
              }
              spellCheck={false}
              required
            />
          )}
        </label>
      ) : (
        <div className="connect-fields">
          <label className="connect-field--grow">
            <span>Host</span>
            <input value={fields.host} onChange={setField('host')} placeholder="localhost" />
          </label>
          <label className="connect-field--port">
            <span>Port</span>
            <input value={fields.port} onChange={setField('port')} placeholder={DEFAULT_PORT[driver]} />
          </label>
          <label className="connect-field--full">
            <span>Database</span>
            <input value={fields.database} onChange={setField('database')} placeholder="mydb" />
          </label>
          <label className="connect-field--half">
            <span>Username</span>
            <input value={fields.username} onChange={setField('username')} placeholder="postgres" autoComplete="username" />
          </label>
          <label className="connect-field--half">
            <span>Password</span>
            <input type="password" value={fields.password} onChange={setField('password')} placeholder="••••••••" autoComplete="current-password" />
          </label>
        </div>
      )}

      {error && <div className="connect-error">{error}</div>}

      <div className="connect-form-actions">
        {isEditing && onSaveOnly && (
          <button type="button" className="connect-button connect-button--secondary" onClick={handleSaveOnly}>
            Save
          </button>
        )}
        <button type="submit" className="connect-button" disabled={isConnecting}>
          {isConnecting ? 'Connecting…' : isEditing ? 'Save & Connect' : 'Connect'}
        </button>
      </div>

      {/* ── PlanetScale OAuth ── */}
      {!isEditing && (
        <>
          <div className="connect-divider"><span>or</span></div>

          <div className="ps-section">
            {psState === 'idle' && (
              <button type="button" className="ps-signin-btn" onClick={handlePSSignIn}>
                <PSLogo />
                Sign in with PlanetScale
              </button>
            )}

            {(psState === 'signing-in' || psState === 'listing') && (
              <div className="ps-status">
                <span className="ps-spinner" />
                {psState === 'signing-in' ? 'Waiting for browser authorization…' : 'Loading databases…'}
              </div>
            )}

            {(psState === 'ready' || psState === 'connecting') && (
              <>
                <div className="ps-header">
                  <span className="ps-header-label">PlanetScale databases</span>
                  <button type="button" className="ps-signout-btn" onClick={handlePSSignOut}>
                    Sign out
                  </button>
                </div>
                {psDatabases.length === 0 ? (
                  <p className="ps-empty">No databases found.</p>
                ) : (
                  <ul className="ps-db-list">
                    {psDatabases.map((db) => (
                      <li key={`${db.org}/${db.name}`} className="ps-db-item">
                        <div className="ps-db-info">
                          <span className="ps-db-name">{db.name}</span>
                          <span className="ps-db-meta">{db.org} · {db.branch}</span>
                        </div>
                        <button
                          type="button"
                          className="ps-connect-btn"
                          disabled={psState === 'connecting'}
                          onClick={() => handlePSConnect(db)}
                        >
                          {psState === 'connecting' ? '…' : 'Connect'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {psError && <div className="connect-error">{psError}</div>}
          </div>
        </>
      )}
    </form>
  )
}

function PSLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="#5046e5" />
      <path d="M16 2L2 10l14 8 14-8L16 2z" fill="#7c6ff7" />
      <path d="M2 10v12l14 8V18L2 10z" fill="#3730a3" />
      <path d="M30 10v12l-14 8V18l14-8z" fill="#4338ca" />
    </svg>
  )
}
