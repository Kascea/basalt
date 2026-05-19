import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, X, Key, Plus } from 'lucide-react'
import { type RowRecord, type DirtyCells, type SortDirection, cellKey } from '../types'
import { colCategory, isKeyAllowed } from './columnCategory'
import styles from './DataGrid.module.css'

const DEFAULT_COL_WIDTH = 150
const MIN_COL_WIDTH = 60
const PLUS_COL_WIDTH = 52
const ROW_INDEX_WIDTH = 36

// ── TypedCell ─────────────────────────────────────────────────────────────────

interface TypedCellProps {
  value: string
  dbType: string
  isDirty?: boolean
  isNew?: boolean
  isPendingDelete?: boolean
  nullText?: string
  ariaLabel: string
  onChange: (value: string) => void
}

function TypedCell({ value, dbType, isDirty, isNew, isPendingDelete, nullText, ariaLabel, onChange }: TypedCellProps) {
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

  const cls = [
    isDirty ? styles.dirtyCell : '',
    isNew ? styles.newCell : '',
    isPendingDelete ? styles.deleteCell : '',
    rejected ? styles.cellRejected : '',
  ].filter(Boolean).join(' ') || undefined

  return (
    <td className={cls}>
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
  primaryKeys?: string[]
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
  onAddColumn?: () => void
  onAddRow?: () => void
}

export function DataGrid({
  columns,
  columnTypes,
  primaryKeys = [],
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
  onAddColumn,
  onAddRow,
}: Props) {
  const [menuCol, setMenuCol] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [colWidths, setColWidths] = useState<number[]>(() => columns.map(() => DEFAULT_COL_WIDTH))
  const resizeRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    setColWidths(columns.map((_, i) => colWidths[i] ?? DEFAULT_COL_WIDTH))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length])

  const startResize = (e: React.MouseEvent, colIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { colIdx, startX: e.clientX, startWidth: colWidths[colIdx] ?? DEFAULT_COL_WIDTH }

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const delta = ev.clientX - resizeRef.current.startX
      const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta)
      setColWidths(prev => {
        const next = [...prev]
        next[resizeRef.current!.colIdx] = newWidth
        return next
      })
    }
    const onUp = () => {
      resizeRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const closeMenu = () => setMenuCol(null)

  useEffect(() => {
    if (!menuCol) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest('th') || target.closest('[data-col-menu]')) return
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

  const pkSet = new Set(primaryKeys)
  const totalWidth = ROW_INDEX_WIDTH + colWidths.reduce((sum, w) => sum + (w ?? DEFAULT_COL_WIDTH), 0) + PLUS_COL_WIDTH

  return (
    <div className={styles.dataGrid} role="grid">
      <table style={{ width: totalWidth }}>
        <colgroup>
          <col style={{ width: ROW_INDEX_WIDTH }} />
          {columns.map((col, i) => (
            <col key={col} style={{ width: colWidths[i] ?? DEFAULT_COL_WIDTH }} />
          ))}
          <col style={{ width: PLUS_COL_WIDTH }} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.rowIndex}>#</th>
            {columns.map((col, colIdx) => {
              const isSorted = col === sortColumn
              const menuOpen = menuCol === col
              const isPK = pkSet.has(col)
              const colType = columnTypes[colIdx] ?? ''
              return (
                <th
                  key={col}
                  className={isSorted ? styles.colSorted : undefined}
                  style={{ width: colWidths[colIdx] ?? DEFAULT_COL_WIDTH, ...(menuOpen ? { zIndex: 100 } : {}) }}
                  onClick={() => setMenuCol(menuOpen ? null : col)}
                >
                  <div className={styles.colHeaderContent}>
                    <div className={styles.colHeaderTop}>
                      {isPK && (
                        <span className={styles.colPkIcon} title="Primary Key">
                          <Key size={10} />
                        </span>
                      )}
                      <span className={styles.colName}>{col}</span>
                      <span className={`${styles.sortIndicator}${isSorted ? ` ${styles.sortActive}` : ''}`}>
                        {isSorted ? (sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} />}
                      </span>
                    </div>
                    {colType && <div className={styles.colTypeLabel}>{colType.toLowerCase()}</div>}
                  </div>
                  {menuOpen && (
                    <div className={styles.colMenu} data-col-menu onClick={e => e.stopPropagation()}>
                      <button
                        className={`${styles.colMenuItem}${isSorted && sortDirection === 'asc' ? ` ${styles.colMenuItemActive}` : ''}`}
                        onClick={() => { onSortChange?.(col, isSorted && sortDirection === 'asc' ? null : 'asc'); closeMenu() }}
                      >
                        <ArrowUp size={12} className={styles.colMenuIcon} /> Sort Ascending
                      </button>
                      <button
                        className={`${styles.colMenuItem}${isSorted && sortDirection === 'desc' ? ` ${styles.colMenuItemActive}` : ''}`}
                        onClick={() => { onSortChange?.(col, isSorted && sortDirection === 'desc' ? null : 'desc'); closeMenu() }}
                      >
                        <ArrowDown size={12} className={styles.colMenuIcon} /> Sort Descending
                      </button>
                      {isSorted && (
                        <>
                          <div className={styles.colMenuSep} />
                          <button
                            className={styles.colMenuItem}
                            onClick={() => { onSortChange?.(col, null); closeMenu() }}
                          >
                            <X size={12} className={styles.colMenuIcon} /> Clear sort
                          </button>
                        </>
                      )}
                      <div className={styles.colMenuSep} />
                      <button
                        className={styles.colMenuItem}
                        onClick={() => { onAddFilter?.(col); closeMenu() }}
                      >
                        <span className={styles.colMenuIcon}>+</span> Add filter
                      </button>
                    </div>
                  )}
                  <div
                    className={styles.colResizeHandle}
                    onMouseDown={e => startResize(e, colIdx)}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
              )
            })}
            <th className={styles.colAddTh} onClick={onAddColumn} title="Add column">
              <Plus size={13} strokeWidth={2} />
            </th>
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
                className={isPendingDelete ? styles.deleteRow : undefined}
                onMouseEnter={() => setHoveredRow(originalIndex)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td className={styles.rowIndex}>
                  {showDeleteBtn ? (
                    <button
                      className={`${styles.rowDeleteBtn}${isPendingDelete ? ` ${styles.rowDeleteBtnActive}` : ''}`}
                      title={isPendingDelete ? 'Undo delete' : 'Delete row'}
                      onClick={() => onDeleteRow(originalIndex)}
                    >
                      <X size={12} />
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
                <td />
              </tr>
            )
          })}
          {newRows.map((row, newIdx) => (
            <tr key={`new-${newIdx}`} className={styles.newRow}>
              <td className={styles.rowIndex}>
                <button
                  className={`${styles.rowDeleteBtn} ${styles.rowDeleteBtnNew}`}
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
              <td />
            </tr>
          ))}
          {onAddRow && (
            <tr className={styles.rowAddTr} onClick={onAddRow}>
              <td className={`${styles.rowIndex} ${styles.rowAddTd}`}>
                <Plus size={12} strokeWidth={2} />
              </td>
              {columns.map(col => <td key={col} />)}
              <td />
            </tr>
          )}
        </tbody>
      </table>
      {indexed.length === 0 && newRows.length === 0 && (
        <p className="empty-state centered">{emptyMessage}</p>
      )}
    </div>
  )
}
