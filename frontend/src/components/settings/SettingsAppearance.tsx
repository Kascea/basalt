import type { AppSettings } from '../../../bindings/basalt/db'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

const DENSITY_OPTIONS = [
  { value: 'compact',     label: 'Compact',     desc: '26px rows' },
  { value: 'normal',      label: 'Normal',      desc: '34px rows' },
  { value: 'comfortable', label: 'Comfortable', desc: '42px rows' },
]

const FONT_SIZE_OPTIONS = [12, 13, 14]

const NULL_TEXT_OPTIONS = ['NULL', '(null)', '∅', '']

export function SettingsAppearance({ settings, onChange }: Props) {
  return (
    <div className="settings-section">
      <h2 className="settings-section-title">Appearance</h2>
      <p className="settings-section-desc">Adjust how data is presented in the grid.</p>

      <div className="settings-fields">
        <div className="settings-field">
          <label className="settings-label">Row density</label>
          <div className="settings-radio-group">
            {DENSITY_OPTIONS.map((opt) => (
              <label key={opt.value} className={`settings-radio-card${settings.rowDensity === opt.value ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="rowDensity"
                  value={opt.value}
                  checked={settings.rowDensity === opt.value}
                  onChange={() => onChange({ rowDensity: opt.value })}
                />
                <span className="settings-radio-label">{opt.label}</span>
                <span className="settings-radio-desc">{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">Grid font size</label>
          <div className="settings-segment">
            {FONT_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                className={`settings-segment-btn${settings.fontSize === size ? ' is-active' : ''}`}
                onClick={() => onChange({ fontSize: size })}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">NULL display text</label>
          <p className="settings-hint">Shown in empty cells to indicate a NULL value.</p>
          <div className="settings-segment">
            {NULL_TEXT_OPTIONS.map((text) => (
              <button
                key={text || 'empty'}
                className={`settings-segment-btn${settings.nullText === text ? ' is-active' : ''}`}
                onClick={() => onChange({ nullText: text })}
              >
                {text === '' ? '(empty)' : text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
