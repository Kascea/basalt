import { useEffect, useState } from 'react'
import { DatabaseClient } from '../db/client'
import * as LocaldbService from '../../bindings/basalt/localdb/service'
import type { Connection } from '../../bindings/basalt/db'
import type { SavedConnection } from '../../bindings/basalt/localdb/models'

// Manages saved Connection persistence and live Connection lifecycle.
// Schema object loading is handled separately by useSchemaObjects.

export interface ConnectionStore {
  savedConnections: SavedConnection[]
  connections: Connection[]
  isConnecting: string | null
  connect: (name: string, driver: string, connectionString: string, onSuccess?: () => void, planetscaleKey?: string, supabaseKey?: string) => Promise<void>
  reconnect: (id: string, onSuccess?: () => void) => void
  disconnect: (id: string) => void
  deleteSaved: (id: string) => void
  updateSaved: (conn: SavedConnection) => void
  reorderSaved: (ids: string[]) => void
}

export function useConnectionStore(
  setStatus: (msg: string) => void,
  onConnected: (conn: Connection) => void,
  onDisconnected: (id: string) => void,
): ConnectionStore {
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [isConnecting, setIsConnecting] = useState<string | null>(null)

  useEffect(() => {
    LocaldbService.ListSavedConnections()
      .then(setSavedConnections)
      .catch(() => {/* ignore */})
  }, [])

  const afterConnect = (conn: Connection, success?: () => void) => {
    setConnections(prev =>
      prev.find(c => c.id === conn.id)
        ? prev.map(c => c.id === conn.id ? conn : c)
        : [...prev, conn],
    )
    const who = [conn.user, conn.host || conn.name].filter(Boolean).join('@')
    const db = conn.database ? `/${conn.database}` : ''
    setStatus(`Connected — ${who}${db} (${conn.driver})`)
    success?.()
    LocaldbService.ListSavedConnections().then(setSavedConnections).catch(() => {})
    onConnected(conn)
  }

  const connect = (name: string, driver: string, connectionString: string, onSuccess?: () => void, planetscaleKey?: string, supabaseKey?: string): Promise<void> => {
    setIsConnecting('new')
    setStatus(`Connecting to ${name}…`)
    return DatabaseClient.connect({ name, driver, connectionString, planetscaleKey: planetscaleKey ?? '', supabaseKey: supabaseKey ?? '' })
      .then(conn => afterConnect(conn, onSuccess))
      .catch(err => { setStatus(String(err)); throw err })
      .finally(() => setIsConnecting(null))
  }

  const reconnect = (id: string, onSuccess?: () => void) => {
    const saved = savedConnections.find(s => s.id === id)
    setIsConnecting(id)
    setStatus(`Reconnecting to ${saved?.name || id}…`)
    DatabaseClient.connectSaved(id)
      .then(conn => afterConnect(conn, onSuccess))
      .catch(err => setStatus(String(err)))
      .finally(() => setIsConnecting(null))
  }

  const disconnect = (id: string) => {
    const conn = connections.find(c => c.id === id)
    const label = conn?.host || conn?.name || 'database'
    DatabaseClient.disconnect(id)
      .then(() => {
        setConnections(prev => prev.filter(c => c.id !== id))
        onDisconnected(id)
        setStatus(`Disconnected from ${label}`)
      })
      .catch(err => setStatus(String(err)))
  }

  const deleteSaved = (id: string) => {
    LocaldbService.DeleteSavedConnection(id)
      .then(() => {
        setSavedConnections(prev => prev.filter(s => s.id !== id))
        setConnections(prev => prev.filter(c => c.id !== id))
        onDisconnected(id)
      })
      .catch(err => setStatus(String(err)))
  }

  const updateSaved = (conn: SavedConnection) => {
    LocaldbService.UpdateSavedConnection(conn)
      .then(() => setSavedConnections(prev => prev.map(s => s.id === conn.id ? conn : s)))
      .catch(err => setStatus(String(err)))
  }

  const reorderSaved = (ids: string[]) => {
    setSavedConnections(prev => {
      const map = new Map(prev.map(s => [s.id, s]))
      return ids.map(id => map.get(id)).filter(Boolean) as SavedConnection[]
    })
    LocaldbService.ReorderConnections(ids).catch(err => setStatus(String(err)))
  }

  return {
    savedConnections,
    connections,
    isConnecting,
    connect,
    reconnect,
    disconnect,
    deleteSaved,
    updateSaved,
    reorderSaved,
  }
}
