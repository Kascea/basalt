import { useState } from 'react'
import { DatabaseService, type Connection, type SchemaObject } from '../../bindings/basalt'

export interface DatabaseState {
  connections: Connection[]
  activeConnectionID: string
  activeConnection: Connection | undefined
  objects: SchemaObject[]
  filter: string
  isConnecting: boolean
  expandedConnections: Set<string>
  expandedSchemas: Set<string>
  setFilter: (v: string) => void
  connect: (name: string, driver: string, connectionString: string, onSuccess?: () => void) => void
  refreshObjects: () => void
  toggleConnection: (id: string) => void
  toggleSchema: (schema: string) => void
}

export function useDatabase(setStatus: (msg: string) => void): DatabaseState {
  const [connections, setConnections] = useState<Connection[]>([])
  const [activeConnectionID, setActiveConnectionID] = useState('')
  const [objects, setObjects] = useState<SchemaObject[]>([])
  const [filter, setFilter] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set())
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())

  const activeConnection = connections.find((c) => c.id === activeConnectionID)

  const connect = (name: string, driver: string, connectionString: string, onSuccess?: () => void) => {
    setIsConnecting(true)
    setStatus('Connecting…')

    DatabaseService.Connect({ name, driver, connectionString })
      .then((conn) => {
        setConnections((prev) => prev.find((c) => c.id === conn.id) ? prev : [...prev, conn])
        setActiveConnectionID(conn.id)
        setExpandedConnections((prev) => new Set([...prev, conn.id]))
        setStatus(`Connected to ${conn.host || conn.name}`)
        onSuccess?.()
        return DatabaseService.ListSchemaObjects(conn.id)
      })
      .then((objs) => {
        setObjects(objs)
        if (objs.length > 0) setExpandedSchemas(new Set([objs[0].schema]))
      })
      .catch((err) => {
        setStatus(String(err))
        setObjects([])
      })
      .finally(() => setIsConnecting(false))
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
    refreshObjects,
    toggleConnection,
    toggleSchema,
  }
}
