import { useState } from 'react'

interface Props {
  isConnecting: boolean
  onConnect: (name: string, driver: string, connectionString: string) => void
}

export function ConnectForm({ isConnecting, onConnect }: Props) {
  const [name, setName] = useState('Postgres')
  const [driver, setDriver] = useState('postgres')
  const [connectionString, setConnectionString] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConnect(name, driver, connectionString)
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
      <button type="submit" className="connect-button" disabled={isConnecting}>
        {isConnecting ? 'Connecting…' : 'Connect'}
      </button>
    </form>
  )
}
