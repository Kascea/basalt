import { useState, useRef, useEffect } from 'react'
import { type RowRecord } from '../types'
import styles from './ResultGrid.module.css'

const DEFAULT_COL_WIDTH = 150
const MIN_COL_WIDTH = 60

interface Props {
  columns: string[]
  rows: RowRecord[]
  emptyMessage?: string
}

export function ResultGrid({ columns, rows, emptyMessage = 'No data' }: Props) {
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

  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0)

  return (
    <div className={styles.resultGrid} role="grid">
      <table style={{ width: totalWidth }}>
        <colgroup>
          {columns.map((col, i) => (
            <col key={col} style={{ width: colWidths[i] ?? DEFAULT_COL_WIDTH }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col, colIdx) => (
              <th key={col} style={{ width: colWidths[colIdx] ?? DEFAULT_COL_WIDTH }}>
                <span className={styles.colName}>{col}</span>
                <div
                  className={styles.colResizeHandle}
                  onMouseDown={e => startResize(e, colIdx)}
                  onClick={e => e.stopPropagation()}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {columns.map(col => (
                <td key={col}>
                  <span>{row[col] ?? ''}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="empty-state centered">{emptyMessage}</p>
      )}
    </div>
  )
}
