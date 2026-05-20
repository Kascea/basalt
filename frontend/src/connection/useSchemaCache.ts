import { useState } from 'react'
import { DatabaseClient } from '../db/client'
import type { SchemaObject } from '../../bindings/basalt/db'
import { parseError } from '../lib/parseError'

// Caches Schema Objects per Connection.
// Kept separate from connection lifecycle so cache invalidation logic
// has a single home and doesn't couple to connection state.

export interface SchemaCache {
  objectsByConnection: Record<string, SchemaObject[]>
  loadObjects: (connID: string) => void
  refreshObjects: (connID: string) => void
  removeObjects: (connID: string) => void
}

export function useSchemaCache(setStatus: (msg: string) => void): SchemaCache {
  const [objectsByConnection, setObjectsByConnection] = useState<Record<string, SchemaObject[]>>({})

  const loadObjects = (connID: string) => {
    DatabaseClient.listSchemaObjects(connID)
      .then(objs => setObjectsByConnection(prev => ({ ...prev, [connID]: objs })))
      .catch(err => {
        setStatus(parseError(err))
        setObjectsByConnection(prev => ({ ...prev, [connID]: [] }))
      })
  }

  const refreshObjects = (connID: string) => {
    if (!connID) return
    DatabaseClient.listSchemaObjects(connID)
      .then(objs => setObjectsByConnection(prev => ({ ...prev, [connID]: objs })))
      .catch(err => setStatus(parseError(err)))
  }

  const removeObjects = (connID: string) => {
    setObjectsByConnection(prev => { const next = { ...prev }; delete next[connID]; return next })
  }

  return { objectsByConnection, loadObjects, refreshObjects, removeObjects }
}
