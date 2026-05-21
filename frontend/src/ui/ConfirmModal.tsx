import { useEffect } from 'react'
import styles from './confirmModal.module.css'

interface Props {
  message: string
  confirmLabel?: string
  isLoading?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ message, confirmLabel = 'Confirm', isLoading, error, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel()
      if (e.key === 'Enter' && !isLoading && !error) onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onCancel, isLoading, error])

  return (
    <div className="modal-overlay" onClick={!isLoading ? onCancel : undefined}>
      <div className={`modal ${styles.modal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button className={styles.cancelBtn} disabled={isLoading} onClick={onCancel}>Cancel</button>
            <button className={styles.dangerBtn} disabled={isLoading} onClick={onConfirm}>
              {isLoading ? 'Dropping…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
