import { useState } from 'react'
import { DatabaseService, type QueryResult } from '../../bindings/basalt/db'
import { type Tab, type TableState, type RowRecord } from '../types'
import {
  applyUpdateCell, applyUpdateNewCell, applyAddNewRow, applyRemoveNewRow,
  applyMarkForDelete, applyDiscard, buildCommitPayload,
} from '../rowEdits'

function emptyTableState(): TableState {
  return {
    result: null,
    rows: [],
    newRows: [],
    dirtyCells: {},
    pendingDeletes: new Set(),
    filterExpr: '',
    isLoading: true,
    isRefreshing: false,
    isCommitting: false,
    commitError: null,
  }
}

interface UseTableSessionOptions {
  connectionID: string
  activeTabId: string
  activeTab: Tab
  setStatus: (msg: string, isSuccess?: boolean) => void
}

export function useTableSession({ connectionID, activeTabId, activeTab, setStatus }: UseTableSessionOptions) {
  const [tableStates, setTableStates] = useState<Record<string, TableState>>({})

  const patchState = (id: string, patch: Partial<TableState>) =>
    setTableStates(prev => ({ ...prev, [id]: { ...(prev[id] ?? emptyTableState()), ...patch } }))

  const activeTableState: TableState | null =
    activeTab.kind === 'table' ? (tableStates[activeTabId] ?? null) : null

  const loadTable = (id: string, schema: string, table: string, prefill?: Record<string, string>, where?: string) => {
    const filterExpr = where ?? tableStates[id]?.filterExpr ?? ''
    patchState(id, {
      isLoading: true, result: null, rows: [], newRows: [],
      dirtyCells: {}, pendingDeletes: new Set(), commitError: null,
    })
    setStatus(`Loading ${schema}.${table}…`)
    DatabaseService.FetchTable(connectionID, schema, table, filterExpr)
      .then(res => {
        const newRows: RowRecord[] = prefill
          ? [Object.fromEntries(res.columns.map(col => [col, prefill[col] ?? '']))]
          : []
        patchState(id, { result: res, rows: res.rows as RowRecord[], newRows, isLoading: false })
        setStatus(res.message)
      })
      .catch(err => {
        patchState(id, { isLoading: false })
        setStatus(String(err))
      })
  }

  const removeState = (id: string) =>
    setTableStates(prev => { const next = { ...prev }; delete next[id]; return next })

  const refreshActiveTable = () => {
    if (activeTab.kind !== 'table' || !activeTab.table) return
    const { schema, table } = activeTab
    const id = activeTabId
    const where = tableStates[id]?.filterExpr ?? ''
    patchState(id, { isRefreshing: true })
    DatabaseService.FetchTable(connectionID, schema, table, where)
      .then(res => {
        patchState(id, { result: res, rows: res.rows as RowRecord[], isRefreshing: false })
        setStatus(res.message)
      })
      .catch(err => {
        patchState(id, { isRefreshing: false })
        setStatus(String(err))
      })
  }

  const setFilterExpr = (expr: string) => {
    if (activeTab.kind !== 'table' || !activeTab.table) return
    const id = activeTabId
    const { schema, table } = activeTab
    patchState(id, { filterExpr: expr, isRefreshing: true })
    DatabaseService.FetchTable(connectionID, schema, table, expr)
      .then(res => {
        patchState(id, { result: res, rows: res.rows as RowRecord[], isRefreshing: false })
        setStatus(res.message)
      })
      .catch(err => {
        patchState(id, { isRefreshing: false })
        setStatus(String(err))
      })
  }

  const updateCell = (rowIndex: number, column: string, value: string) =>
    setTableStates(prev => {
      const s = prev[activeTabId]; if (!s) return prev
      return { ...prev, [activeTabId]: { ...s, ...applyUpdateCell(s, rowIndex, column, value) } }
    })

  const updateNewCell = (rowIndex: number, column: string, value: string) =>
    setTableStates(prev => {
      const s = prev[activeTabId]; if (!s) return prev
      return { ...prev, [activeTabId]: { ...s, ...applyUpdateNewCell(s, rowIndex, column, value) } }
    })

  const addNewRow = () => {
    const s = activeTableState
    if (!s?.result || !activeTab.table) return
    const { schema, table } = activeTab
    const columns = s.result.columns
    const id = activeTabId

    DatabaseService.GetNextSequenceValues(connectionID, schema, table)
      .then(seqValues => {
        const row: RowRecord = {}
        for (const col of columns) row[col] = seqValues[col] ?? ''
        setTableStates(prev => ({ ...prev, [id]: { ...prev[id], ...applyAddNewRow(prev[id], row) } }))
      })
      .catch(() => {
        const row: RowRecord = {}
        for (const col of columns) row[col] = ''
        setTableStates(prev => ({ ...prev, [id]: { ...prev[id], ...applyAddNewRow(prev[id], row) } }))
      })
  }

  const removeNewRow = (newRowIndex: number) =>
    setTableStates(prev => {
      const s = prev[activeTabId]; if (!s) return prev
      return { ...prev, [activeTabId]: { ...s, ...applyRemoveNewRow(s, newRowIndex) } }
    })

  const markForDelete = (rowIndex: number) =>
    setTableStates(prev => {
      const s = prev[activeTabId]; if (!s) return prev
      return { ...prev, [activeTabId]: { ...s, ...applyMarkForDelete(s, rowIndex) } }
    })

  const discardEdits = () =>
    setTableStates(prev => {
      const s = prev[activeTabId]; if (!s) return prev
      return { ...prev, [activeTabId]: { ...s, ...applyDiscard(s) } }
    })

  const commitEdits = () => {
    const s = activeTableState
    if (!s?.result || !activeTab.table) return
    const { schema, table } = activeTab
    const id = activeTabId

    const payload = buildCommitPayload(s, schema, table)
    if (!payload) return

    const { edits, inserts, deletes } = payload
    patchState(id, { isCommitting: true, commitError: null })

    DatabaseService.CommitTableEdits(connectionID, { inserts, edits, deletes } as any)
      .then(violation => {
        if (violation) {
          patchState(id, { commitError: { column: violation.column, value: violation.value, referencedTable: violation.referencedTable } })
          return Promise.reject(null)
        }
        const parts: string[] = []
        if (inserts.length > 0) parts.push(`${inserts.length} inserted`)
        if (edits.length > 0) parts.push(`${edits.length} updated`)
        if (deletes.length > 0) parts.push(`${deletes.length} deleted`)
        setStatus(`${schema}.${table} — ${parts.join(', ')} committed`, true)
        patchState(id, { dirtyCells: {}, newRows: [], pendingDeletes: new Set() })
        return DatabaseService.FetchTable(connectionID, schema, table, s.filterExpr)
      })
      .then((res: QueryResult) => {
        patchState(id, { result: res, rows: res.rows as RowRecord[] })
      })
      .catch(err => {
        if (err !== null) setStatus(String(err))
      })
      .finally(() => {
        patchState(id, { isCommitting: false })
      })
  }

  return {
    tableStates,
    activeTableState,
    loadTable,
    removeState,
    refreshActiveTable,
    setFilterExpr,
    updateCell,
    updateNewCell,
    addNewRow,
    removeNewRow,
    markForDelete,
    discardEdits,
    commitEdits,
  }
}
