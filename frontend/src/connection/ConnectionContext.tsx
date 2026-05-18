import { createContext, useContext } from 'react'
import type { Connection, SchemaObject } from '../../bindings/basalt/db'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'

// ConnectionSession carries only what the sidebar needs from the outside:
// connection data + action callbacks. UI state (expanded nodes, filter)
// lives inside ConnectionTree itself.
export interface ConnectionSession {
  savedConnections: SavedConnection[]
  connections: Connection[]
  activeTabConnectionID: string
  objectsByConnection: Record<string, SchemaObject[]>
  isConnecting: string | null
  onNewConnection: () => void
  onConnectionClick: (id: string) => void
  onReconnect: (id: string) => void
  onDisconnect: (id: string) => void
  onDeleteSaved: (id: string) => void
  onEditSaved: (conn: SavedConnection) => void
  onReorderSaved: (ids: string[]) => void
  onRefresh: () => void
  onTableOpen: (connectionID: string, schema: string, table: string) => void
  onTableOpenNewTab: (connectionID: string, schema: string, table: string) => void
  onTableOpenSchema: (connectionID: string, schema: string, table: string) => void
  onGroupOpen?: (connectionID: string, schema: string, kind: 'sequences' | 'indexes') => void
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
