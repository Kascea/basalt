interface Props {
  label: string
  rowCount: number
  newRowCount: number
  dirtyCount: number
  deleteCount: number
  isCommitting: boolean
  onRefresh: () => void
  onDiscard: () => void
  onCommit: () => void
  onAddRow: () => void
}

export function GridToolbar({
  label, rowCount, newRowCount, dirtyCount, deleteCount, isCommitting,
  onRefresh, onDiscard, onCommit, onAddRow,
}: Props) {
  const hasPendingChanges = dirtyCount > 0 || newRowCount > 0 || deleteCount > 0

  const pendingLabel = () => {
    const parts: string[] = []
    if (newRowCount > 0) parts.push(`${newRowCount} new`)
    if (dirtyCount > 0) parts.push(`${dirtyCount} edited`)
    if (deleteCount > 0) parts.push(`${deleteCount} deleted`)
    return parts.join(', ')
  }

  return (
    <div className="grid-toolbar">
      <div className="grid-toolbar-left">
        <span className="grid-label">{label}</span>
        <span className="grid-count">{rowCount.toLocaleString()} rows</span>
      </div>

      <div className="grid-toolbar-right">
        <button className="compact-btn toolbar-btn" onClick={onAddRow}>
          <span className="toolbar-btn-icon">+</span> Add Row
        </button>
        <button className="compact-btn toolbar-btn" onClick={onRefresh}>
          <span className="toolbar-btn-icon">↻</span> Refresh
        </button>
        {hasPendingChanges && (
          <>
            <div className="toolbar-sep" />
            <span className="dirty-indicator">{pendingLabel()} unsaved</span>
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
