import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LogEntry, FKError } from '../types'
import { parseError } from '../lib/parseError'
import styles from './StatusBar.module.css'

const PAGE_SIZE_OPTIONS = [
  { value: 100,  label: '100 rows' },
  { value: 500,  label: '500 rows' },
  { value: 1000, label: '1 000 rows' },
  { value: 5000, label: '5 000 rows' },
]

interface Props {
  entries: LogEntry[]
  durationMs?: number
  fkError?: FKError | null
  onOpenFkTab?: () => void
  currentPage: number
  totalRows: number
  pageSize: number
  defaultPageSize: number
  isRefreshing: boolean
  onGoToPage: (page: number) => void
  onSetPageSize: (size: number) => void
}

function extractErrorText(raw: string): string {
  let msg = parseError(raw)
  const dbIdx = msg.indexOf('ERROR:')
  if (dbIdx !== -1) msg = msg.slice(dbIdx)
  msg = msg.replace(/^ERROR:\s*/i, '')
  msg = msg.replace(/\s*\(SQLSTATE\s+([^)]+)\)/, ' [$1]')
  return msg.trim()
}

export function TableStatusBar({
  entries, durationMs, fkError, onOpenFkTab,
  currentPage, totalRows, pageSize, defaultPageSize, isRefreshing, onGoToPage, onSetPageSize,
}: Props) {
  const totalPages = pageSize > 0 && totalRows > 0
    ? Math.ceil(totalRows / pageSize)
    : 1

  const [inputValue, setInputValue] = useState(String(currentPage + 1))
  useEffect(() => { setInputValue(String(currentPage + 1)) }, [currentPage])

  const commitPage = () => {
    const parsed = parseInt(inputValue, 10)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      onGoToPage(parsed - 1)
    } else {
      setInputValue(String(currentPage + 1))
    }
  }

  const selectedSize = pageSize > 0 ? pageSize : defaultPageSize

  const last = entries[entries.length - 1]
  const isError = last?.isError ?? false
  const isSuccess = last?.isSuccess ?? false
  const text = last ? (isError ? extractErrorText(last.text) : last.text) : ''

  const barClass = [
    styles.bar,
    isError ? styles.barError : isSuccess ? styles.barSuccess : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={barClass}>
      {last && <span className={styles.ts}>{last.ts}</span>}
      {last && (
        isError && fkError ? (
          <span className={styles.text}>
            Foreign key violation: <strong>{fkError.column}</strong> = <strong>{fkError.value}</strong> not found in{' '}
            <button className={styles.fkLink} onClick={onOpenFkTab}>
              {fkError.referencedTable} ↗
            </button>
            {' '}— click to open and create the missing row.
          </span>
        ) : (
          <span className={styles.text}>{text}</span>
        )
      )}
      {durationMs !== undefined && (
        <span className={styles.duration}>{durationMs}ms</span>
      )}

      <div style={{ flex: 1 }} />

      <div className={styles.paginationRight}>
        <button
          className={styles.navBtn}
          onClick={() => onGoToPage(currentPage - 1)}
          disabled={currentPage === 0 || isRefreshing}
          title="Previous page"
        >
          <ChevronLeft size={12} strokeWidth={2.5} />
        </button>

        <span className={styles.pageText}>
          Page
          <input
            className={styles.pageInput}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onBlur={commitPage}
            onKeyDown={e => { if (e.key === 'Enter') commitPage() }}
            disabled={isRefreshing || totalPages <= 1}
          />
          of {totalPages}
        </span>

        <button
          className={styles.navBtn}
          onClick={() => onGoToPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1 || isRefreshing}
          title="Next page"
        >
          <ChevronRight size={12} strokeWidth={2.5} />
        </button>

        <div className={styles.sep} />

        <select
          className={styles.sizeSelect}
          value={selectedSize}
          onChange={e => onSetPageSize(Number(e.target.value))}
          disabled={isRefreshing}
        >
          {PAGE_SIZE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className={styles.sep} />

        <span className={styles.totalLabel}>
          {totalRows.toLocaleString()} records
        </span>
      </div>
    </div>
  )
}
