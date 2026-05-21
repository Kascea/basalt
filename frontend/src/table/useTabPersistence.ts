import { useEffect, useRef } from 'react'
import { storage } from '../storage'
import type { useTableTabs } from './useTableTabs'

type TableTabs = ReturnType<typeof useTableTabs>

export function useTabPersistence(tableTabs: TableTabs) {
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const persisted = storage.tabs.get()
    if (!persisted || persisted.tabs.length === 0) return
    tableTabs.restoreTabs(persisted.tabs, persisted.activeTabId, persisted.worksheetSQL)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const worksheetSQL: Record<string, string> = {}
      for (const [id, state] of Object.entries(tableTabs.worksheetStates)) {
        if (state.sql) worksheetSQL[id] = state.sql
      }
      storage.tabs.set({
        tabs: tableTabs.tabs,
        activeTabId: tableTabs.activeTabId,
        worksheetSQL,
      })
    }, 500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [tableTabs.tabs, tableTabs.activeTabId, tableTabs.worksheetStates])
}
