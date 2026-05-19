import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './PaginationBar.module.css'

const PAGE_SIZE_OPTIONS = [
  { value: 100,  label: '100 rows' },
  { value: 500,  label: '500 rows' },
  { value: 1000, label: '1 000 rows' },
  { value: 5000, label: '5 000 rows' },
]

interface Props {
  currentPage: number
  totalRows: number
  pageSize: number
  defaultPageSize: number
  isRefreshing: boolean
  onGoToPage: (page: number) => void
  onSetPageSize: (size: number) => void
}

export function PaginationBar({
  currentPage, totalRows, pageSize, defaultPageSize, isRefreshing, onGoToPage, onSetPageSize,
}: Props) {
  const totalPages = pageSize > 0 && totalRows > 0
    ? Math.ceil(totalRows / pageSize)
    : 1

  const [inputValue, setInputValue] = useState(String(currentPage + 1))

  useEffect(() => {
    setInputValue(String(currentPage + 1))
  }, [currentPage])

  const commitPage = () => {
    const parsed = parseInt(inputValue, 10)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      onGoToPage(parsed - 1)
    } else {
      setInputValue(String(currentPage + 1))
    }
  }

  const selectedSize = pageSize > 0 ? pageSize : defaultPageSize

  return (
    <div className={styles.bar}>
      <div className={styles.right}>
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
