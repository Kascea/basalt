interface Props {
  message: string
  durationMs?: number
}

export function StatusBar({ message, durationMs }: Props) {
  return (
    <div className="statusbar">
      <span className="status-msg">{message}</span>
      {durationMs !== undefined && <span className="status-right">{durationMs}ms</span>}
    </div>
  )
}
