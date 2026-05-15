import { createContext, useContext } from 'react'
import type { Connection, QueryResult, SchemaObject } from '../../bindings/basalt/db'
import type { Tab, TableState, WorksheetTabState, RowRecord, DirtyCells, FKError } from '../types'

export interface WorkspaceSession {
  connection: {
    active: Connection | undefined
    objects: SchemaObject[]
  }

  tabs: {
    list: Tab[]
    activeId: string
    active: Tab
    activeTableState: TableState | null
    activeWorksheetState: WorksheetTabState | null
    setActive: (id: string) => void
    close: (id: string) => void
    togglePin: (id: string) => void
    rename: (id: string, name: string) => void
    openTable: (schema: string, table: string) => void
    openTableWithPrefill: (schema: string, table: string, prefill: Record<string, string>) => void
    openSchema: (schema: string, table: string) => void
    openGroup: (schema: string, kind: 'sequences' | 'indexes' | 'foreignkeys') => void
    openWorksheet: () => void
  }

  tableEditor: {
    updateCell: (rowIndex: number, col: string, value: string) => void
    updateNewCell: (rowIndex: number, col: string, value: string) => void
    addRow: () => void
    removeRow: (i: number) => void
    markForDelete: (i: number) => void
    discard: () => void
    commit: () => void
    refresh: () => void
    setFilter: (expr: string) => void
  }

  worksheet: {
    isRunning: boolean
    result: QueryResult | null
    rows: RowRecord[]
    dirtyCells: DirtyCells
    sql: string
    setSql: (sql: string) => void
    run: () => void
    updateCell: (rowIndex: number, col: string, value: string) => void
    discard: () => void
  }

  status: {
    message: string
    set: (msg: string) => void
    activeFkError: FKError | null
    openFkTab: () => void
  }

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
