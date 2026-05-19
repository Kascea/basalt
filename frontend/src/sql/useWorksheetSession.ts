import { useState, useRef } from 'react'
import { type Tab, type WorksheetTabState, type RowRecord, type LogEntry, cellKey } from '../types'
import { DatabaseClient } from '../db/client'

function emptyWorksheetState(): WorksheetTabState {
  return { sql: '', result: null, rows: [], dirtyCells: {}, isRunning: false, log: [] }
}

const INITIAL_WORKSHEET_ID = 'worksheet'

interface UseWorksheetSessionOptions {
  activeTabId: string
  activeTab: Tab
  setStatus: (msg: string, isSuccess?: boolean) => void
}

export function useWorksheetSession({ activeTabId, activeTab }: UseWorksheetSessionOptions) {
  const [worksheetStates, setWorksheetStates] = useState<Record<string, WorksheetTabState>>({
    [INITIAL_WORKSHEET_ID]: emptyWorksheetState(),
  })
  const logIdRef = useRef(1)

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

  const makeLogEntry = (text: string, isError: boolean, isSuccess = false, durationMs?: number): LogEntry => ({
    id: logIdRef.current++,
    ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
    text,
    isError,
    isSuccess,
    durationMs,
  })

  const runQuery = () => {
    if (activeTab.kind !== 'worksheet') return
    if (!activeTab.connectionID) {
      const id = activeTabId
      setWorksheetStates(prev => ({
        ...prev,
        [id]: {
          ...(prev[id] ?? emptyWorksheetState()),
          log: [...(prev[id]?.log ?? []), makeLogEntry('No database connection selected.', true)],
        },
      }))
      return
    }
    const id = activeTabId
    const sql = worksheetStates[id]?.sql ?? ''
    patchWorksheetState(id, { isRunning: true })
    DatabaseClient.executeQuery(activeTab.connectionID, sql)
      .then(res => {
        const rows = res.rows.length
        const cols = res.columns.length
        const msg = cols > 0
          ? `${rows} ${rows === 1 ? 'row' : 'rows'}, ${cols} ${cols === 1 ? 'column' : 'columns'} returned`
          : 'Query executed — no rows returned'
        setWorksheetStates(prev => ({
          ...prev,
          [id]: {
            ...(prev[id] ?? emptyWorksheetState()),
            result: res,
            rows: res.rows as RowRecord[],
            dirtyCells: {},
            isRunning: false,
            log: [...(prev[id]?.log ?? []), makeLogEntry(msg, false, true, res.durationMs)],
          },
        }))
      })
      .catch(err => {
        setWorksheetStates(prev => ({
          ...prev,
          [id]: {
            ...(prev[id] ?? emptyWorksheetState()),
            isRunning: false,
            log: [...(prev[id]?.log ?? []), makeLogEntry(String(err), true)],
          },
        }))
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

  const clearWorksheetLog = () => {
    if (activeTab.kind !== 'worksheet') return
    patchWorksheetState(activeTabId, { log: [] })
  }

  const initWorksheetState = (id: string, sql: string) => {
    setWorksheetStates(prev => ({ ...prev, [id]: { ...emptyWorksheetState(), sql } }))
  }

  return {
    worksheetStates,
    activeWorksheetState,
    createWorksheet,
    initWorksheetState,
    removeState,
    setSql,
    runQuery,
    updateQueryCell,
    discardQueryEdits,
    clearWorksheetLog,
  }
}
