import { useState } from 'react'
import styles from './confirmModal.module.css'

interface Props {
  message: string
  confirmText: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmModal({ message, confirmText, confirmLabel = 'Remove', onConfirm, onCancel }: Props) {
  const [typed, setTyped] = useState('')
  const canConfirm = typed === confirmText

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className={`modal ${styles.modal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel}>
              Type <strong>{confirmText}</strong> to confirm
            </label>
            <input
              className={styles.input}
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canConfirm) onConfirm(); if (e.key === 'Escape') onCancel() }}
              spellCheck={false}
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
            <button className={styles.dangerBtn} onClick={onConfirm} disabled={!canConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
