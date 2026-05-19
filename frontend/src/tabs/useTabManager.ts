import { useState } from 'react'
import { type Tab, type TabKind } from '../types'

function baseTabId(kind: TabKind, schema: string, table?: string): string {
  return table ? `${schema}.${table}` : `${schema}:${kind}`
}

// Typed lifecycle events emitted by useTabManager.
// The coordinator (useTableTabs) drains these via useEffect rather than
// receiving callbacks — making the lifecycle protocol explicit and typed.
export type TabEvent =
  | { type: 'load-table'; id: string; connID: string; schema: string; table: string; prefill?: Record<string, string> }
  | { type: 'create-worksheet'; id: string }
  | { type: 'cleanup-tab'; id: string }

export function useTabManager() {
  const WORKSHEET_ID = 'worksheet'
  const initialWorksheetTab: Tab = { id: WORKSHEET_ID, kind: 'worksheet', connectionID: '', schema: '', name: 'Worksheet 1' }

  const [tabs, setTabs] = useState<Tab[]>([initialWorksheetTab])
  const [activeTabId, setActiveTabId] = useState(WORKSHEET_ID)
  const [lastTabEvent, setLastTabEvent] = useState<TabEvent | null>(null)

  const activeTab = tabs.find(t => t.id === activeTabId) ?? initialWorksheetTab

  const emit = (event: TabEvent) => setLastTabEvent(event)
  const clearTabEvent = () => setLastTabEvent(null)

  const openTableTab = (connID: string, schema: string, table: string) => {
    const existing = tabs.find(t => t.kind === 'table' && t.connectionID === connID && t.schema === schema && t.table === table)
    if (existing) { setActiveTabId(existing.id); return }

    const activeTabSnapshot = tabs.find(t => t.id === activeTabId)
    const isReplaceableTab = activeTabSnapshot && activeTabSnapshot.kind === 'table' && !activeTabSnapshot.pinned

    const newId = `${baseTabId('table', schema, table)}:${Date.now()}`
    const newTab: Tab = { id: newId, kind: 'table', connectionID: connID, schema, table }

    if (isReplaceableTab) {
      const oldId = activeTabSnapshot.id
      emit({ type: 'cleanup-tab', id: oldId })
      setTabs(prev => prev.map(t => t.id === oldId ? newTab : t))
    } else {
      setTabs(prev => [...prev, newTab])
    }
    setActiveTabId(newId)
    emit({ type: 'load-table', id: newId, connID, schema, table })
  }

  const openTableTabWithPrefill = (connID: string, schema: string, table: string, prefill: Record<string, string>) => {
    const id = `${baseTabId('table', schema, table)}:${Date.now()}`
    const tab: Tab = { id, kind: 'table', connectionID: connID, schema, table }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
    emit({ type: 'load-table', id, connID, schema, table, prefill })
  }

  const openSchemaTab = (connID: string, schema: string, table: string, addColumn?: boolean) => {
    const id = `${connID}:${schema}.${table}:schema`
    if (tabs.find(t => t.id === id)) {
      setActiveTabId(id)
      if (addColumn) setTabs(prev => prev.map(t => t.id === id ? { ...t, addColumn: true } : t))
      return
    }
    const tab: Tab = { id, kind: 'schema', connectionID: connID, schema, table, addColumn }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
  }

  const openGroupTab = (connID: string, schema: string, kind: 'sequences' | 'indexes' | 'foreignkeys') => {
    const id = `${connID}:${baseTabId(kind, schema)}`
    if (tabs.find(t => t.id === id)) { setActiveTabId(id); return }
    const tab: Tab = { id, kind, connectionID: connID, schema }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
  }

  const openWorksheetTab = (connID = '') => {
    const id = `worksheet:${Date.now()}`
    const worksheetCount = tabs.filter(t => t.kind === 'worksheet').length
    const name = `Worksheet ${worksheetCount + 1}`
    const tab: Tab = { id, kind: 'worksheet', connectionID: connID, schema: '', name }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
    emit({ type: 'create-worksheet', id })
  }

  const setTabConnectionID = (tabId: string, connID: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, connectionID: connID } : t))
  }

  const togglePinTab = (id: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, pinned: !t.pinned } : t))
  }

  const renameTab = (id: string, name: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name: name.trim() || undefined } : t))
  }

  const closeTab = (id: string) => {
    const tab = tabs.find(t => t.id === id)
    if (tab?.pinned) return
    emit({ type: 'cleanup-tab', id })
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const next = prev.filter(t => t.id !== id)
      if (activeTabId === id) {
        setActiveTabId(next[Math.max(0, idx - 1)]?.id ?? '')
      }
      return next
    })
  }

  const closeAllTabs = () => {
    const toClose = tabs.filter(t => !t.pinned)
    toClose.forEach(t => emit({ type: 'cleanup-tab', id: t.id }))
    const pinned = tabs.filter(t => t.pinned)
    setTabs(pinned)
    setActiveTabId(pinned[0]?.id ?? '')
  }

  const reorderTabs = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return
    setTabs(prev => {
      const next = [...prev]
      const [tab] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, tab)
      return next
    })
  }

  const restoreTabs = (restoredTabs: Tab[], activeId: string) => {
    setTabs(restoredTabs)
    setActiveTabId(activeId)
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    lastTabEvent,
    clearTabEvent,
    setActiveTab: setActiveTabId,
    openTableTab,
    openTableTabWithPrefill,
    openSchemaTab,
    openGroupTab,
    openWorksheetTab,
    setTabConnectionID,
    togglePinTab,
    renameTab,
    closeTab,
    closeAllTabs,
    reorderTabs,
    restoreTabs,
  }
}
