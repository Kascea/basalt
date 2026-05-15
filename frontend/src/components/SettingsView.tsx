import { useState } from 'react'
import type { AppSettings } from '../../bindings/basalt/db'
import { SettingsAppearance } from './settings/SettingsAppearance'
import { SettingsQuery } from './settings/SettingsQuery'
import { SettingsGeneral } from './settings/SettingsGeneral'

type Section = 'appearance' | 'query' | 'general'

const NAV_ITEMS: Array<{ id: Section; label: string; icon: string }> = [
  { id: 'appearance',  label: 'Appearance',  icon: '◑' },
  { id: 'query',       label: 'Query',        icon: '⊞' },
  { id: 'general',     label: 'General',      icon: '⊙' },
]

interface Props {
  settings: AppSettings
  onClose: () => void
  onSettingsChange: (patch: Partial<AppSettings>) => void
  onSettingsSave: (s: AppSettings) => void
  initialSection?: Section
}

export function SettingsView({
  settings,
  onClose, onSettingsChange, onSettingsSave,
  initialSection = 'appearance',
}: Props) {
  const [activeSection, setActiveSection] = useState<Section>(initialSection)
  const [dirty, setDirty] = useState(false)

  const handleChange = (patch: Partial<AppSettings>) => {
    onSettingsChange(patch)
    setDirty(true)
  }

  const handleSave = () => {
    onSettingsSave(settings)
    setDirty(false)
  }

  return (
    <div className="settings-view">
      <div className="settings-nav">
        <div className="settings-nav-header">Settings</div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`settings-nav-item${activeSection === item.id ? ' is-active' : ''}`}
            onClick={() => setActiveSection(item.id)}
          >
            <span className="settings-nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        <div className="settings-topbar">
          <button className="settings-back-btn" onClick={onClose}>← Back</button>
          {dirty && (
            <button className="settings-save-btn" onClick={handleSave}>Save Changes</button>
          )}
        </div>

        <div className="settings-body">
          {activeSection === 'appearance' && (
            <SettingsAppearance settings={settings} onChange={handleChange} />
          )}
          {activeSection === 'query' && (
            <SettingsQuery settings={settings} onChange={handleChange} />
          )}
          {activeSection === 'general' && (
            <SettingsGeneral settings={settings} onChange={handleChange} />
          )}
        </div>
      </div>
    </div>
  )
}
