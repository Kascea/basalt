import type { Connection } from '../../bindings/basalt/db'
import type { AppSettings, SavedConnection } from '../../bindings/basalt/localdb/models'
import styles from './settings.module.css'
import { SettingsAppearance } from './SettingsAppearance'
import { SettingsQuery } from './SettingsQuery'
import { SettingsGeneral } from './SettingsGeneral'
import { SettingsConnectedAccounts } from './SettingsConnectedAccounts'
import { SettingsConnections } from './SettingsConnections'

export type Section = 'appearance' | 'query' | 'general' | 'connections' | 'accounts'

interface Props {
  settings: AppSettings
  savedConnections: SavedConnection[]
  connections: Connection[]
  isConnecting: string | null
  activeSection: Section
  onSettingsChange: (patch: Partial<AppSettings>) => void
  onDeleteSaved: (id: string) => void
  onReconnect: (id: string) => void
  onDisconnect: (id: string) => void
  onEditSaved: (conn: SavedConnection) => void
  onConnect: (name: string, driver: string, connectionString: string, planetscaleKey?: string) => Promise<void>
  onOpenConnection: (id: string) => void
}

export function SettingsView({
  settings,
  savedConnections,
  connections,
  isConnecting,
  activeSection,
  onSettingsChange,
  onDeleteSaved,
  onReconnect,
  onDisconnect,
  onEditSaved,
  onConnect,
  onOpenConnection,
}: Props) {
  return (
    <div className={styles.view}>
      <div className={styles.body}>
        {activeSection === 'appearance' && (
          <SettingsAppearance settings={settings} onChange={onSettingsChange} />
        )}
        {activeSection === 'query' && (
          <SettingsQuery settings={settings} onChange={onSettingsChange} />
        )}
        {activeSection === 'general' && (
          <SettingsGeneral settings={settings} onChange={onSettingsChange} />
        )}
        {activeSection === 'connections' && (
          <SettingsConnections
            savedConnections={savedConnections}
            connections={connections}
            isConnecting={isConnecting}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onDisconnect={onDisconnect}
            onEdit={onEditSaved}
            onDelete={onDeleteSaved}
            onOpen={onOpenConnection}
          />
        )}
        {activeSection === 'accounts' && (
          <SettingsConnectedAccounts
            savedConnections={savedConnections}
            onDeleteSaved={onDeleteSaved}
            onConnect={onConnect}
          />
        )}
      </div>
    </div>
  )
}
