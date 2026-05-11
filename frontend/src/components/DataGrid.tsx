import { type RowRecord, type DirtyCells, type FilterClause, type SortDirection, cellKey } from '../types'

function applyClause(row: RowRecord, clause: FilterClause): boolean {
  const raw = row[clause.column] ?? ''
  const cell = raw.toLowerCase()
  const val = clause.value.toLowerCase()
  switch (clause.op) {
    case 'contains': return cell.includes(val)
    case 'eq':       return cell === val
    case 'neq':      return cell !== val
    case 'starts':   return cell.startsWith(val)
    case 'ends':     return cell.endsWith(val)
    case 'null':     return raw === '' || raw == null
    case 'notnull':  return raw !== '' && raw != null
    default: {
      const a = parseFloat(raw)
      const b = parseFloat(clause.value)
      if (isNaN(a) || isNaN(b)) return false
      if (clause.op === 'gt')  return a > b
      if (clause.op === 'gte') return a >= b
      if (clause.op === 'lt')  return a < b
      if (clause.op === 'lte') return a <= b
      return false
    }
  }
}

interface Props {
  columns: string[]
  rows: RowRecord[]
  dirtyCells: DirtyCells
  filters?: FilterClause[]
  sortColumn?: string | null
  sortDirection?: SortDirection | null
  emptyMessage?: string
  onCellChange: (rowIndex: number, column: string, value: string) => void
  onColumnDoubleClick?: (column: string) => void
}

export function DataGrid({
  columns,
  rows,
  dirtyCells,
  filters = [],
  sortColumn,
  sortDirection,
  emptyMessage = 'No data',
  onCellChange,
  onColumnDoubleClick,
}: Props) {
  const activeFilters = filters.filter(f => f.op === 'null' || f.op === 'notnull' || f.value !== '')

  let indexed = rows.map((row, i) => ({ row, originalIndex: i }))

  if (activeFilters.length > 0) {
    indexed = indexed.filter(({ row }) => activeFilters.every(c => applyClause(row, c)))
  }

  if (sortColumn && sortDirection) {
    indexed = [...indexed].sort((a, b) => {
      const aVal = a.row[sortColumn] ?? ''
      const bVal = b.row[sortColumn] ?? ''
      const aNum = parseFloat(aVal)
      const bNum = parseFloat(bVal)
      const cmp = !isNaN(aNum) && !isNaN(bNum)
        ? aNum - bNum
        : aVal.localeCompare(bVal)
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }

  return (
    <div className="data-grid" role="grid">
      <table>
        <thead>
          <tr>
            <th className="row-index">#</th>
            {columns.map((col) => {
              const isSorted = col === sortColumn
              return (
                <th
                  key={col}
                  className={isSorted ? 'col-sorted' : ''}
                  onDoubleClick={() => onColumnDoubleClick?.(col)}
                  title="Double-click to sort"
                >
                  {col}
                  <span className={`sort-indicator${isSorted ? ' sort-active' : ''}`}>
                    {isSorted ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {indexed.map(({ row, originalIndex }) => (
            <tr key={originalIndex}>
              <td className="row-index">{originalIndex + 1}</td>
              {columns.map((col) => {
                const isDirty = !!dirtyCells[cellKey(originalIndex, col)]
                return (
                  <td className={isDirty ? 'dirty-cell' : ''} key={col}>
                    <input
                      value={row[col] ?? ''}
                      onChange={(e) => onCellChange(originalIndex, col, e.target.value)}
                      aria-label={`${col} row ${originalIndex + 1}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {indexed.length === 0 && (
        <p className="empty-state centered">{emptyMessage}</p>
      )}
    </div>
  )
}
