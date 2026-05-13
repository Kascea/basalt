import { useState } from 'react'
import { type QueryResult } from '../../bindings/basalt'
import { type TableTarget, type RowRecord, type DirtyCells, type SortDirection } from '../types'
import { GridToolbar } from './GridToolbar'
import { FilterBar } from './FilterBar'
import { DataGrid, buildFilter } from './DataGrid'

interface Props {
  target: TableTarget
  result: QueryResult | null
  rows: RowRecord[]
  newRows: RowRecord[]
  dirtyCells: DirtyCells
  pendingDeletes: Set<number>
  isLoading: boolean
  isCommitting: boolean
  onCellChange: (rowIndex: number, column: string, value: string) => void
  onNewCellChange: (rowIndex: number, column: string, value: string) => void
  onAddRow: () => void
  onRemoveNewRow: (newRowIndex: number) => void
  onDeleteRow: (rowIndex: number) => void
  onRefresh: () => void
  onDiscard: () => void
  onCommit: () => void
}

export function TableView({
  target, result, rows, newRows, dirtyCells, pendingDeletes,
  isLoading, isCommitting,
  onCellChange, onNewCellChange, onAddRow, onRemoveNewRow, onDeleteRow,
  onRefresh, onDiscard, onCommit,
}: Props) {
  const [filterExpr, setFilterExpr] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null)

  const columns = result?.columns ?? []
  const columnTypes = result?.columnTypes ?? []

  const filterError = filterExpr.trim() !== '' && buildFilter(filterExpr, columns) === null

  const handleSortChange = (col: string, dir: SortDirection | null) => {
    setSortColumn(dir ? col : null)
    setSortDirection(dir)
  }

  const handleAddFilter = (col: string) => {
    setFilterExpr(prev => {
      const snippet = `${col} = ''`
      return prev.trim() ? `${prev.trim()} AND ${snippet}` : snippet
    })
  }

  const label = `${target.schema}.${target.table}`
  const dirtyCount = Object.keys(dirtyCells).length

  return (
    <div className="table-view">
      <GridToolbar
        label={label}
        rowCount={rows.length}
        newRowCount={newRows.length}
        dirtyCount={dirtyCount}
        deleteCount={pendingDeletes.size}
        isCommitting={isCommitting}
        onRefresh={onRefresh}
        onDiscard={onDiscard}
        onCommit={onCommit}
        onAddRow={onAddRow}
      />
      <FilterBar
        expr={filterExpr}
        hasError={filterError}
        onChange={setFilterExpr}
      />
      {isLoading ? (
        <p className="empty-state centered">Loading {label}…</p>
      ) : (
        <DataGrid
          columns={columns}
          columnTypes={columnTypes}
          rows={rows}
          newRows={newRows}
          dirtyCells={dirtyCells}
          pendingDeletes={pendingDeletes}
          filterExpr={filterExpr}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onCellChange={onCellChange}
          onNewCellChange={onNewCellChange}
          onDeleteRow={onDeleteRow}
          onRemoveNewRow={onRemoveNewRow}
          onSortChange={handleSortChange}
          onAddFilter={handleAddFilter}
          emptyMessage={result ? 'No rows match the filter' : 'Open a table from the sidebar'}
        />
      )}
    </div>
  )
}
