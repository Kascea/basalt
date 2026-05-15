import { Database, Check, RotateCcw, RefreshCw, Plus, Settings2 } from 'lucide-react'

interface Props {
  label: string
  rowCount: number
  newRowCount: number
  dirtyCount: number
  deleteCount: number
  isCommitting: boolean
  isRefreshing: boolean
  onRefresh: () => void
  onDiscard: () => void
  onCommit: () => void
  onAddRow: () => void
  onEditSchema: () => void
}

export function GridToolbar({
  label, rowCount, newRowCount, dirtyCount, deleteCount,
  isCommitting, isRefreshing,
  onRefresh, onDiscard, onCommit, onAddRow, onEditSchema,
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
        {hasPendingChanges && (
          <>
            <div className="toolbar-sep" />
            <span className="dirty-indicator">{pendingLabel()} unsaved</span>
            <button className="compact-btn toolbar-btn" onClick={onDiscard} disabled={isCommitting}>
              <RotateCcw size={12} /> Discard
            </button>
            <button className="compact-btn toolbar-btn primary" onClick={onCommit} disabled={isCommitting}>
              <Database size={12} /><Check size={10} strokeWidth={3} /> {isCommitting ? 'Saving…' : 'Commit'}
            </button>
          </>
        )}
      </div>

      <div className="grid-toolbar-right">
        <button className="compact-btn toolbar-btn" onClick={onEditSchema} title="Edit schema">
          <Settings2 size={12} strokeWidth={2} /> Schema
        </button>
        <button className="compact-btn toolbar-btn" onClick={onAddRow}>
          <Plus size={12} strokeWidth={2.5} /> Add Row
        </button>
        <button className="compact-btn toolbar-btn" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw size={12} className={isRefreshing ? 'icon-spin' : ''} /> Refresh
        </button>
      </div>
    </div>
  )
}
