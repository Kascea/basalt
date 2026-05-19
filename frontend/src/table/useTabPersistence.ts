import { useEffect, useRef } from 'react'
import type { Tab } from '../types'
import type { useTableTabs } from './useTableTabs'

const STORAGE_KEY = 'basalt:tabs'

interface PersistedTabs {
  tabs: Tab[]
  activeTabId: string
  worksheetSQL: Record<string, string>
}

type TableTabs = ReturnType<typeof useTableTabs>

export function useTabPersistence(tableTabs: TableTabs) {
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const persisted = JSON.parse(raw) as PersistedTabs
      if (persisted.tabs.length === 0) return
      tableTabs.restoreTabs(persisted.tabs, persisted.activeTabId, persisted.worksheetSQL)
    } catch {
      // ignore malformed storage
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const worksheetSQL: Record<string, string> = {}
      for (const [id, state] of Object.entries(tableTabs.worksheetStates)) {
        if (state.sql) worksheetSQL[id] = state.sql
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tabs: tableTabs.tabs,
        activeTabId: tableTabs.activeTabId,
        worksheetSQL,
      }))
    }, 500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [tableTabs.tabs, tableTabs.activeTabId, tableTabs.worksheetStates])
}
