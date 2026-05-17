import type { AppSettings } from '../../bindings/basalt/localdb/models'
import styles from './settings.module.css'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

const DENSITY_OPTIONS = [
  { value: 'compact',     label: 'Compact',     desc: '26px rows' },
  { value: 'normal',      label: 'Normal',      desc: '34px rows' },
  { value: 'comfortable', label: 'Comfortable', desc: '42px rows' },
]

export function SettingsAppearance({ settings, onChange }: Props) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Appearance</h2>
      <p className={styles.sectionDesc}>Adjust how data is presented in the grid.</p>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label}>Row density</label>
          <div className={styles.radioGroup}>
            {DENSITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`${styles.radioCard}${settings.rowDensity === opt.value ? ` ${styles.radioCardSelected}` : ''}`}
              >
                <input
                  type="radio"
                  name="rowDensity"
                  value={opt.value}
                  checked={settings.rowDensity === opt.value}
                  onChange={() => onChange({ rowDensity: opt.value })}
                />
                <span className={styles.radioLabel}>{opt.label}</span>
                <span className={styles.radioDesc}>{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
