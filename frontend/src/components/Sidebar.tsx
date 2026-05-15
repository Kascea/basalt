import { type Connection, type SchemaObject } from '../../bindings/basalt/db'
import type { SavedConnection } from '../../bindings/basalt/config'
import { Window } from '@wailsio/runtime'
import { ConnectionTree } from './ConnectionTree'

interface Props {
  savedConnections: SavedConnection[]
  connections: Connection[]
  activeConnectionID: string
  objects: SchemaObject[]
  expandedConnections: Set<string>
  expandedSchemas: Set<string>
  filter: string
  isConnecting: string | null
  showSettings: boolean
  onNewConnection: () => void
  onConnectionClick: (id: string) => void
  onReconnect: (id: string) => void
  onDisconnect: (id: string) => void
  onDeleteSaved: (id: string) => void
  onEditSaved: (conn: SavedConnection) => void
  onSchemaToggle: (schema: string) => void
  onFilterChange: (value: string) => void
  onRefresh: () => void
  onTableOpen: (schema: string, table: string) => void
  onTableOpenNewTab: (schema: string, table: string) => void
  onTableOpenSchema: (schema: string, table: string) => void
  onGroupOpen?: (schema: string, kind: 'sequences' | 'indexes') => void
  onSettingsToggle: () => void
}

export function Sidebar({
  savedConnections, connections, activeConnectionID, objects, expandedConnections, expandedSchemas,
  filter, isConnecting, showSettings, onNewConnection, onConnectionClick, onReconnect, onDisconnect,
  onDeleteSaved, onEditSaved, onSchemaToggle, onFilterChange, onRefresh,
  onTableOpen, onTableOpenNewTab, onTableOpenSchema, onGroupOpen, onSettingsToggle,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="brand-row" onDoubleClick={() => Window.ToggleMaximise()}>
        <div className="brand-mark">B</div>
        <span className="brand-name">Basalt</span>
        <button className="brand-add" onClick={onNewConnection}>
          + Connect
        </button>
      </div>

      <div className="tree-root">
        <ConnectionTree
          savedConnections={savedConnections}
          connections={connections}
          activeConnectionID={activeConnectionID}
          objects={objects}
          expandedConnections={expandedConnections}
          expandedSchemas={expandedSchemas}
          filter={filter}
          isConnecting={isConnecting}
          onConnectionClick={onConnectionClick}
          onReconnect={onReconnect}
          onDisconnect={onDisconnect}
          onDeleteSaved={onDeleteSaved}
          onEditSaved={onEditSaved}
          onSchemaToggle={onSchemaToggle}
          onFilterChange={onFilterChange}
          onRefresh={onRefresh}
          onTableOpen={onTableOpen}
          onTableOpenNewTab={onTableOpenNewTab}
          onTableOpenSchema={onTableOpenSchema}
          onGroupOpen={onGroupOpen}
        />
      </div>

      <div className="sidebar-footer">
        <button
          className={`sidebar-footer-btn${showSettings ? ' is-active' : ''}`}
          title="Settings"
          onClick={onSettingsToggle}
        >
          ⚙ Settings
        </button>
      </div>
    </aside>
  )
}
