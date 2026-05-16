import { useState } from 'react'

interface Props {
  message: string
  confirmText: string // user must type this exactly
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmModal({ message, confirmText, confirmLabel = 'Remove', onConfirm, onCancel }: Props) {
  const [typed, setTyped] = useState('')
  const canConfirm = typed === confirmText

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body confirm-modal-body">
          <p className="confirm-modal-message">{message}</p>
          <div className="confirm-modal-input-wrap">
            <label className="confirm-modal-input-label">
              Type <strong>{confirmText}</strong> to confirm
            </label>
            <input
              className="confirm-modal-input"
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canConfirm) onConfirm(); if (e.key === 'Escape') onCancel() }}
              spellCheck={false}
            />
          </div>
          <div className="confirm-modal-actions">
            <button className="connect-button--secondary" onClick={onCancel}>Cancel</button>
            <button className="confirm-modal-danger-btn" onClick={onConfirm} disabled={!canConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
