import { createContext, useContext, useMemo } from 'react'
import type { Tab, TableState, WorksheetTabState } from '../types'

export interface TabSession {
  list: Tab[]
  activeId: string
  active: Tab
  activeTableState: TableState | null
  activeWorksheetState: WorksheetTabState | null
  setActive: (id: string) => void
  close: (id: string) => void
  closeAll: () => void
  togglePin: (id: string) => void
  rename: (id: string, name: string) => void
  openTable: (connectionID: string, schema: string, table: string) => void
  openTableWithPrefill: (connectionID: string, schema: string, table: string, prefill: Record<string, string>) => void
  openSchema: (connectionID: string, schema: string, table: string, addColumn?: boolean) => void
  openGroup: (connectionID: string, schema: string, kind: 'sequences' | 'indexes' | 'foreignkeys') => void
  openWorksheet: (connectionID?: string) => void
  setTabConnectionID: (tabId: string, connectionID: string) => void
  reorder: (fromIdx: number, toIdx: number) => void
}

const TabContext = createContext<TabSession | null>(null)

export function TabProvider({ value, children }: { value: TabSession; children: React.ReactNode }) {
  return <TabContext.Provider value={value}>{children}</TabContext.Provider>
}

export function useTabSession(): TabSession {
  const ctx = useContext(TabContext)
  if (!ctx) throw new Error('useTabSession must be used inside TabProvider')
  return ctx
}

export function useTabSessionValue(raw: Omit<TabSession, never>): TabSession {
  return useMemo(() => raw, [
    raw.list, raw.activeId, raw.active,
    raw.activeTableState, raw.activeWorksheetState,
  ]) // eslint-disable-line react-hooks/exhaustive-deps
}
