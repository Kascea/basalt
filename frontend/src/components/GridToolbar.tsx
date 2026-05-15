import { type ReactNode } from 'react'
import { Database, Check, RotateCcw } from 'lucide-react'

interface Props {
  label: string
  count: string
  pendingLabel?: string
  isCommitting?: boolean
  onDiscard?: () => void
  onCommit?: () => void
  actions?: ReactNode
}

export function GridToolbar({
  label, count, pendingLabel,
  isCommitting = false,
  onDiscard, onCommit,
  actions,
}: Props) {
  return (
    <div className="grid-toolbar">
      <div className="grid-toolbar-left">
        <span className="grid-label">{label}</span>
        <span className="grid-count">{count}</span>
        {pendingLabel && (
          <>
            <div className="toolbar-sep" />
            <span className="dirty-indicator">{pendingLabel}</span>
            <button className="compact-btn toolbar-btn" onClick={onDiscard} disabled={isCommitting}>
              <RotateCcw size={12} /> Discard
            </button>
            <button className="compact-btn toolbar-btn primary" onClick={onCommit} disabled={isCommitting}>
              <Database size={12} /><Check size={10} strokeWidth={3} /> {isCommitting ? 'Saving…' : 'Commit'}
            </button>
          </>
        )}
      </div>
      {actions && (
        <div className="grid-toolbar-right">{actions}</div>
      )}
    </div>
  )
}
