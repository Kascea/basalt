import { useState } from 'react'
import { type Tab, type TabKind } from '../types'

function baseTabId(kind: TabKind, schema: string, table?: string): string {
  return table ? `${schema}.${table}` : `${schema}:${kind}`
}

interface UseTabManagerOptions {
  connectionID: string
  onLoadTable: (id: string, schema: string, table: string, prefill?: Record<string, string>) => void
  onCreateWorksheet: (id: string) => void
  onCleanupTab: (id: string) => void
}

export function useTabManager({ connectionID, onLoadTable, onCreateWorksheet, onCleanupTab }: UseTabManagerOptions) {
  const WORKSHEET_ID = 'worksheet'
  const worksheetTab: Tab = { id: WORKSHEET_ID, kind: 'worksheet', connectionID, schema: '', name: 'Worksheet 1' }

  const [tabs, setTabs] = useState<Tab[]>([worksheetTab])
  const [activeTabId, setActiveTabId] = useState(WORKSHEET_ID)

  const activeTab = tabs.find(t => t.id === activeTabId) ?? worksheetTab

  const openTableTab = (schema: string, table: string) => {
    const existing = tabs.find(t => t.kind === 'table' && t.schema === schema && t.table === table)
    if (existing) { setActiveTabId(existing.id); return }

    const activeTabSnapshot = tabs.find(t => t.id === activeTabId)
    const isReplaceableTab = activeTabSnapshot && activeTabSnapshot.kind === 'table' && !activeTabSnapshot.pinned

    const newId = `${baseTabId('table', schema, table)}:${Date.now()}`
    const newTab: Tab = { id: newId, kind: 'table', connectionID, schema, table }

    if (isReplaceableTab) {
      const oldId = activeTabSnapshot.id
      onCleanupTab(oldId)
      setTabs(prev => prev.map(t => t.id === oldId ? newTab : t))
    } else {
      setTabs(prev => [...prev, newTab])
    }
    setActiveTabId(newId)
    onLoadTable(newId, schema, table)
  }

  const openTableTabWithPrefill = (schema: string, table: string, prefill: Record<string, string>) => {
    const id = `${baseTabId('table', schema, table)}:${Date.now()}`
    const tab: Tab = { id, kind: 'table', connectionID, schema, table }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
    onLoadTable(id, schema, table, prefill)
  }

  const openSchemaTab = (schema: string, table: string) => {
    const id = `${schema}.${table}:schema`
    if (tabs.find(t => t.id === id)) { setActiveTabId(id); return }
    const tab: Tab = { id, kind: 'schema', connectionID, schema, table }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
  }

  const openGroupTab = (schema: string, kind: 'sequences' | 'indexes' | 'foreignkeys') => {
    const id = baseTabId(kind, schema)
    if (tabs.find(t => t.id === id)) { setActiveTabId(id); return }
    const tab: Tab = { id, kind, connectionID, schema }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
  }

  const openWorksheetTab = () => {
    const id = `worksheet:${Date.now()}`
    const worksheetCount = tabs.filter(t => t.kind === 'worksheet').length
    const name = `Worksheet ${worksheetCount + 1}`
    const tab: Tab = { id, kind: 'worksheet', connectionID, schema: '', name }
    setTabs(prev => [...prev, tab])
    onCreateWorksheet(id)
    setActiveTabId(id)
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
    onCleanupTab(id)
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
    toClose.forEach(t => onCleanupTab(t.id))
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

  return {
    tabs,
    activeTabId,
    activeTab,
    setActiveTab: setActiveTabId,
    openTableTab,
    openTableTabWithPrefill,
    openSchemaTab,
    openGroupTab,
    openWorksheetTab,
    togglePinTab,
    renameTab,
    closeTab,
    closeAllTabs,
    reorderTabs,
  }
}
