import { useConnectionStore } from './useConnectionStore'
import { useSchemaCache } from './useSchemaCache'
import type { Connection } from '../../bindings/basalt/db'

// Composes ConnectionStore + SchemaCache.
// UI state (expanded nodes, filter text) lives in ConnectionTree where it belongs.

export type { ConnectionStore } from './useConnectionStore'
export type { SchemaCache } from './useSchemaCache'

export function useDatabase(setStatus: (msg: string) => void) {
  const schemaCache = useSchemaCache(setStatus)

  const connectionStore = useConnectionStore(
    setStatus,
    (conn: Connection) => schemaCache.loadObjects(conn.id),
    (id: string) => schemaCache.removeObjects(id),
  )

  return {
    ...connectionStore,
    objectsByConnection: schemaCache.objectsByConnection,
    refreshObjects: schemaCache.refreshObjects,
  }
}

export type DatabaseState = ReturnType<typeof useDatabase>
