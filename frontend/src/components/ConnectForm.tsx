import { useState } from 'react'
import type { SavedConnection } from '../../bindings/basalt'

interface Props {
  isConnecting: boolean
  initialValues?: SavedConnection
  onConnect: (name: string, driver: string, connectionString: string) => void
  onSaveOnly?: (conn: SavedConnection) => void
}

export function ConnectForm({ isConnecting, initialValues, onConnect, onSaveOnly }: Props) {
  const [name, setName] = useState(initialValues?.name ?? 'Postgres')
  const [driver, setDriver] = useState(initialValues?.driver ?? 'postgres')
  const [connectionString, setConnectionString] = useState(initialValues?.connectionString ?? '')

  const isEditing = !!initialValues

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConnect(name, driver, connectionString)
  }

  const handleSaveOnly = () => {
    if (!onSaveOnly || !initialValues) return
    onSaveOnly({ ...initialValues, name, driver, connectionString })
  }

  return (
    <form className="connect-form" onSubmit={handleSubmit}>
      <label>
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        <span>Driver</span>
        <select value={driver} onChange={(e) => setDriver(e.target.value)}>
          <option value="postgres">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="sqlite">SQLite</option>
        </select>
      </label>
      <label>
        <span>Connection string</span>
        <textarea
          className="connection-string"
          value={connectionString}
          onChange={(e) => setConnectionString(e.target.value)}
          placeholder="Leave blank to use DATABASE_URL"
          spellCheck={false}
        />
      </label>
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
