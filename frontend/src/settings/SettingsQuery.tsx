import type { AppSettings } from '../../bindings/basalt/localdb/models'
import styles from './settings.module.css'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

const ROW_LIMIT_OPTIONS = [
  { value: 100,  label: '100' },
  { value: 500,  label: '500' },
  { value: 1000, label: '1 000' },
  { value: 5000, label: '5 000' },
  { value: 0,    label: 'Unlimited' },
]

const TIMEOUT_OPTIONS = [
  { value: 10,  label: '10s' },
  { value: 30,  label: '30s' },
  { value: 60,  label: '60s' },
  { value: 120, label: '2 min' },
]

export function SettingsQuery({ settings, onChange }: Props) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Query</h2>
      <p className={styles.sectionDesc}>Control how queries are executed and how many rows are returned.</p>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label}>Default row limit</label>
          <p className={styles.hint}>Maximum rows fetched when browsing a table. "Unlimited" loads all rows.</p>
          <div className={styles.segment}>
            {ROW_LIMIT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.segmentBtn}${settings.defaultRowLimit === opt.value ? ` ${styles.segmentBtnActive}` : ''}`}
                onClick={() => onChange({ defaultRowLimit: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Query timeout</label>
          <p className={styles.hint}>Queries that exceed this duration are cancelled.</p>
          <div className={styles.segment}>
            {TIMEOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.segmentBtn}${settings.queryTimeoutSec === opt.value ? ` ${styles.segmentBtnActive}` : ''}`}
                onClick={() => onChange({ queryTimeoutSec: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
