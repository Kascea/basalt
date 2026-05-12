import { useState, useEffect } from 'react'
import { type RowRecord, type DirtyCells, type SortDirection, cellKey } from '../types'

// ── Expression evaluator ──────────────────────────────────────────────────────

const VALID_ID = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/
const JS_KEYWORDS = new Set([
  'break','case','catch','class','const','continue','debugger','default',
  'delete','do','else','export','extends','false','finally','for','function',
  'if','import','in','instanceof','let','new','null','return','static',
  'super','switch','this','throw','true','try','typeof','undefined','var',
  'void','while','with','yield',
])

const HELPERS = {
  lower:    (s: unknown) => String(s ?? '').toLowerCase(),
  upper:    (s: unknown) => String(s ?? '').toUpperCase(),
  trim:     (s: unknown) => String(s ?? '').trim(),
  len:      (s: unknown) => String(s ?? '').length,
  num:      (s: unknown) => parseFloat(String(s ?? '')),
  contains: (s: unknown, sub: unknown) => String(s ?? '').includes(String(sub ?? '')),
  starts:   (s: unknown, pre: unknown) => String(s ?? '').startsWith(String(pre ?? '')),
  ends:     (s: unknown, suf: unknown) => String(s ?? '').endsWith(String(suf ?? '')),
  regex:    (s: unknown, pat: unknown) => { try { return new RegExp(String(pat ?? '')).test(String(s ?? '')) } catch { return false } },
}
const helperNames = Object.keys(HELPERS)
const helperValues = Object.values(HELPERS)

function toJsExpr(expr: string): string {
  return expr
    .replace(/\bAND\b/gi, '&&')
    .replace(/\bOR\b/gi,  '||')
    .replace(/\bNOT\b/gi, '!')
}

type FilterFn = (row: RowRecord) => boolean

export function buildFilter(expr: string, columns: string[]): FilterFn | null {
  const trimmed = expr.trim()
  if (!trimmed) return null

  const jsExpr = toJsExpr(trimmed)
  const safeCols = columns.filter(c => VALID_ID.test(c) && !JS_KEYWORDS.has(c) && !(c in HELPERS))

  type CompiledFn = (...args: unknown[]) => boolean
  let compiled: CompiledFn | null = null
  try {
    compiled = new Function('$row', ...helperNames, ...safeCols, `return !!(${jsExpr})`) as unknown as CompiledFn
  } catch {
    return null
  }

  return (row: RowRecord) => {
    const colVals = safeCols.map(c => {
      const v = row[c] ?? ''
      const n = parseFloat(v)
      return !isNaN(n) && v.trim() !== '' ? n : v
    })
    try {
      return Boolean(compiled!(row, ...helperValues, ...colVals))
    } catch {
      return true
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  columns: string[]
  rows: RowRecord[]
  dirtyCells: DirtyCells
  filterExpr?: string
  sortColumn?: string | null
  sortDirection?: SortDirection | null
  emptyMessage?: string
  onCellChange: (rowIndex: number, column: string, value: string) => void
  onSortChange?: (column: string, direction: SortDirection | null) => void
  onAddFilter?: (column: string) => void
}

export function DataGrid({
  columns,
  rows,
  dirtyCells,
  filterExpr = '',
  sortColumn,
  sortDirection,
  emptyMessage = 'No data',
  onCellChange,
  onSortChange,
  onAddFilter,
}: Props) {
  const [menuCol, setMenuCol] = useState<string | null>(null)

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

  const filterFn = buildFilter(filterExpr, columns)

  let indexed = rows.map((row, i) => ({ row, originalIndex: i }))

  if (filterFn) {
    indexed = indexed.filter(({ row }) => filterFn(row))
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
