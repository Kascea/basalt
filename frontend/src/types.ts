import type { QueryResult } from '../bindings/basalt'

export type RowRecord = Record<string, string | undefined>

export type SortDirection = 'asc' | 'desc'

export type TabKind = 'worksheet' | 'table' | 'sequences' | 'indexes' | 'foreignkeys'

export interface Tab {
  id: string
  kind: TabKind
  connectionID: string
  schema: string
  table?: string
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

export function cellKey(rowIndex: number, column: string): string {
  return `${rowIndex}:${column}`
}

export function buildRowEdits(
  target: Pick<TableTarget, 'schema' | 'table'>,
  dirtyCells: DirtyCells,
  rows: RowRecord[],
  rowIds: string[],
): Array<{ schema: string; table: string; rowId: string; changes: Record<string, string> }> {
  const byRow = new Map<number, Record<string, string>>()

  for (const key of Object.keys(dirtyCells)) {
    const colonIdx = key.indexOf(':')
    const rowIndex = parseInt(key.slice(0, colonIdx), 10)
    const column = key.slice(colonIdx + 1)
    const value = rows[rowIndex]?.[column] ?? ''
    if (!byRow.has(rowIndex)) byRow.set(rowIndex, {})
    byRow.get(rowIndex)![column] = value
  }

  return Array.from(byRow.entries()).map(([rowIndex, changes]) => ({
    schema: target.schema,
    table: target.table,
    rowId: rowIds[rowIndex] ?? '',
    changes,
  }))
}
