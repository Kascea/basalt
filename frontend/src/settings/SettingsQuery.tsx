import type { AppSettings } from '../../bindings/basalt/localdb/models'

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
    <div className="settings-section">
      <h2 className="settings-section-title">Query</h2>
      <p className="settings-section-desc">Control how queries are executed and how many rows are returned.</p>

      <div className="settings-fields">
        <div className="settings-field">
          <label className="settings-label">Default row limit</label>
          <p className="settings-hint">Maximum rows fetched when browsing a table. "Unlimited" loads all rows.</p>
          <div className="settings-segment">
            {ROW_LIMIT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings-segment-btn${settings.defaultRowLimit === opt.value ? ' is-active' : ''}`}
                onClick={() => onChange({ defaultRowLimit: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">Query timeout</label>
          <p className="settings-hint">Queries that exceed this duration are cancelled.</p>
          <div className="settings-segment">
            {TIMEOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings-segment-btn${settings.queryTimeoutSec === opt.value ? ' is-active' : ''}`}
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
