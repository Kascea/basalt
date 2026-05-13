import { useState } from 'react'
import { type QueryResult } from '../../bindings/basalt'
import { type TableTarget, type RowRecord, type DirtyCells, type SortDirection } from '../types'
import { GridToolbar } from './GridToolbar'
import { FilterBar } from './FilterBar'
import { DataGrid } from './DataGrid'

interface Props {
  target: TableTarget
  result: QueryResult | null
  rows: RowRecord[]
  newRows: RowRecord[]
  dirtyCells: DirtyCells
  pendingDeletes: Set<number>
  filterExpr: string
  isLoading: boolean
  isRefreshing: boolean
  isCommitting: boolean
  onCellChange: (rowIndex: number, column: string, value: string) => void
  onNewCellChange: (rowIndex: number, column: string, value: string) => void
  onAddRow: () => void
  onRemoveNewRow: (newRowIndex: number) => void
  onDeleteRow: (rowIndex: number) => void
  onRefresh: () => void
  onFilterChange: (expr: string) => void
  onDiscard: () => void
  onCommit: () => void
  nullText?: string
}

export function TableView({
  target, result, rows, newRows, dirtyCells, pendingDeletes,
  filterExpr,
  isLoading, isRefreshing, isCommitting,
  onCellChange, onNewCellChange, onAddRow, onRemoveNewRow, onDeleteRow,
  onRefresh, onFilterChange, onDiscard, onCommit,
  nullText = 'NULL',
}: Props) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null)

  const columns = result?.columns ?? []
  const columnTypes = result?.columnTypes ?? []

  const handleSortChange = (col: string, dir: SortDirection | null) => {
    setSortColumn(dir ? col : null)
    setSortDirection(dir)
  }

  const handleAddFilter = (col: string) => {
    const snippet = `${col} = ''`
    const next = filterExpr.trim() ? `${filterExpr.trim()} AND ${snippet}` : snippet
    onFilterChange(next)
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
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
        onDiscard={onDiscard}
        onCommit={onCommit}
        onAddRow={onAddRow}
      />
      <div className={`table-refresh-bar${isRefreshing ? ' active' : ''}`} />
      <FilterBar
        expr={filterExpr}
        hasError={false}
        onChange={onFilterChange}
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
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onCellChange={onCellChange}
          onNewCellChange={onNewCellChange}
          onDeleteRow={onDeleteRow}
          onRemoveNewRow={onRemoveNewRow}
          nullText={nullText}
          onSortChange={handleSortChange}
          onAddFilter={handleAddFilter}
          emptyMessage={result ? 'No rows returned' : 'Open a table from the sidebar'}
        />
      )}
    </div>
  )
}
