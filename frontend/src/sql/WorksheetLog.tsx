import { useEffect, useRef } from 'react'
import type { LogEntry } from '../types'
import { parseError } from '../lib/parseError'
import styles from './WorksheetLog.module.css'

interface Props {
  log: LogEntry[]
  onClear: () => void
}

function extractErrorText(raw: string): string {
  let msg = parseError(raw)
  const dbIdx = msg.indexOf('ERROR:')
  if (dbIdx !== -1) msg = msg.slice(dbIdx)
  msg = msg.replace(/^ERROR:\s*/i, '')
  msg = msg.replace(/\s*\(SQLSTATE\s+([^)]+)\)/, ' [$1]')
  return msg.trim()
}

export function WorksheetLog({ log, onClear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log])

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>Output</span>
        {log.length > 0 && (
          <button className={styles.clearBtn} onClick={onClear}>Clear</button>
        )}
      </div>
      <div className={styles.entries} ref={scrollRef}>
        {log.length === 0 ? (
          <div className={styles.empty}>No queries run yet</div>
        ) : (
          log.map(entry => {
            const text = entry.isError ? extractErrorText(entry.text) : entry.text
            const entryClass = [
              styles.entry,
              entry.isError ? styles.entryError : entry.isSuccess ? styles.entrySuccess : '',
            ].filter(Boolean).join(' ')

            return (
              <div key={entry.id} className={entryClass}>
                <span className={styles.ts}>{entry.ts}</span>
                <span className={styles.text}>{text}</span>
                {entry.durationMs !== undefined && (
                  <span className={styles.duration}>{entry.durationMs}ms</span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
