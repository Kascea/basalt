import { useState } from 'react'
import { DatabaseService, type QueryResult } from '../../bindings/basalt/db'
import { type Tab, type TabKind, type TableState, type WorksheetTabState, type RowRecord, type FKError, cellKey } from '../types'
import {
  applyUpdateCell, applyUpdateNewCell, applyAddNewRow, applyRemoveNewRow,
  applyMarkForDelete, applyDiscard, buildCommitPayload,
} from '../rowEdits'

const WORKSHEET_ID = 'worksheet'

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

function emptyWorksheetState(): WorksheetTabState {
  return { sql: '', result: null, rows: [], dirtyCells: {}, isRunning: false }
}

function baseTabId(kind: TabKind, schema: string, table?: string): string {
  return table ? `${schema}.${table}` : `${schema}:${kind}`
}

function parseFKError(raw: string): FKError | null {
  let msg = raw
  try {
    const jsonStart = raw.indexOf('{')
    if (jsonStart !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart))
      if (parsed.message) msg = parsed.message
    }
  } catch { /* fall through to raw string */ }

  const m = msg.match(/Key \(([^)]+)\)=\(([^)]+)\) is not present in table "([^"]+)"/)
  if (!m) return null
  return { column: m[1], value: m[2], referencedTable: m[3] }
}

