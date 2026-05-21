import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { DatabaseService } from '../../bindings/basalt/db'
import { parseError } from '../lib/parseError'
import { SqlEditor } from '../sql/SqlEditor'
import { CopyButton } from '../ui/CopyButton'
import styles from './ddlModal.module.css'

interface Props {
  connectionID: string
  schema: string
  table: string
  onClose: () => void
}

export function DdlModal({ connectionID, schema, table, onClose }: Props) {
  const [ddl, setDdl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    DatabaseService.GetTableDDL(connectionID, schema, table)
      .then(result => { setDdl(result); setLoading(false) })
      .catch(err => { setError(parseError(err)); setLoading(false) })
  }, [connectionID, schema, table])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${styles.modal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{schema}.{table}</span>
          <div className={styles.headerActions}>
            {!loading && !error && (
              <CopyButton text={ddl} title="Copy DDL" />
            )}
            <button className="compact-btn icon-btn" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
        </div>
        <div className={styles.body}>
          {loading && <p className="empty-state centered">Loading…</p>}
          {error && <p className={styles.error}>{error}</p>}
          {!loading && !error && (
            <SqlEditor value={ddl} objects={[]} readOnly />
          )}
        </div>
      </div>
    </div>
  )
}
