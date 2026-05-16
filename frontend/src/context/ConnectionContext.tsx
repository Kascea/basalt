import { createContext, useContext } from 'react'
import type { Connection, SchemaObject } from '../../bindings/basalt/db'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'

export interface ConnectionSession {
  savedConnections: SavedConnection[]
  connections: Connection[]
  activeConnectionID: string
  objectsByConnection: Record<string, SchemaObject[]>
  expandedConnections: Set<string>
  expandedSchemas: Set<string>
  filter: string
  isConnecting: string | null
  onNewConnection: () => void
  onConnectionClick: (id: string) => void
  onReconnect: (id: string) => void
  onDisconnect: (id: string) => void
  onDeleteSaved: (id: string) => void
  onEditSaved: (conn: SavedConnection) => void
  onSchemaToggle: (schema: string) => void
  onFilterChange: (value: string) => void
  onRefresh: () => void
  onTableOpen: (schema: string, table: string) => void
  onTableOpenNewTab: (schema: string, table: string) => void
  onTableOpenSchema: (schema: string, table: string) => void
  onGroupOpen?: (schema: string, kind: 'sequences' | 'indexes') => void
}

const ConnectionContext = createContext<ConnectionSession | null>(null)

export function ConnectionProvider({
  value,
  children,
}: {
  value: ConnectionSession
  children: React.ReactNode
}) {
  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnectionSession(): ConnectionSession {
  const ctx = useContext(ConnectionContext)
  if (!ctx) throw new Error('useConnectionSession must be used inside ConnectionProvider')
  return ctx
}
