interface Props {
  message: string
  durationMs?: number
}

function parseMessage(raw: string): { isError: boolean; text: string } {
  if (!raw.startsWith('Error:')) return { isError: false, text: raw }

  const rest = raw.slice('Error:'.length).trim()
  try {
    const parsed = JSON.parse(rest)
    const msg: string = parsed.message ?? rest
    // Strip redundant "inserting row: " / "updating row: " wrapper if the DB error follows
    const dbIdx = msg.indexOf('ERROR:')
    return { isError: true, text: dbIdx !== -1 ? msg.slice(dbIdx) : msg }
  } catch {
    return { isError: true, text: rest }
  }
}

export function StatusBar({ message, durationMs }: Props) {
  const { isError, text } = parseMessage(message)

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
      <span className="status-msg">{text}</span>
      {durationMs !== undefined && <span className="status-right">{durationMs}ms</span>}
    </div>
  )
}
