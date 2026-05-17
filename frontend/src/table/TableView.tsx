import { useState } from 'react'
import { RefreshCw, Plus, Settings2 } from 'lucide-react'
import { type QueryResult } from '../../bindings/basalt/db'
import { type TableTarget, type RowRecord, type DirtyCells, type SortDirection } from '../types'
import { GridToolbar } from './GridToolbar'
import { FilterBar } from './FilterBar'
import { DataGrid } from './DataGrid'
import { useFilterExpr } from './useFilterExpr'

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
  onEditSchema: () => void
}

export function TableView({
  target, result, rows, newRows, dirtyCells, pendingDeletes,
  filterExpr,
  isLoading, isRefreshing, isCommitting,
  onCellChange, onNewCellChange, onAddRow, onRemoveNewRow, onDeleteRow,
  onRefresh, onFilterChange, onDiscard, onCommit, onEditSchema,
}: Props) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null)
  const { draft: filterDraft, setDraft: setFilterDraft, addFilter: handleAddFilter } = useFilterExpr(filterExpr, onFilterChange)

  const columns = result?.columns ?? []
  const columnTypes = result?.columnTypes ?? []

  const handleSortChange = (col: string, dir: SortDirection | null) => {
    setSortColumn(dir ? col : null)
    setSortDirection(dir)
  }

  const label = `${target.schema}.${target.table}`
  const dirtyCount = Object.keys(dirtyCells).length

  const pendingLabel = (() => {
    const parts: string[] = []
    if (newRows.length > 0) parts.push(`${newRows.length} new`)
    if (dirtyCount > 0) parts.push(`${dirtyCount} edited`)
    if (pendingDeletes.size > 0) parts.push(`${pendingDeletes.size} deleted`)
    return parts.length > 0 ? `${parts.join(', ')} unsaved` : undefined
  })()

  return (
    <div className="table-view">
      <GridToolbar
        label={label}
        count={`${rows.length.toLocaleString()} rows`}
        pendingLabel={pendingLabel}
        isCommitting={isCommitting}
        onDiscard={onDiscard}
        onCommit={onCommit}
        actions={<>
          <button className="compact-btn toolbar-btn" onClick={onEditSchema} title="Edit schema">
            <Settings2 size={12} strokeWidth={2} /> Schema
          </button>
          <button className="compact-btn toolbar-btn" onClick={onAddRow}>
            <Plus size={12} strokeWidth={2.5} /> Add Row
          </button>
          <button className="compact-btn toolbar-btn" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw size={12} className={isRefreshing ? 'icon-spin' : ''} /> Refresh
          </button>
        </>}
      />
      <div className={`table-refresh-bar${isRefreshing ? ' active' : ''}`} />
      <FilterBar
        expr={filterExpr}
        draft={filterDraft}
        hasError={false}
        onChange={setFilterDraft}
        onCommit={onFilterChange}
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
          onSortChange={handleSortChange}
          onAddFilter={handleAddFilter}
          emptyMessage={result ? 'No rows returned' : 'Open a table from the sidebar'}
        />
      )}
    </div>
  )
}
