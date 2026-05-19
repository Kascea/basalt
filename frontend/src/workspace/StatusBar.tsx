import type { LogEntry, FKError } from '../types'
import { parseError } from '../lib/parseError'
import styles from './StatusBar.module.css'

interface Props {
  entries: LogEntry[]
  durationMs?: number
  fkError?: FKError | null
  onOpenFkTab?: () => void
}

function extractErrorText(raw: string): string {
  let msg = parseError(raw)
  const dbIdx = msg.indexOf('ERROR:')
  if (dbIdx !== -1) msg = msg.slice(dbIdx)
  msg = msg.replace(/^ERROR:\s*/i, '')
  msg = msg.replace(/\s*\(SQLSTATE\s+([^)]+)\)/, ' [$1]')
  return msg.trim()
}

export function StatusBar({ entries, durationMs, fkError, onOpenFkTab }: Props) {
  const last = entries[entries.length - 1]
  if (!last) return <div className={styles.bar} />

  const isError = last.isError
  const isSuccess = last.isSuccess ?? false
  const text = isError ? extractErrorText(last.text) : last.text

  const barClass = [
    styles.bar,
    isError ? styles.barError : isSuccess ? styles.barSuccess : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={barClass}>
      <span className={styles.ts}>{last.ts}</span>
      {isError && fkError ? (
        <span className={styles.text}>
          Foreign key violation: <strong>{fkError.column}</strong> = <strong>{fkError.value}</strong> not found in{' '}
          <button className={styles.fkLink} onClick={onOpenFkTab}>
            {fkError.referencedTable} ↗
          </button>
          {' '}— click to open and create the missing row.
        </span>
      ) : (
        <span className={styles.text}>{text}</span>
      )}
      {durationMs !== undefined && (
        <span className={styles.duration}>{durationMs}ms</span>
      )}
    </div>
  )
}
