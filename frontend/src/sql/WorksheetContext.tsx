import { createContext, useContext, useMemo } from 'react'
import type { QueryResult } from '../../bindings/basalt/db'
import type { RowRecord, DirtyCells, LogEntry } from '../types'

export interface WorksheetSession {
  isRunning: boolean
  isPlanLoading: boolean
  planLines: string[]
  result: QueryResult | null
  rows: RowRecord[]
  dirtyCells: DirtyCells
  sql: string
  log: LogEntry[]
  setSql: (sql: string) => void
  run: () => void
  updateCell: (rowIndex: number, col: string, value: string) => void
  discard: () => void
  clearLog: () => void
}

const WorksheetContext = createContext<WorksheetSession | null>(null)

export function WorksheetProvider({ value, children }: { value: WorksheetSession; children: React.ReactNode }) {
  return <WorksheetContext.Provider value={value}>{children}</WorksheetContext.Provider>
}

export function useWorksheetSession(): WorksheetSession {
  const ctx = useContext(WorksheetContext)
  if (!ctx) throw new Error('useWorksheetSession must be used inside WorksheetProvider')
  return ctx
}

export function useWorksheetSessionValue(raw: WorksheetSession): WorksheetSession {
  return useMemo(() => raw, [raw.isRunning, raw.result, raw.rows, raw.dirtyCells, raw.sql, raw.log]) // eslint-disable-line react-hooks/exhaustive-deps
}
