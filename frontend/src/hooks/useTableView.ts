import { useState } from 'react'
import { DatabaseService, type QueryResult } from '../../bindings/basalt'
import { type RowRecord, type DirtyCells, type TableTarget, cellKey, buildRowEdits } from '../types'

export interface TableViewState {
  activeTable: TableTarget | null
  result: QueryResult | null
  rows: RowRecord[]
  dirtyCells: DirtyCells
  isLoading: boolean
  isCommitting: boolean
  openTable: (schema: string, table: string) => void
  refreshTable: () => void
  closeTable: () => void
  updateCell: (rowIndex: number, column: string, value: string) => void
  discardEdits: () => void
  commitEdits: () => void
}

export function useTableView(connectionID: string, setStatus: (msg: string) => void): TableViewState {
  const [activeTable, setActiveTable] = useState<TableTarget | null>(null)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [rows, setRows] = useState<RowRecord[]>([])
  const [dirtyCells, setDirtyCells] = useState<DirtyCells>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  const openTable = (schema: string, table: string) => {
    if (!connectionID) return
    const target: TableTarget = { connectionID, schema, table }
    setActiveTable(target)
    setResult(null)
    setRows([])
    setDirtyCells({})
    setIsLoading(true)
    setStatus(`Loading ${schema}.${table}…`)

    DatabaseService.FetchTable(connectionID, schema, table)
      .then((res) => {
        setResult(res)
        setRows(res.rows as RowRecord[])
        setStatus(res.message)
      })
      .catch((err) => setStatus(String(err)))
      .finally(() => setIsLoading(false))
  }

  const refreshTable = () => {
    if (activeTable) openTable(activeTable.schema, activeTable.table)
  }

  const closeTable = () => setActiveTable(null)

  const updateCell = (rowIndex: number, column: string, value: string) => {
    setRows((r) => r.map((row, i) => (i === rowIndex ? { ...row, [column]: value } : row)))
    setDirtyCells((d) => ({ ...d, [cellKey(rowIndex, column)]: true }))
  }

  const discardEdits = () => {
    setRows(result?.rows as RowRecord[] ?? [])
    setDirtyCells({})
  }

  const commitEdits = () => {
    if (!activeTable || !result) return
    const edits = buildRowEdits(activeTable, dirtyCells, rows, result.rowIds ?? [])
    if (edits.length === 0) return

    setIsCommitting(true)
    DatabaseService.CommitEdits(connectionID, edits as any)
      .then(() => {
        const count = edits.length
        setStatus(`Committed ${count} row ${count === 1 ? 'update' : 'updates'}`)
        setDirtyCells({})
        return DatabaseService.FetchTable(connectionID, activeTable.schema, activeTable.table)
      })
      .then((res) => {
        setResult(res)
        setRows(res.rows as RowRecord[])
      })
      .catch((err) => setStatus(String(err)))
      .finally(() => setIsCommitting(false))
  }

  return {
    activeTable, result, rows, dirtyCells, isLoading, isCommitting,
    openTable, refreshTable, closeTable, updateCell, discardEdits, commitEdits,
  }
}
