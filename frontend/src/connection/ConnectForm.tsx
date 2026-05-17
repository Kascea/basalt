import { useState } from 'react'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'
import { DatabaseService } from '../../bindings/basalt/db'

type ConnectionMode = 'url' | 'fields'

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

  return (
    <form className="connect-form" onSubmit={handleSubmit}>
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
    </form>
  )
}
