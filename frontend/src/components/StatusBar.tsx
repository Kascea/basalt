import { type FKError } from '../types'

interface Props {
  message: string
  durationMs?: number
  fkError?: FKError | null
  onOpenFkTab?: () => void
}

function parseMessage(raw: string): { isError: boolean; text: string } {
  if (!raw.startsWith('Error:')) return { isError: false, text: raw }

  const rest = raw.slice('Error:'.length).trim()
  try {
    const parsed = JSON.parse(rest)
    const msg: string = parsed.message ?? rest
    const dbIdx = msg.indexOf('ERROR:')
    return { isError: true, text: dbIdx !== -1 ? msg.slice(dbIdx) : msg }
  } catch {
    return { isError: true, text: rest }
  }
}

export function StatusBar({ message, durationMs, fkError, onOpenFkTab }: Props) {
  const { isError, text } = parseMessage(message)

  if (isError && fkError) {
    return (
      <div className="statusbar statusbar-error">
        <span className="status-error-icon">✕</span>
        <span className="status-error-msg">
          Foreign key violation: <strong>{fkError.column}</strong> = <strong>{fkError.value}</strong> not found in{' '}
          <button className="statusbar-fk-link" onClick={onOpenFkTab}>
            {fkError.referencedTable} ↗
          </button>
          {' '}— click to open and create the missing row.
        </span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="statusbar statusbar-error">
        <span className="status-error-icon">✕</span>
        <span className="status-error-msg">{text}</span>
      </div>
    )
  }

  return (
    <div className="statusbar">
      <span className="status-msg">{message}</span>
      {durationMs !== undefined && <span className="status-right">{durationMs}ms</span>}
    </div>
  )
}
