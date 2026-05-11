import { useState } from 'react'
import { type QueryResult } from '../../bindings/basalt'
import { type TableTarget, type RowRecord, type DirtyCells, type FilterClause, type SortDirection } from '../types'
import { GridToolbar } from './GridToolbar'
import { FilterBar } from './FilterBar'
import { DataGrid } from './DataGrid'

interface Props {
  target: TableTarget
  result: QueryResult | null
  rows: RowRecord[]
  dirtyCells: DirtyCells
  isLoading: boolean
  isCommitting: boolean
  onCellChange: (rowIndex: number, column: string, value: string) => void
  onRefresh: () => void
  onDiscard: () => void
  onCommit: () => void
}

export function TableView({
  target, result, rows, dirtyCells, isLoading, isCommitting,
  onCellChange, onRefresh, onDiscard, onCommit,
}: Props) {
  const [filters, setFilters] = useState<FilterClause[]>([])
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null)

  const handleColumnDoubleClick = (col: string) => {
    if (sortColumn !== col) {
      setSortColumn(col)
      setSortDirection('asc')
    } else if (sortDirection === 'asc') {
      setSortDirection('desc')
    } else {
      setSortColumn(null)
      setSortDirection(null)
    }
  }

  const label = `${target.schema}.${target.table}`
  const dirtyCount = Object.keys(dirtyCells).length
  const columns = result?.columns ?? []

  return (
    <div className="table-view">
      <GridToolbar
        label={label}
        rowCount={rows.length}
        dirtyCount={dirtyCount}
        isCommitting={isCommitting}
        onRefresh={onRefresh}
        onDiscard={onDiscard}
        onCommit={onCommit}
      />
      <FilterBar
        columns={columns}
        filters={filters}
        onFiltersChange={setFilters}
      />
      {isLoading ? (
        <p className="empty-state centered">Loading {label}…</p>
      ) : (
        <DataGrid
          columns={columns}
          rows={rows}
          dirtyCells={dirtyCells}
          filters={filters}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onCellChange={onCellChange}
          onColumnDoubleClick={handleColumnDoubleClick}
          emptyMessage={result ? 'No rows match the filter' : 'Open a table from the sidebar'}
        />
      )}
    </div>
  )
}
