import type { TableState, RowRecord, DirtyCells } from './types'

export function cellKey(rowIndex: number, column: string): string {
  return `${rowIndex}:${column}`
}

export function buildRowEdits(
  target: { schema: string; table: string },
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

export function applyUpdateCell(
  state: TableState,
  rowIndex: number,
  column: string,
  value: string,
): Partial<TableState> {
  return {
    rows: state.rows.map((row, i) => i === rowIndex ? { ...row, [column]: value } : row),
    dirtyCells: { ...state.dirtyCells, [cellKey(rowIndex, column)]: true },
  }
}

export function applyUpdateNewCell(
  state: TableState,
  rowIndex: number,
  column: string,
  value: string,
): Partial<TableState> {
  return {
    newRows: state.newRows.map((row, i) => i === rowIndex ? { ...row, [column]: value } : row),
  }
}

export function applyAddNewRow(state: TableState, row: RowRecord): Partial<TableState> {
  return { newRows: [...state.newRows, row] }
}

export function applyRemoveNewRow(state: TableState, index: number): Partial<TableState> {
  return { newRows: state.newRows.filter((_, i) => i !== index) }
}

export function applyMarkForDelete(state: TableState, rowIndex: number): Partial<TableState> {
  const next = new Set(state.pendingDeletes)
  next.has(rowIndex) ? next.delete(rowIndex) : next.add(rowIndex)
  return { pendingDeletes: next }
}

export function applyDiscard(state: TableState): Partial<TableState> {
  return {
    rows: state.result?.rows as RowRecord[] ?? [],
    newRows: [],
    dirtyCells: {},
    pendingDeletes: new Set(),
    commitError: null,
  }
}

export function buildCommitPayload(
  state: TableState,
  schema: string,
  table: string,
): {
  edits: ReturnType<typeof buildRowEdits>
  inserts: Array<{ schema: string; table: string; values: Record<string, string> }>
  deletes: Array<{ schema: string; table: string; rowId: string }>
} | null {
  const edits = buildRowEdits({ schema, table }, state.dirtyCells, state.rows, state.result?.rowIds ?? [])
  const inserts = state.newRows
    .filter((row) => Object.values(row).some((v) => v !== ''))
    .map((row) => ({
      schema,
      table,
      values: Object.fromEntries(Object.entries(row).filter(([, v]) => v !== '')) as Record<string, string>,
    }))
  const deletes = Array.from(state.pendingDeletes).map((rowIndex) => ({
    schema,
    table,
    rowId: state.result?.rowIds[rowIndex] ?? '',
  }))

  if (edits.length === 0 && inserts.length === 0 && deletes.length === 0) return null
  return { edits, inserts, deletes }
}
