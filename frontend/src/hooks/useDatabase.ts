import { useEffect, useState } from 'react'
import { DatabaseService, type Connection, type SavedConnection, type SchemaObject } from '../../bindings/basalt'

export interface DatabaseState {
  savedConnections: SavedConnection[]
  connections: Connection[]
  activeConnectionID: string
  activeConnection: Connection | undefined
  objects: SchemaObject[]
  filter: string
  isConnecting: string | null // ID being connected, or null
  expandedConnections: Set<string>
  expandedSchemas: Set<string>
  setFilter: (v: string) => void
  connect: (name: string, driver: string, connectionString: string, onSuccess?: () => void) => void
  reconnect: (id: string, onSuccess?: () => void) => void
  disconnect: (id: string) => void
  deleteSaved: (id: string) => void
  updateSaved: (conn: SavedConnection) => void
  refreshObjects: () => void
  toggleConnection: (id: string) => void
  toggleSchema: (schema: string) => void
}

export function useDatabase(setStatus: (msg: string) => void): DatabaseState {
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [activeConnectionID, setActiveConnectionID] = useState('')
  const [objects, setObjects] = useState<SchemaObject[]>([])
  const [filter, setFilter] = useState('')
  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set())
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())

  const activeConnection = connections.find((c) => c.id === activeConnectionID)

  // Load saved connections on mount.
  useEffect(() => {
    DatabaseService.ListSavedConnections()
      .then(setSavedConnections)
      .catch(() => {/* ignore */})
  }, [])

  const afterConnect = (conn: Connection, onSuccess?: () => void) => {
    setConnections((prev) => prev.find((c) => c.id === conn.id) ? prev.map((c) => c.id === conn.id ? conn : c) : [...prev, conn])
    setActiveConnectionID(conn.id)
    setExpandedConnections((prev) => new Set([...prev, conn.id]))
    setStatus(`Connected to ${conn.host || conn.name}`)
    onSuccess?.()
    DatabaseService.ListSavedConnections().then(setSavedConnections).catch(() => {})
    return DatabaseService.ListSchemaObjects(conn.id)
      .then((objs) => {
        setObjects(objs)
        if (objs.length > 0) setExpandedSchemas(new Set([objs[0].schema]))
      })
      .catch((err) => {
        setStatus(String(err))
        setObjects([])
      })
  }

  const connect = (name: string, driver: string, connectionString: string, onSuccess?: () => void) => {
    setIsConnecting('new')
    setStatus('Connecting…')
    DatabaseService.Connect({ name, driver, connectionString })
      .then((conn) => afterConnect(conn, onSuccess))
      .catch((err) => setStatus(String(err)))
      .finally(() => setIsConnecting(null))
  }

  const reconnect = (id: string, onSuccess?: () => void) => {
    setIsConnecting(id)
    setStatus('Connecting…')
    DatabaseService.ConnectSaved(id)
      .then((conn) => afterConnect(conn, onSuccess))
      .catch((err) => setStatus(String(err)))
      .finally(() => setIsConnecting(null))
  }

  const disconnect = (id: string) => {
    DatabaseService.DisconnectConnection(id)
      .then(() => {
        setConnections((prev) => prev.filter((c) => c.id !== id))
        if (activeConnectionID === id) {
          setActiveConnectionID('')
          setObjects([])
        }
        setStatus('Disconnected')
      })
      .catch((err) => setStatus(String(err)))
  }

  const deleteSaved = (id: string) => {
    DatabaseService.DeleteSavedConnection(id)
      .then(() => {
        setSavedConnections((prev) => prev.filter((s) => s.id !== id))
        setConnections((prev) => prev.filter((c) => c.id !== id))
        if (activeConnectionID === id) {
          setActiveConnectionID('')
          setObjects([])
        }
      })
      .catch((err) => setStatus(String(err)))
  }

  const updateSaved = (conn: SavedConnection) => {
    DatabaseService.UpdateSavedConnection(conn)
      .then(() => setSavedConnections((prev) => prev.map((s) => s.id === conn.id ? conn : s)))
      .catch((err) => setStatus(String(err)))
  }

  const refreshObjects = () => {
    if (!activeConnectionID) return
    DatabaseService.ListSchemaObjects(activeConnectionID)
      .then(setObjects)
      .catch((err) => setStatus(String(err)))
  }

  const toggleConnection = (id: string) => {
    setExpandedConnections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setActiveConnectionID(id)
  }

  const toggleSchema = (schema: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev)
      next.has(schema) ? next.delete(schema) : next.add(schema)
      return next
    })
  }

  return {
    savedConnections,
    connections,
    activeConnectionID,
    activeConnection,
    objects,
    filter,
    isConnecting,
    expandedConnections,
    expandedSchemas,
    setFilter,
    connect,
    reconnect,
    disconnect,
    deleteSaved,
    updateSaved,
    refreshObjects,
    toggleConnection,
    toggleSchema,
  }
}