export function useTableTabs(connectionID: string, setStatus: (msg: string) => void) {
  const worksheetTab: Tab = { id: WORKSHEET_ID, kind: 'worksheet', connectionID, schema: '', name: 'Worksheet 1' }

  const [tabs, setTabs] = useState<Tab[]>([worksheetTab])
  const [activeTabId, setActiveTabId] = useState(WORKSHEET_ID)
  const [tableStates, setTableStates] = useState<Record<string, TableState>>({})
  const [worksheetStates, setWorksheetStates] = useState<Record<string, WorksheetTabState>>({
    [WORKSHEET_ID]: emptyWorksheetState(),
  })

  const activeTab = tabs.find(t => t.id === activeTabId) ?? worksheetTab
  const activeTableState: TableState | null =
    activeTab.kind === 'table' ? (tableStates[activeTabId] ?? null) : null
  const activeWorksheetState: WorksheetTabState | null =
    activeTab.kind === 'worksheet' ? (worksheetStates[activeTabId] ?? emptyWorksheetState()) : null

  const patchState = (id: string, patch: Partial<TableState>) =>
    setTableStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyTableState()), ...patch },
    }))

  const patchWorksheetState = (id: string, patch: Partial<WorksheetTabState>) =>
    setWorksheetStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyWorksheetState()), ...patch },
    }))

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

  const openTableTabWithPrefill = (schema: string, table: string, prefill: Record<string, string>) => {
    const id = `${baseTabId('table', schema, table)}:${Date.now()}`
    const tab: Tab = { id, kind: 'table', connectionID, schema, table }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
    loadTable(id, schema, table, prefill)
  }

  const openTableTab = (schema: string, table: string) => {
    const existing = tabs.find(t => t.kind === 'table' && t.schema === schema && t.table === table)
    if (existing) { setActiveTabId(existing.id); return }
    const id = `${baseTabId('table', schema, table)}:${Date.now()}`
    const tab: Tab = { id, kind: 'table', connectionID, schema, table }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
    loadTable(id, schema, table)
  }

  const openSchemaTab = (schema: string, table: string) => {
    const id = `${schema}.${table}:schema`
    const existing = tabs.find(t => t.id === id)
    if (existing) { setActiveTabId(id); return }
    const tab: Tab = { id, kind: 'schema', connectionID, schema, table }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
  }

  const openGroupTab = (schema: string, kind: 'sequences' | 'indexes' | 'foreignkeys') => {
    const id = baseTabId(kind, schema)
    const existing = tabs.find(t => t.id === id)
    if (existing) { setActiveTabId(id); return }
    const tab: Tab = { id, kind, connectionID, schema }
    setTabs(prev => [...prev, tab])
    setActiveTabId(id)
  }

  const openWorksheetTab = () => {
    const id = `worksheet:${Date.now()}`
    const worksheetCount = tabs.filter(t => t.kind === 'worksheet').length
    const name = `Worksheet ${worksheetCount + 1}`
    const tab: Tab = { id, kind: 'worksheet', connectionID, schema: '', name }
    setTabs(prev => [...prev, tab])
    setWorksheetStates(prev => ({ ...prev, [id]: emptyWorksheetState() }))
    setActiveTabId(id)
  }

  const togglePinTab = (id: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, pinned: !t.pinned } : t))
  }

  const renameTab = (id: string, name: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name: name.trim() || undefined } : t))
  }

  const closeTab = (id: string) => {
    const tab = tabs.find(t => t.id === id)
    if (tab?.pinned) return
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const next = prev.filter(t => t.id !== id)
      if (activeTabId === id) {
        const newActive = next[Math.max(0, idx - 1)]
        setActiveTabId(newActive?.id ?? '')
      }
      return next
    })
    setTableStates(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setWorksheetStates(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

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
      const s = prev[activeTabId]
      if (!s) return prev
      return { ...prev, [activeTabId]: { ...s, ...applyUpdateCell(s, rowIndex, column, value) } }
    })

  const updateNewCell = (rowIndex: number, column: string, value: string) =>
    setTableStates(prev => {
      const s = prev[activeTabId]
      if (!s) return prev
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
      const s = prev[activeTabId]
      if (!s) return prev
      return { ...prev, [activeTabId]: { ...s, ...applyRemoveNewRow(s, newRowIndex) } }
    })

  const markForDelete = (rowIndex: number) =>
    setTableStates(prev => {
      const s = prev[activeTabId]
      if (!s) return prev
      return { ...prev, [activeTabId]: { ...s, ...applyMarkForDelete(s, rowIndex) } }
    })

  const discardEdits = () =>
    setTableStates(prev => {
      const s = prev[activeTabId]
      if (!s) return prev
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

    Promise.all([
      inserts.length > 0 ? DatabaseService.InsertRows(connectionID, inserts as any) : Promise.resolve(),
      edits.length > 0 ? DatabaseService.CommitEdits(connectionID, edits as any) : Promise.resolve(),
      deletes.length > 0 ? DatabaseService.DeleteRows(connectionID, deletes as any) : Promise.resolve(),
    ])
      .then(() => {
        const parts: string[] = []
        if (inserts.length > 0) parts.push(`${inserts.length} inserted`)
        if (edits.length > 0) parts.push(`${edits.length} updated`)
        if (deletes.length > 0) parts.push(`${deletes.length} deleted`)
        setStatus(`${schema}.${table} — ${parts.join(', ')} committed`)
        patchState(id, { dirtyCells: {}, newRows: [], pendingDeletes: new Set() })
        return DatabaseService.FetchTable(connectionID, schema, table, s.filterExpr)
      })
      .then((res: QueryResult) => {
        patchState(id, { result: res, rows: res.rows as RowRecord[] })
      })
      .catch(err => {
        const errStr = String(err)
        const fkError = parseFKError(errStr)
        setStatus(errStr)
        patchState(id, { commitError: fkError })
      })
      .finally(() => {
        patchState(id, { isCommitting: false })
      })
  }

  // ── Worksheet methods ──

  const setSql = (sql: string) => {
    if (activeTab.kind !== 'worksheet') return
    patchWorksheetState(activeTabId, { sql })
  }

  const runQuery = () => {
    if (activeTab.kind !== 'worksheet') return
    if (!connectionID) { setStatus('Connect to a database before running SQL.'); return }
    const id = activeTabId
    const sql = worksheetStates[id]?.sql ?? ''
    patchWorksheetState(id, { isRunning: true })
    DatabaseService.ExecuteQuery(connectionID, sql)
      .then(res => {
        patchWorksheetState(id, { result: res, rows: res.rows as RowRecord[], dirtyCells: {}, isRunning: false })
        const rows = res.rows.length
        const cols = res.columns.length
        setStatus(cols > 0
          ? `${rows} ${rows === 1 ? 'row' : 'rows'}, ${cols} ${cols === 1 ? 'column' : 'columns'} returned`
          : 'Query executed — no rows returned')
      })
      .catch(err => {
        patchWorksheetState(id, { isRunning: false })
        setStatus(String(err))
      })
  }

  const updateQueryCell = (rowIndex: number, column: string, value: string) => {
    if (activeTab.kind !== 'worksheet') return
    const id = activeTabId
    setWorksheetStates(prev => {
      const s = prev[id] ?? emptyWorksheetState()
      return {
        ...prev,
        [id]: {
          ...s,
          rows: s.rows.map((row, i) => i === rowIndex ? { ...row, [column]: value } : row),
          dirtyCells: { ...s.dirtyCells, [cellKey(rowIndex, column)]: true },
        },
      }
    })
  }

  const discardQueryEdits = () => {
    if (activeTab.kind !== 'worksheet') return
    const id = activeTabId
    setWorksheetStates(prev => {
      const s = prev[id] ?? emptyWorksheetState()
      return { ...prev, [id]: { ...s, rows: s.result?.rows as RowRecord[] ?? [], dirtyCells: {} } }
    })
  }

  return {
    tabs,
    activeTabId,
    setActiveTab: setActiveTabId,
    activeTab,
    activeTableState,
    activeWorksheetState,
    openTableTab,
    openTableTabWithPrefill,
    openSchemaTab,
    openGroupTab,
    openWorksheetTab,
    togglePinTab,
    renameTab,
    closeTab,
    refreshActiveTable,
    setFilterExpr,
    updateCell,
    updateNewCell,
    addNewRow,
    removeNewRow,
    markForDelete,
    discardEdits,
    commitEdits,
    setSql,
    runQuery,
    updateQueryCell,
    discardQueryEdits,
  }
}
