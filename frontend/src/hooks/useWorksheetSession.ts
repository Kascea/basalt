import { useState } from 'react'
import { DatabaseService } from '../../bindings/basalt/db'
import { type Tab, type WorksheetTabState, type RowRecord, cellKey } from '../types'

function emptyWorksheetState(): WorksheetTabState {
  return { sql: '', result: null, rows: [], dirtyCells: {}, isRunning: false }
}

const INITIAL_WORKSHEET_ID = 'worksheet'

interface UseWorksheetSessionOptions {
  connectionID: string
  activeTabId: string
  activeTab: Tab
  setStatus: (msg: string, isSuccess?: boolean) => void
}

export function useWorksheetSession({ connectionID, activeTabId, activeTab, setStatus }: UseWorksheetSessionOptions) {
  const [worksheetStates, setWorksheetStates] = useState<Record<string, WorksheetTabState>>({
    [INITIAL_WORKSHEET_ID]: emptyWorksheetState(),
  })

  const patchWorksheetState = (id: string, patch: Partial<WorksheetTabState>) =>
    setWorksheetStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyWorksheetState()), ...patch },
    }))

  const activeWorksheetState: WorksheetTabState | null =
    activeTab.kind === 'worksheet' ? (worksheetStates[activeTabId] ?? emptyWorksheetState()) : null

  const createWorksheet = (id: string) => {
    setWorksheetStates(prev => ({ ...prev, [id]: emptyWorksheetState() }))
  }

  const removeState = (id: string) =>
    setWorksheetStates(prev => { const next = { ...prev }; delete next[id]; return next })

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
    worksheetStates,
    activeWorksheetState,
    createWorksheet,
    removeState,
    setSql,
    runQuery,
    updateQueryCell,
    discardQueryEdits,
  }
}
