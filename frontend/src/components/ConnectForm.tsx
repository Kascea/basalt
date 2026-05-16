import { useState } from 'react'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'
import { DatabaseService } from '../../bindings/basalt/db'
import * as PlanetScaleService from '../../bindings/basalt/planetscale/service'
import type { Database as PlanetScaleDatabase } from '../../bindings/basalt/planetscale/models'

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
      await PlanetScaleService.StartAuth()
      setPSState('listing')
      const dbs = await PlanetScaleService.ListDatabases()
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
      const cs = await PlanetScaleService.GetConnectionString(db.Org, db.Name, db.Branch, db.Kind)
      await onConnect(db.Name, 'postgres', cs, `${db.Org}/${db.Name}/${db.Branch}`)
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
                      <li key={`${db.Org}/${db.Name}`} className="ps-db-item">
                        <div className="ps-db-info">
                          <span className="ps-db-name">{db.Name}</span>
                          <span className="ps-db-meta">{db.Org} · {db.Branch}</span>
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

function PSLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M-0.0981445 16C-0.0981438 7.16344 7.0653 -7.52254e-07 15.9019 0C22.399 5.67998e-07 27.9917 3.87258 30.4975 9.43544L9.3373 30.5956C8.42926 30.1866 7.56625 29.6953 6.75778 29.1313L19.8891 16H15.9019L4.58815 27.3137C1.69272 24.4183 -0.0981449 20.4183 -0.0981445 16Z" fill="white" />
      <path d="M31.9019 16.0055L15.9074 32C24.7396 31.997 31.8989 24.8377 31.9019 16.0055Z" fill="white" />
    </svg>
  )
}
