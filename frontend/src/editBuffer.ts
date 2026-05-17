import type { TableState, RowRecord, DirtyCells, FKError } from './types'
import type { DatabaseClient } from './db/client'

// EditBuffer — the accumulated, uncommitted edits for a table tab.
// Separating this type from TableState's async-status fields makes the
// state machine explicit: callers work with the buffer, not scattered flags.
export type EditBuffer = Pick<TableState, 'rows' | 'newRows' | 'dirtyCells' | 'pendingDeletes' | 'commitError'>

export function cellKey(rowIndex: number, column: string): string {
  return `${rowIndex}:${column}`
}

export function applyUpdateCell(
  state: EditBuffer,
  rowIndex: number,
  column: string,
  value: string,
): Partial<EditBuffer> {
  return {
    rows: state.rows.map((row, i) => i === rowIndex ? { ...row, [column]: value } : row),
    dirtyCells: { ...state.dirtyCells, [cellKey(rowIndex, column)]: true },
  }
}

export function applyUpdateNewCell(
  state: EditBuffer,
  rowIndex: number,
  column: string,
  value: string,
): Partial<EditBuffer> {
  return {
    newRows: state.newRows.map((row, i) => i === rowIndex ? { ...row, [column]: value } : row),
  }
}

export function applyAddNewRow(state: EditBuffer, row: RowRecord): Partial<EditBuffer> {
  return { newRows: [...state.newRows, row] }
}

export function applyRemoveNewRow(state: EditBuffer, index: number): Partial<EditBuffer> {
  return { newRows: state.newRows.filter((_, i) => i !== index) }
}

export function applyMarkForDelete(state: EditBuffer, rowIndex: number): Partial<EditBuffer> {
  const next = new Set(state.pendingDeletes)
  next.has(rowIndex) ? next.delete(rowIndex) : next.add(rowIndex)
  return { pendingDeletes: next }
}

export function applyDiscard(state: EditBuffer & { result: TableState['result'] }): Partial<EditBuffer> {
  return {
    rows: state.result?.rows as RowRecord[] ?? [],
    newRows: [],
    dirtyCells: {},
    pendingDeletes: new Set(),
    commitError: null,
  }
}

function buildRowEdits(
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

export type CommitOutcome =
  | { ok: true; inserted: number; updated: number; deleted: number }
  | { ok: false; fkViolation: FKError }

// commitEdits encapsulates the full commit state machine: build payload → call RPC →
// classify the result (FK violation vs. success) → fetch fresh rows.
// The caller handles UI state flags (isCommitting); this function owns the logic.
export async function commitEdits(
  state: TableState,
  target: { connectionID: string; schema: string; table: string },
  client: typeof DatabaseClient,
): Promise<CommitOutcome & { freshRows?: { result: TableState['result']; rows: RowRecord[] } }> {
  const payload = buildCommitPayload(state, target.schema, target.table)
  if (!payload) throw new Error('no edits to commit')

  const violation = await client.commitTableEdits(target.connectionID, payload as any)
  if (violation) {
    return {
      ok: false,
      fkViolation: { column: violation.column, value: violation.value, referencedTable: violation.referencedTable },
    }
  }

  const res = await client.fetchTable(target.connectionID, target.schema, target.table, state.filterExpr)
  return {
    ok: true,
    inserted: payload.inserts.length,
    updated: payload.edits.length,
    deleted: payload.deletes.length,
    freshRows: { result: res, rows: res.rows as RowRecord[] },
  }
}
