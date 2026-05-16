import { useEffect, useState } from 'react'
import { DatabaseService, type Connection, type SchemaObject } from '../../bindings/basalt/db'
import * as LocaldbService from '../../bindings/basalt/localdb/service'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'

export interface DatabaseState {
  savedConnections: SavedConnection[]
  connections: Connection[]
  activeConnectionID: string
  activeConnection: Connection | undefined
  objectsByConnection: Record<string, SchemaObject[]>
  filter: string
  isConnecting: string | null // ID being connected, or null
  expandedConnections: Set<string>
  expandedSchemas: Set<string>
  setFilter: (v: string) => void
  connect: (name: string, driver: string, connectionString: string, onSuccess?: () => void, planetscaleKey?: string) => Promise<void>
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
  const [objectsByConnection, setObjectsByConnection] = useState<Record<string, SchemaObject[]>>({})
  const [filter, setFilter] = useState('')
  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set())
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())

  const activeConnection = connections.find((c) => c.id === activeConnectionID)

  // Load saved connections on mount.
  useEffect(() => {
    LocaldbService.ListSavedConnections()
      .then(setSavedConnections)
      .catch(() => {/* ignore */})
  }, [])

  const afterConnect = (conn: Connection, onSuccess?: () => void) => {
    setConnections((prev) => prev.find((c) => c.id === conn.id) ? prev.map((c) => c.id === conn.id ? conn : c) : [...prev, conn])
    setActiveConnectionID(conn.id)
    setExpandedConnections((prev) => new Set([...prev, conn.id]))
    const who = [conn.user, conn.host || conn.name].filter(Boolean).join('@')
    const db = conn.database ? `/${conn.database}` : ''
    setStatus(`Connected — ${who}${db} (${conn.driver})`)
    onSuccess?.()
    LocaldbService.ListSavedConnections().then(setSavedConnections).catch(() => {})
    return DatabaseService.ListSchemaObjects(conn.id)
      .then((objs) => {
        setObjectsByConnection((prev) => ({ ...prev, [conn.id]: objs }))
        if (objs.length > 0) setExpandedSchemas((prev) => new Set([...prev, objs[0].schema]))
      })
      .catch((err) => {
        setStatus(String(err))
        setObjectsByConnection((prev) => ({ ...prev, [conn.id]: [] }))
      })
  }

  const connect = (name: string, driver: string, connectionString: string, onSuccess?: () => void, planetscaleKey?: string): Promise<void> => {
    setIsConnecting('new')
    setStatus(`Connecting to ${name}…`)
    return DatabaseService.Connect({ name, driver, connectionString, planetscaleKey: planetscaleKey ?? '' })
      .then((conn) => afterConnect(conn, onSuccess))
      .catch((err) => {
        setStatus(String(err))
        throw err
      })
      .finally(() => setIsConnecting(null))
  }

  const reconnect = (id: string, onSuccess?: () => void) => {
    const saved = savedConnections.find(s => s.id === id)
    setIsConnecting(id)
    setStatus(`Reconnecting to ${saved?.name || id}…`)
    DatabaseService.ConnectSaved(id)
      .then((conn) => afterConnect(conn, onSuccess))
      .catch((err) => setStatus(String(err)))
      .finally(() => setIsConnecting(null))
  }

  const disconnect = (id: string) => {
    const conn = connections.find(c => c.id === id)
    const label = conn?.host || conn?.name || 'database'
    DatabaseService.DisconnectConnection(id)
      .then(() => {
        setConnections((prev) => prev.filter((c) => c.id !== id))
        setObjectsByConnection((prev) => { const next = { ...prev }; delete next[id]; return next })
        if (activeConnectionID === id) setActiveConnectionID('')
        setStatus(`Disconnected from ${label}`)
      })
      .catch((err) => setStatus(String(err)))
  }

  const deleteSaved = (id: string) => {
    LocaldbService.DeleteSavedConnection(id)
      .then(() => {
        setSavedConnections((prev) => prev.filter((s) => s.id !== id))
        setConnections((prev) => prev.filter((c) => c.id !== id))
        setObjectsByConnection((prev) => { const next = { ...prev }; delete next[id]; return next })
        if (activeConnectionID === id) setActiveConnectionID('')
      })
      .catch((err) => setStatus(String(err)))
  }

  const updateSaved = (conn: SavedConnection) => {
    LocaldbService.UpdateSavedConnection(conn)
      .then(() => setSavedConnections((prev) => prev.map((s) => s.id === conn.id ? conn : s)))
      .catch((err) => setStatus(String(err)))
  }

  const refreshObjects = () => {
    if (!activeConnectionID) return
    DatabaseService.ListSchemaObjects(activeConnectionID)
      .then((objs) => setObjectsByConnection((prev) => ({ ...prev, [activeConnectionID]: objs })))
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
    objectsByConnection,
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
