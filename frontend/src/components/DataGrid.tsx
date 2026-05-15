import { useState, useEffect, useRef, useCallback } from 'react'
import { type RowRecord, type DirtyCells, type SortDirection, cellKey } from '../types'

// ── Column type helpers ───────────────────────────────────────────────────────

const NUMERIC_TYPES = new Set([
  'INT2', 'INT4', 'INT8', 'INT', 'INTEGER', 'SMALLINT', 'BIGINT',
  'FLOAT4', 'FLOAT8', 'REAL', 'DOUBLE PRECISION',
  'NUMERIC', 'DECIMAL', 'MONEY',
  'OID', 'XID', 'CID',
])

const BOOL_TYPES = new Set(['BOOL', 'BOOLEAN'])

function colCategory(dbType: string): 'numeric' | 'boolean' | 'text' {
  const upper = dbType.toUpperCase()
  if (NUMERIC_TYPES.has(upper)) return 'numeric'
  if (BOOL_TYPES.has(upper)) return 'boolean'
  return 'text'
}

function isKeyAllowed(key: string, category: 'numeric' | 'boolean' | 'text', currentValue: string): boolean {
  if (category === 'text') return true
  if (key.length > 1) return true
  if (category === 'boolean') {
    return ['t', 'f', 'T', 'F', '1', '0'].includes(key)
  }
  if (category === 'numeric') {
    if (/[0-9]/.test(key)) return true
    if (key === '-' && currentValue === '') return true
    if (key === '.' && !currentValue.includes('.')) return true
    if (key === 'e' && !currentValue.includes('e') && !currentValue.includes('E')) return true
    return false
  }
  return true
}

// ── TypedCell ─────────────────────────────────────────────────────────────────

interface TypedCellProps {
  value: string
  dbType: string
  isDirty?: boolean
  isNew?: boolean
  isPendingDelete?: boolean
  ariaLabel: string
  nullText?: string
  onChange: (value: string) => void
}

