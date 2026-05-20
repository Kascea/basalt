import { useState } from 'react'
import { DatabaseService, type QueryResult } from '../../bindings/basalt/db'
import { type RowRecord, type DirtyCells, cellKey } from '../types'
import { parseError } from '../lib/parseError'

export interface WorksheetState {
  sql: string
  result: QueryResult | null
  rows: RowRecord[]
  dirtyCells: DirtyCells
  isRunning: boolean
  setSql: (v: string) => void
  runQuery: () => void
  updateCell: (rowIndex: number, column: string, value: string) => void
  discardEdits: () => void
}

export function useWorksheet(connectionID: string, setStatus: (msg: string) => void): WorksheetState {
  const [sql, setSql] = useState<string>('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [rows, setRows] = useState<RowRecord[]>([])
  const [dirtyCells, setDirtyCells] = useState<DirtyCells>({})
  const [isRunning, setIsRunning] = useState(false)

  const runQuery = () => {
    if (!connectionID) {
      setStatus('Connect to a database before running SQL.')
      return
    }
    setIsRunning(true)
    DatabaseService.ExecuteQuery(connectionID, sql)
      .then((res) => {
        setResult(res)
        setRows(res.rows as RowRecord[])
        setDirtyCells({})
        setStatus(res.message)
      })
      .catch((err) => setStatus(parseError(err)))
      .finally(() => setIsRunning(false))
  }

  const updateCell = (rowIndex: number, column: string, value: string) => {
    setRows((r) => r.map((row, i) => (i === rowIndex ? { ...row, [column]: value } : row)))
    setDirtyCells((d) => ({ ...d, [cellKey(rowIndex, column)]: true }))
  }

  const discardEdits = () => {
    setRows(result?.rows as RowRecord[] ?? [])
    setDirtyCells({})
  }

  return { sql, result, rows, dirtyCells, isRunning, setSql, runQuery, updateCell, discardEdits }
}
