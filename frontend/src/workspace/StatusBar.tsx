import { useEffect, useRef } from 'react'
import type { LogEntry, FKError } from '../types'
import { parseError } from '../lib/parseError'

interface Props {
  entries: LogEntry[]
  durationMs?: number
  fkError?: FKError | null
  onOpenFkTab?: () => void
}

function extractErrorText(raw: string): string {
  let msg = parseError(raw)

  // Locate the db error portion if wrapped in extra context
  const dbIdx = msg.indexOf('ERROR:')
  if (dbIdx !== -1) msg = msg.slice(dbIdx)

  // Strip redundant leading "ERROR: " — the red styling already signals an error
  msg = msg.replace(/^ERROR:\s*/i, '')

  // Reformat SQLSTATE code from "(SQLSTATE 42703)" → " [42703]"
  msg = msg.replace(/\s*\(SQLSTATE\s+([^)]+)\)/, ' [$1]')

  return msg.trim()
}

function parseEntry(entry: LogEntry): { isError: boolean; text: string } {
  if (!entry.isError) return { isError: false, text: entry.text }
  return { isError: true, text: extractErrorText(entry.text) }
}

export function StatusBar({ entries, durationMs, fkError, onOpenFkTab }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries])

  const last = entries[entries.length - 1]
  const lastIsError = last?.isError ?? false

  return (
    <div className={`statusbar-log${lastIsError ? ' statusbar-log--error' : ''}`} ref={scrollRef}>
      {entries.map((entry, i) => {
        const { isError, text } = parseEntry(entry)
        const isLast = i === entries.length - 1

        if (isError && isLast && fkError) {
          return (
            <div key={entry.id} className="statusbar-log-entry statusbar-log-entry--error">
              <span className="statusbar-log-ts">{entry.ts}</span>
              <span>
                Foreign key violation: <strong>{fkError.column}</strong> = <strong>{fkError.value}</strong> not found in{' '}
                <button className="statusbar-fk-link" onClick={onOpenFkTab}>
                  {fkError.referencedTable} ↗
                </button>
                {' '}— click to open and create the missing row.
              </span>
            </div>
          )
        }

        return (
          <div key={entry.id} className={`statusbar-log-entry${isError ? ' statusbar-log-entry--error' : entry.isSuccess ? ' statusbar-log-entry--success' : ''}`}>
            <span className="statusbar-log-ts">{entry.ts}</span>
            <span className="statusbar-log-text">{text}</span>
            {isLast && durationMs !== undefined && (
              <span className="statusbar-log-duration">{durationMs}ms</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