function TypedCell({ value, dbType, isDirty, isNew, isPendingDelete, ariaLabel, nullText, onChange }: TypedCellProps) {
  const category = colCategory(dbType)
  const [rejected, setRejected] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashReject = useCallback(() => {
    setRejected(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setRejected(false), 400)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isKeyAllowed(e.key, category, e.currentTarget.value)) {
      e.preventDefault()
      flashReject()
    }
  }

  const cellClass = [
    isDirty ? 'dirty-cell' : '',
    isNew ? 'new-cell' : '',
    isPendingDelete ? 'delete-cell' : '',
    rejected ? 'cell-rejected' : '',
  ].filter(Boolean).join(' ') || undefined

  return (
    <td className={cellClass}>
      <input
        value={value}
        placeholder={value === '' && nullText ? nullText : undefined}
        onKeyDown={handleKeyDown}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        inputMode={category === 'numeric' ? 'decimal' : undefined}
        readOnly={isPendingDelete}
        tabIndex={isPendingDelete ? -1 : undefined}
      />
    </td>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  columns: string[]
  columnTypes: string[]
  rows: RowRecord[]
  newRows: RowRecord[]
  dirtyCells: DirtyCells
  pendingDeletes: Set<number>
  sortColumn?: string | null
  sortDirection?: SortDirection | null
  emptyMessage?: string
  nullText?: string
  onCellChange: (rowIndex: number, column: string, value: string) => void
  onNewCellChange: (rowIndex: number, column: string, value: string) => void
  onDeleteRow: (rowIndex: number) => void
  onRemoveNewRow: (newRowIndex: number) => void
  onSortChange?: (column: string, direction: SortDirection | null) => void
  onAddFilter?: (column: string) => void
}

export function DataGrid({
  columns,
  columnTypes,
  rows,
  newRows,
  dirtyCells,
  pendingDeletes,
  sortColumn,
  sortDirection,
  emptyMessage = 'No data',
  nullText = '',
  onCellChange,
  onNewCellChange,
  onDeleteRow,
  onRemoveNewRow,
  onSortChange,
  onAddFilter,
}: Props) {
  const [menuCol, setMenuCol] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  const closeMenu = () => setMenuCol(null)

  useEffect(() => {
    if (!menuCol) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest('th') || target.closest('.col-menu')) return
      setMenuCol(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuCol])

  let indexed = rows.map((row, i) => ({ row, originalIndex: i }))

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
              const menuOpen = menuCol === col
              return (
                <th
                  key={col}
                  className={isSorted ? 'col-sorted' : ''}
                  style={menuOpen ? { zIndex: 100 } : undefined}
                  onClick={() => setMenuCol(menuOpen ? null : col)}
                >
                  {col}
                  <span className={`sort-indicator${isSorted ? ' sort-active' : ''}`}>
                    {isSorted ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                  </span>
                  {menuOpen && (
                    <div className="col-menu" onClick={e => e.stopPropagation()}>
                      <button
                        className={`col-menu-item${isSorted && sortDirection === 'asc' ? ' col-menu-item-active' : ''}`}
                        onClick={() => { onSortChange?.(col, 'asc'); closeMenu() }}
                      >
                        <span className="col-menu-icon">↑</span> Sort Ascending
                      </button>
                      <button
                        className={`col-menu-item${isSorted && sortDirection === 'desc' ? ' col-menu-item-active' : ''}`}
                        onClick={() => { onSortChange?.(col, 'desc'); closeMenu() }}
                      >
                        <span className="col-menu-icon">↓</span> Sort Descending
                      </button>
                      {isSorted && (
                        <>
                          <div className="col-menu-sep" />
                          <button
                            className="col-menu-item col-menu-item-muted"
                            onClick={() => { onSortChange?.(col, null); closeMenu() }}
                          >
                            <span className="col-menu-icon">✕</span> Clear sort
                          </button>
                        </>
                      )}
                      <div className="col-menu-sep" />
                      <button
                        className="col-menu-item"
                        onClick={() => { onAddFilter?.(col); closeMenu() }}
                      >
                        <span className="col-menu-icon">+</span> Add filter
                      </button>
                    </div>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {indexed.map(({ row, originalIndex }) => {
            const isPendingDelete = pendingDeletes.has(originalIndex)
            const isHovered = hoveredRow === originalIndex
            const showDeleteBtn = isHovered || isPendingDelete
            return (
              <tr
                key={originalIndex}
                className={isPendingDelete ? 'delete-row' : ''}
                onMouseEnter={() => setHoveredRow(originalIndex)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td className="row-index">
                  {showDeleteBtn ? (
                    <button
                      className={`row-delete-btn${isPendingDelete ? ' row-delete-btn-active' : ''}`}
                      title={isPendingDelete ? 'Undo delete' : 'Delete row'}
                      onClick={() => onDeleteRow(originalIndex)}
                    >
                      ✕
                    </button>
                  ) : (
                    originalIndex + 1
                  )}
                </td>
                {columns.map((col, colIdx) => {
                  const isDirty = !!dirtyCells[cellKey(originalIndex, col)]
                  const dbType = columnTypes[colIdx] ?? 'TEXT'
                  return (
                    <TypedCell
                      key={col}
                      value={row[col] ?? ''}
                      dbType={dbType}
                      isDirty={isDirty}
                      isPendingDelete={isPendingDelete}
                      nullText={nullText}
                      ariaLabel={`${col} row ${originalIndex + 1}`}
                      onChange={(v) => onCellChange(originalIndex, col, v)}
                    />
                  )
                })}
              </tr>
            )
          })}
          {newRows.map((row, newIdx) => (
            <tr key={`new-${newIdx}`} className="new-row">
              <td className="row-index">
                <button
                  className="row-delete-btn row-delete-btn-new"
                  title="Remove new row"
                  onClick={() => onRemoveNewRow(newIdx)}
                >
                  ✕
                </button>
              </td>
              {columns.map((col, colIdx) => {
                const dbType = columnTypes[colIdx] ?? 'TEXT'
                return (
                  <TypedCell
                    key={col}
                    value={row[col] ?? ''}
                    dbType={dbType}
                    isNew
                    nullText={nullText}
                    ariaLabel={`${col} new row ${newIdx + 1}`}
                    onChange={(v) => onNewCellChange(newIdx, col, v)}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {indexed.length === 0 && newRows.length === 0 && (
        <p className="empty-state centered">{emptyMessage}</p>
      )}
    </div>
  )
}
