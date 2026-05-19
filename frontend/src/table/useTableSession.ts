import { useState } from 'react'
import { type Tab, type TableState, type RowRecord } from '../types'
import {
  applyUpdateCell, applyUpdateNewCell, applyAddNewRow, applyRemoveNewRow,
  applyMarkForDelete, applyDiscard, buildCommitPayload, commitEdits,
} from './editBuffer'
import { DatabaseClient } from '../db/client'

function emptyTableState(): TableState {
  return {
    result: null,
    rows: [],
    newRows: [],
    dirtyCells: {},
    pendingDeletes: new Set(),
    filterExpr: '',
    currentPage: 0,
    totalRows: 0,
    pageSize: 0,
    localPageSize: 0,
    isLoading: true,
    isRefreshing: false,
    isCommitting: false,
    commitError: null,
  }
}

interface UseTableSessionOptions {
  activeTabId: string
  activeTab: Tab
  setStatus: (msg: string, isSuccess?: boolean) => void
}

export function useTableSession({ activeTabId, activeTab, setStatus }: UseTableSessionOptions) {
  const [tableStates, setTableStates] = useState<Record<string, TableState>>({})

  const patchState = (id: string, patch: Partial<TableState>) =>
    setTableStates(prev => ({ ...prev, [id]: { ...(prev[id] ?? emptyTableState()), ...patch } }))

  const activeTableState: TableState | null =
    activeTab.kind === 'table' ? (tableStates[activeTabId] ?? null) : null

  const loadTable = (id: string, connectionID: string, schema: string, table: string, prefill?: Record<string, string>, where?: string) => {
    const filterExpr = where ?? tableStates[id]?.filterExpr ?? ''
    patchState(id, {
      isLoading: true, result: null, rows: [], newRows: [],
      dirtyCells: {}, pendingDeletes: new Set(), commitError: null,
      currentPage: 0,
    })
    setStatus(`Loading ${schema}.${table}…`)
    const localPageSize = tableStates[id]?.localPageSize ?? 0
    DatabaseClient.fetchTable(connectionID, schema, table, filterExpr, 0, localPageSize)
      .then(res => {
        const newRows: RowRecord[] = prefill
          ? [Object.fromEntries(res.columns.map(col => [col, prefill[col] ?? '']))]
          : []
        patchState(id, { result: res, rows: res.rows as RowRecord[], newRows, isLoading: false, totalRows: res.totalRows, pageSize: res.pageSize })
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
    const { connectionID: tabConnectionID, schema, table } = activeTab
    const id = activeTabId
    const where = tableStates[id]?.filterExpr ?? ''
    const page = tableStates[id]?.currentPage ?? 0
    const localPageSize = tableStates[id]?.localPageSize ?? 0
    patchState(id, { isRefreshing: true })
    DatabaseClient.fetchTable(tabConnectionID, schema, table, where, page, localPageSize)
      .then(res => {
        patchState(id, { result: res, rows: res.rows as RowRecord[], isRefreshing: false, totalRows: res.totalRows, pageSize: res.pageSize })
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
    const { connectionID: tabConnectionID, schema, table } = activeTab
    const localPageSize = tableStates[id]?.localPageSize ?? 0
    patchState(id, { filterExpr: expr, isRefreshing: true, currentPage: 0 })
    DatabaseClient.fetchTable(tabConnectionID, schema, table, expr, 0, localPageSize)
      .then(res => {
        patchState(id, { result: res, rows: res.rows as RowRecord[], isRefreshing: false, totalRows: res.totalRows, pageSize: res.pageSize })
        setStatus(res.message)
      })
      .catch(err => {
        patchState(id, { isRefreshing: false })
        setStatus(String(err))
      })
  }

  const goToPage = (page: number) => {
    if (activeTab.kind !== 'table' || !activeTab.table) return
    const id = activeTabId
    const { connectionID: tabConnectionID, schema, table } = activeTab
    const where = tableStates[id]?.filterExpr ?? ''
    const localPageSize = tableStates[id]?.localPageSize ?? 0
    patchState(id, { isRefreshing: true, currentPage: page })
    DatabaseClient.fetchTable(tabConnectionID, schema, table, where, page, localPageSize)
      .then(res => {
        patchState(id, { result: res, rows: res.rows as RowRecord[], isRefreshing: false, totalRows: res.totalRows, pageSize: res.pageSize })
        setStatus(res.message)
      })
      .catch(err => {
        patchState(id, { isRefreshing: false })
        setStatus(String(err))
      })
  }

  const setPageSize = (size: number) => {
    if (activeTab.kind !== 'table' || !activeTab.table) return
    const id = activeTabId
    const { connectionID: tabConnectionID, schema, table } = activeTab
    const where = tableStates[id]?.filterExpr ?? ''
    patchState(id, { isRefreshing: true, localPageSize: size, currentPage: 0 })
    DatabaseClient.fetchTable(tabConnectionID, schema, table, where, 0, size)
      .then(res => {
        patchState(id, { result: res, rows: res.rows as RowRecord[], isRefreshing: false, totalRows: res.totalRows, pageSize: res.pageSize })
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
    if (!activeTab.table) return
    const id = activeTabId
    setTableStates(prev => {
      const s = prev[id]
      if (!s?.result) return prev
      const row: RowRecord = {}
      for (const col of s.result.columns) row[col] = ''
      return { ...prev, [id]: { ...prev[id], ...applyAddNewRow(prev[id], row) } }
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

  const doCommitEdits = () => {
    const s = activeTableState
    if (!s?.result || !activeTab.table) return
    const { schema, table, connectionID } = activeTab
    const id = activeTabId

    // Bail early if there's nothing to commit (avoids the RPC round-trip)
    if (!buildCommitPayload(s, schema, table)) return

    patchState(id, { isCommitting: true, commitError: null })

    commitEdits(s, { connectionID, schema, table }, DatabaseClient)
      .then(outcome => {
        if (!outcome.ok) {
          patchState(id, { commitError: outcome.fkViolation })
          return
        }
        const { inserted, updated, deleted, freshRows } = outcome
        const parts = [
          inserted > 0 && `${inserted} inserted`,
          updated > 0 && `${updated} updated`,
          deleted > 0 && `${deleted} deleted`,
        ].filter(Boolean)
        setStatus(`${schema}.${table} — ${parts.join(', ')} committed`, true)
        patchState(id, {
          dirtyCells: {}, newRows: [], pendingDeletes: new Set(),
          result: freshRows!.result, rows: freshRows!.rows,
        })
      })
      .catch(err => setStatus(String(err)))
      .finally(() => patchState(id, { isCommitting: false }))
  }

  const loadActiveTab = (connectionID: string, schema: string, table: string) => {
    loadTable(activeTabId, connectionID, schema, table)
  }

  return {
    tableStates,
    activeTableState,
    loadTable,
    loadActiveTab,
    removeState,
    refreshActiveTable,
    setFilterExpr,
    goToPage,
    setPageSize,
    updateCell,
    updateNewCell,
    addNewRow,
    removeNewRow,
    markForDelete,
    discardEdits,
    commitEdits: doCommitEdits,
  }
}
