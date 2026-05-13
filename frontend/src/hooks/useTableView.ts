import { useState } from 'react'
import { DatabaseService, type QueryResult } from '../../bindings/basalt'
import { type RowRecord, type DirtyCells, type TableTarget, cellKey, buildRowEdits } from '../types'

export interface TableViewState {
  activeTable: TableTarget | null
  result: QueryResult | null
  rows: RowRecord[]
  newRows: RowRecord[]
  dirtyCells: DirtyCells
  pendingDeletes: Set<number>
  isLoading: boolean
  isCommitting: boolean
  openTable: (schema: string, table: string) => void
  refreshTable: () => void
  closeTable: () => void
  updateCell: (rowIndex: number, column: string, value: string) => void
  updateNewCell: (rowIndex: number, column: string, value: string) => void
  addNewRow: () => void
  removeNewRow: (newRowIndex: number) => void
  markForDelete: (rowIndex: number) => void
  discardEdits: () => void
  commitEdits: () => void
}

export function useTableView(connectionID: string, setStatus: (msg: string) => void): TableViewState {
  const [activeTable, setActiveTable] = useState<TableTarget | null>(null)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [rows, setRows] = useState<RowRecord[]>([])
  const [newRows, setNewRows] = useState<RowRecord[]>([])
  const [dirtyCells, setDirtyCells] = useState<DirtyCells>({})
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  const openTable = (schema: string, table: string) => {
    if (!connectionID) return
    const target: TableTarget = { connectionID, schema, table }
    setActiveTable(target)
    setResult(null)
    setRows([])
    setNewRows([])
    setDirtyCells({})
    setPendingDeletes(new Set())
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

  const updateNewCell = (rowIndex: number, column: string, value: string) => {
    setNewRows((r) => r.map((row, i) => (i === rowIndex ? { ...row, [column]: value } : row)))
  }

  const addNewRow = () => {
    if (!activeTable || !result) return
    const { schema, table } = activeTable
    const columns = result.columns

    DatabaseService.GetNextSequenceValues(connectionID, schema, table)
      .then((seqValues) => {
        const row: RowRecord = {}
        for (const col of columns) row[col] = seqValues[col] ?? ''
        setNewRows((r) => [...r, row])
      })
      .catch(() => {
        // Fall back to empty row if sequence lookup fails
        const row: RowRecord = {}
        for (const col of columns) row[col] = ''
        setNewRows((r) => [...r, row])
      })
  }

  const removeNewRow = (newRowIndex: number) => {
    setNewRows((r) => r.filter((_, i) => i !== newRowIndex))
  }

  const markForDelete = (rowIndex: number) => {
    setPendingDeletes((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) {
        next.delete(rowIndex)
      } else {
        next.add(rowIndex)
      }
      return next
    })
  }

  const discardEdits = () => {
    setRows(result?.rows as RowRecord[] ?? [])
    setNewRows([])
    setDirtyCells({})
    setPendingDeletes(new Set())
  }

  const commitEdits = () => {
    if (!activeTable || !result) return

    const edits = buildRowEdits(activeTable, dirtyCells, rows, result.rowIds ?? [])
    const inserts = newRows
      .filter((row) => Object.values(row).some((v) => v !== ''))
      .map((row) => ({
        schema: activeTable.schema,
        table: activeTable.table,
        values: Object.fromEntries(
          Object.entries(row).filter(([, v]) => v !== '')
        ) as Record<string, string>,
      }))
    const deletes = Array.from(pendingDeletes).map((rowIndex) => ({
      schema: activeTable.schema,
      table: activeTable.table,
      rowId: result.rowIds[rowIndex] ?? '',
    }))

    if (edits.length === 0 && inserts.length === 0 && deletes.length === 0) return

    setIsCommitting(true)

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
        setStatus(`Committed: ${parts.join(', ')}`)
        setDirtyCells({})
        setNewRows([])
        setPendingDeletes(new Set())
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
    activeTable, result, rows, newRows, dirtyCells, pendingDeletes,
    isLoading, isCommitting,
    openTable, refreshTable, closeTable,
    updateCell, updateNewCell, addNewRow, removeNewRow, markForDelete,
    discardEdits, commitEdits,
  }
}
