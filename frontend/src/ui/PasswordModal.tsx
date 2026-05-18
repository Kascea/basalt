import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import styles from './confirmModal.module.css'
import pwStyles from './passwordModal.module.css'
import { parseError } from '../lib/parseError'

interface Props {
  title: string
  description?: string
  error?: string | null
  isConnecting: boolean
  onConfirm: (password: string) => void
  onCancel: () => void
}

export function PasswordModal({ title, description, error, isConnecting, onConfirm, onCancel }: Props) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConnecting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isConnecting, onCancel])

  const handleSubmit = () => {
    if (password && !isConnecting) onConfirm(password)
  }

  return (
    <div className="modal-overlay" onClick={() => { if (!isConnecting) onCancel() }}>
      <div className={`modal ${styles.modal}`} onClick={e => e.stopPropagation()}>
        <div className={pwStyles.body}>
          <div className={pwStyles.heading}>
            <span className={pwStyles.title}>{title}</span>
            {description && <p className={pwStyles.desc}>{description}</p>}
          </div>

          <div className={styles.inputWrap}>
            <label className={styles.inputLabel}>Database password</label>
            <div className={pwStyles.passwordField}>
              <input
                ref={inputRef}
                className={`${styles.input} ${pwStyles.passwordInput}`}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password…"
                value={password}
                disabled={isConnecting}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              />
              <button
                className={pwStyles.eyeBtn}
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && <p className={pwStyles.error}>{parseError(error)}</p>}

          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onCancel} disabled={isConnecting}>
              Cancel
            </button>
            <button
              className={pwStyles.connectBtn}
              onClick={handleSubmit}
              disabled={!password || isConnecting}
            >
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
