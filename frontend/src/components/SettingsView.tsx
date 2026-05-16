import { useState } from 'react'
import { Paintbrush, Terminal, Settings, Link } from 'lucide-react'
import type { AppSettings, SavedConnection } from '../../bindings/basalt/config'
import { SettingsAppearance } from './settings/SettingsAppearance'
import { SettingsQuery } from './settings/SettingsQuery'
import { SettingsGeneral } from './settings/SettingsGeneral'
import { SettingsConnectedAccounts } from './settings/SettingsConnectedAccounts'

type Section = 'appearance' | 'query' | 'general' | 'connected-accounts'

const NAV_ITEMS: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
  { id: 'appearance',         label: 'Appearance',         icon: <Paintbrush size={15} /> },
  { id: 'query',              label: 'Query',              icon: <Terminal size={15} /> },
  { id: 'general',            label: 'General',            icon: <Settings size={15} /> },
  { id: 'connected-accounts', label: 'Connected Accounts', icon: <Link size={15} /> },
]

interface Props {
  settings: AppSettings
  savedConnections: SavedConnection[]
  onClose: () => void
  onSettingsChange: (patch: Partial<AppSettings>) => void
  onSettingsSave: (s: AppSettings) => void
  onDeleteSaved: (id: string) => void
  initialSection?: Section
}

export function SettingsView({
  settings,
  savedConnections,
  onClose, onSettingsChange, onSettingsSave, onDeleteSaved,
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
      <div className="settings-topbar">
        <button className="settings-back-btn" onClick={onClose}>← Back</button>
        {dirty && (
          <button className="settings-save-btn" onClick={handleSave}>Save Changes</button>
        )}
      </div>

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
          {activeSection === 'connected-accounts' && (
            <SettingsConnectedAccounts savedConnections={savedConnections} onDeleteSaved={onDeleteSaved} />
          )}
        </div>
      </div>
    </div>
  )
}
