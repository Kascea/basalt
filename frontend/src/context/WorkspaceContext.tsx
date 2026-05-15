import { createContext, useContext } from 'react'
import type { Connection, QueryResult, SchemaObject } from '../../bindings/basalt/db'
import type { Tab, TableState, WorksheetTabState, RowRecord, DirtyCells, FKError } from '../types'

export interface WorkspaceSession {
  // Connection
  activeConnection: Connection | undefined
  objects: SchemaObject[]

  // Tabs
  tabs: Tab[]
  activeTabId: string
  activeTab: Tab
  activeTableState: TableState | null
  activeWorksheetState: WorksheetTabState | null
  setActiveTab: (id: string) => void
  closeTab: (id: string) => void
  togglePinTab: (id: string) => void
  renameTab: (id: string, name: string) => void
  openTableTab: (schema: string, table: string) => void
  openTableTabWithPrefill: (schema: string, table: string, prefill: Record<string, string>) => void
  openSchemaTab: (schema: string, table: string) => void
  openGroupTab: (schema: string, kind: 'sequences' | 'indexes' | 'foreignkeys') => void
  openWorksheetTab: () => void

  // Table editing
  updateCell: (rowIndex: number, col: string, value: string) => void
  updateNewCell: (rowIndex: number, col: string, value: string) => void
  addNewRow: () => void
  removeNewRow: (i: number) => void
  markForDelete: (i: number) => void
  discardEdits: () => void
  commitEdits: () => void
  refreshActiveTable: () => void
  setFilterExpr: (expr: string) => void

  // Worksheet
  isRunning: boolean
  queryResult: QueryResult | null
  queryRows: RowRecord[]
  queryDirty: DirtyCells
  sql: string
  setSql: (sql: string) => void
  runQuery: () => void
  updateQueryCell: (rowIndex: number, col: string, value: string) => void
  discardQueryEdits: () => void

  // Status
  statusMessage: string
  setStatus: (msg: string) => void
  activeFkError: FKError | null
  openFkTab: () => void

  // Display
  nullText: string
}

const WorkspaceContext = createContext<WorkspaceSession | null>(null)

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceSession
  children: React.ReactNode
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceSession(): WorkspaceSession {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspaceSession must be used inside WorkspaceProvider')
  return ctx
}
