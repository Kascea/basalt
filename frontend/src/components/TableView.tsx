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
  const [filterExpr, setFilterExpr] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null)

  const columns = result?.columns ?? []

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
        dirtyCount={dirtyCount}
        isCommitting={isCommitting}
        onRefresh={onRefresh}
        onDiscard={onDiscard}
        onCommit={onCommit}
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
          rows={rows}
          dirtyCells={dirtyCells}
          filterExpr={filterExpr}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onCellChange={onCellChange}
          onSortChange={handleSortChange}
          onAddFilter={handleAddFilter}
          emptyMessage={result ? 'No rows match the filter' : 'Open a table from the sidebar'}
        />
      )}
    </div>
  )
}
