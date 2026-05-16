import type { AppSettings } from '../../../bindings/basalt/localdb/models'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

export function SettingsGeneral({ settings, onChange }: Props) {
  return (
    <div className="settings-section">
      <h2 className="settings-section-title">General</h2>
      <p className="settings-section-desc">Confirmations and safety guardrails.</p>

      <div className="settings-fields">
        <div className="settings-toggle-row">
          <div>
            <span className="settings-label">Confirm before dropping objects</span>
            <p className="settings-hint">Show a confirmation dialog before dropping tables, sequences, or indexes.</p>
          </div>
          <button
            role="switch"
            aria-checked={settings.confirmDropTable}
            className={`settings-toggle${settings.confirmDropTable ? ' is-on' : ''}`}
            onClick={() => onChange({ confirmDropTable: !settings.confirmDropTable })}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>

        <div className="settings-toggle-row">
          <div>
            <span className="settings-label">Confirm before deleting rows</span>
            <p className="settings-hint">Show a confirmation dialog before committing pending row deletions.</p>
          </div>
          <button
            role="switch"
            aria-checked={settings.confirmDeleteRows}
            className={`settings-toggle${settings.confirmDeleteRows ? ' is-on' : ''}`}
            onClick={() => onChange({ confirmDeleteRows: !settings.confirmDeleteRows })}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>
      </div>
    </div>
  )
}
