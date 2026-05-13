import { type Connection, type SchemaObject } from '../../bindings/basalt'
import { ConnectionTree } from './ConnectionTree'

interface Props {
  connections: Connection[]
  activeConnectionID: string
  objects: SchemaObject[]
  expandedConnections: Set<string>
  expandedSchemas: Set<string>
  filter: string
  onNewConnection: () => void
  onConnectionClick: (id: string) => void
  onSchemaToggle: (schema: string) => void
  onFilterChange: (value: string) => void
  onRefresh: () => void
  onTableOpen: (schema: string, table: string) => void
  onTableOpenNewTab: (schema: string, table: string) => void
  onGroupOpen?: (schema: string, kind: 'sequences' | 'indexes' | 'foreignkeys') => void
}

export function Sidebar({
  connections, activeConnectionID, objects, expandedConnections, expandedSchemas,
  filter, onNewConnection, onConnectionClick, onSchemaToggle, onFilterChange, onRefresh,
  onTableOpen, onTableOpenNewTab, onGroupOpen,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark">B</div>
        <span className="brand-name">Basalt</span>
        <button
          className="brand-add"
          onClick={onNewConnection}
        >
          + Connect
        </button>
      </div>

      <div className="tree-root">
        <ConnectionTree
          connections={connections}
          activeConnectionID={activeConnectionID}
          objects={objects}
          expandedConnections={expandedConnections}
          expandedSchemas={expandedSchemas}
          filter={filter}
          onConnectionClick={onConnectionClick}
          onSchemaToggle={onSchemaToggle}
          onFilterChange={onFilterChange}
          onRefresh={onRefresh}
          onTableOpen={onTableOpen}
          onTableOpenNewTab={onTableOpenNewTab}
          onGroupOpen={onGroupOpen}
        />
      </div>
    </aside>
  )
}
