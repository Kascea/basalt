import type { AppSettings } from '../../bindings/basalt/localdb/models'
import styles from './settings.module.css'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

export function SettingsGeneral({ settings, onChange }: Props) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>General</h2>
      <p className={styles.sectionDesc}>Confirmations and safety guardrails.</p>

      <div className={styles.fields}>
        <div className={styles.toggleRow}>
          <div>
            <span className={styles.label}>Confirm before dropping objects</span>
            <p className={styles.hint}>Show a confirmation dialog before dropping tables, sequences, or indexes.</p>
          </div>
          <button
            role="switch"
            aria-checked={settings.confirmDropTable}
            className={`${styles.toggle}${settings.confirmDropTable ? ` ${styles.toggleOn}` : ''}`}
            onClick={() => onChange({ confirmDropTable: !settings.confirmDropTable })}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        <div className={styles.toggleRow}>
          <div>
            <span className={styles.label}>Confirm before deleting rows</span>
            <p className={styles.hint}>Show a confirmation dialog before committing pending row deletions.</p>
          </div>
          <button
            role="switch"
            aria-checked={settings.confirmDeleteRows}
            className={`${styles.toggle}${settings.confirmDeleteRows ? ` ${styles.toggleOn}` : ''}`}
            onClick={() => onChange({ confirmDeleteRows: !settings.confirmDeleteRows })}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
      </div>
    </div>
  )
}
