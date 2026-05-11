interface Props {
  label: string
  rowCount: number
  dirtyCount: number
  isCommitting: boolean
  onRefresh: () => void
  onDiscard: () => void
  onCommit: () => void
}

export function GridToolbar({
  label, rowCount, dirtyCount, isCommitting, onRefresh, onDiscard, onCommit,
}: Props) {
  return (
    <div className="grid-toolbar">
      <div className="grid-toolbar-left">
        <span className="grid-label">{label}</span>
        <span className="grid-count">{rowCount.toLocaleString()} rows</span>
      </div>

      <div className="grid-toolbar-right">
        <button className="icon-button" title="Refresh" onClick={onRefresh}>↻</button>
        {dirtyCount > 0 && (
          <>
            <span className="dirty-indicator">
              {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
            </span>
            <button className="compact-btn" onClick={onDiscard} disabled={isCommitting}>
              Discard
            </button>
            <button className="compact-btn primary" onClick={onCommit} disabled={isCommitting}>
              {isCommitting ? 'Saving…' : 'Commit'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
