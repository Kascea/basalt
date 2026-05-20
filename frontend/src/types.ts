import type { QueryResult } from '../bindings/basalt/db'

export type RowRecord = Record<string, string | undefined>

export type SortDirection = 'asc' | 'desc'

export type TabKind = 'worksheet' | 'table' | 'sequences' | 'indexes' | 'foreignkeys' | 'schema'

export interface Tab {
  id: string
  kind: TabKind
  connectionID: string
  schema: string
  table?: string
  pinned?: boolean
  name?: string
  addColumn?: boolean
}

export interface WorksheetTabState {
  sql: string
  result: QueryResult | null
  rows: RowRecord[]
  dirtyCells: DirtyCells
  isRunning: boolean
  isPlanLoading: boolean
  planLines: string[]
  log: LogEntry[]
}

export interface FKError {
  column: string
  value: string
  referencedTable: string
}

export interface TableState {
  result: QueryResult | null
  rows: RowRecord[]
  newRows: RowRecord[]
  dirtyCells: DirtyCells
  pendingDeletes: Set<number>
  filterExpr: string
  currentPage: number
  totalRows: number
  pageSize: number
  localPageSize: number
  isLoading: boolean
  isRefreshing: boolean
  isCommitting: boolean
  commitError: FKError | null
}
export type DirtyCells = Record<string, boolean>

export interface TableTarget {
  connectionID: string
  schema: string
  table: string
}

export interface LogEntry {
  id: number
  ts: string
  text: string
  isError: boolean
  isSuccess?: boolean
  durationMs?: number
}

// cellKey lives in editBuffer.ts; re-exported here so existing imports keep working.
export { cellKey } from './table/editBuffer'
