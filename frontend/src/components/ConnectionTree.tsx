import { useEffect, useMemo, useState } from 'react'
import { type Connection, type SchemaObject } from '../../bindings/basalt'

// ── Type metadata ────────────────────────────────────────────────────────────

const TYPE_TO_GROUP: Record<string, string> = {
  Table: 'Tables',
  View: 'Views',
  'Materialized View': 'Materialized Views',
  Index: 'Indexes',
  Sequence: 'Sequences',
}

const GROUP_ICON: Record<string, string> = {
  Tables: '▦',
  Views: '◉',
  'Materialized Views': '◉',
  Indexes: '⊟',
  Sequences: '≡',
  'Foreign Keys': '⇒',
}

const GROUP_ORDER = ['Tables', 'Views', 'Materialized Views', 'Sequences', 'Indexes']

const OPENABLE_GROUPS = new Set(['Tables', 'Views', 'Materialized Views'])

// Groups that link to a management view (→ action button)
const MANAGED_KIND: Record<string, 'sequences' | 'indexes' | 'foreignkeys'> = {
  Sequences: 'sequences',
  Indexes: 'indexes',
  'Foreign Keys': 'foreignkeys',
}


function groupOrder(name: string) {
  const i = GROUP_ORDER.indexOf(name)
  return i === -1 ? 99 : i
}

// ── Grouping helpers ─────────────────────────────────────────────────────────

function groupBySchema(objects: SchemaObject[]): Record<string, SchemaObject[]> {
  const out: Record<string, SchemaObject[]> = {}
  for (const obj of objects) {
    if (!out[obj.schema]) out[obj.schema] = []
    out[obj.schema].push(obj)
  }
  return out
}

function groupByType(objects: SchemaObject[]): Array<{ groupName: string; items: SchemaObject[] }> {
  const map: Record<string, SchemaObject[]> = {}
  for (const obj of objects) {
    const g = TYPE_TO_GROUP[obj.type] ?? `${obj.type}s`
    if (!map[g]) map[g] = []
    map[g].push(obj)
  }
  return Object.entries(map)
    .sort(([a], [b]) => groupOrder(a) - groupOrder(b))
    .map(([groupName, items]) => ({ groupName, items }))
}

// ── Component ────────────────────────────────────────────────────────────────

interface ContextMenu {
  x: number
  y: number
  schema: string
  name: string
}

interface Props {
  connections: Connection[]
  activeConnectionID: string
  objects: SchemaObject[]
  expandedConnections: Set<string>
  expandedSchemas: Set<string>
  filter: string
  onConnectionClick: (id: string) => void
  onSchemaToggle: (schema: string) => void
  onFilterChange: (value: string) => void
  onRefresh: () => void
  onTableOpen: (schema: string, table: string) => void
  onTableOpenNewTab: (schema: string, table: string) => void
  onGroupOpen?: (schema: string, kind: 'sequences' | 'indexes' | 'foreignkeys') => void
}

export function ConnectionTree({
  connections, activeConnectionID, objects, expandedConnections, expandedSchemas,
  filter, onConnectionClick, onSchemaToggle, onFilterChange, onRefresh,
  onTableOpen, onTableOpenNewTab, onGroupOpen,
}: Props) {
  const [activeSchema, setActiveSchema] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  const filteredObjects = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return objects
    return objects.filter((o) =>
      [o.schema, o.name, o.type].some((v) => v.toLowerCase().includes(q)),
    )
  }, [filter, objects])

  const objectsBySchema = useMemo(() => groupBySchema(filteredObjects), [filteredObjects])

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleSchemaClick = (schema: string) => {
    setActiveSchema(schema)
    onSchemaToggle(schema)
  }

  if (connections.length === 0) {
    return <p className="tree-empty">No connections — click + to add one</p>
  }

  return (
    <>
      {connections.map((conn) => {
        const connExpanded = expandedConnections.has(conn.id)
        const isActiveConn = conn.id === activeConnectionID

        return (
          <div key={conn.id} className="tree-section">
            <button
              className={`tree-node conn-node${isActiveConn ? ' is-active' : ''}`}
              onClick={() => onConnectionClick(conn.id)}
            >
              <span className={`chevron expandable${connExpanded ? ' open' : ''}`} />
              <span className="node-icon conn-icon">⬡</span>
              <span className="node-label">{conn.name}</span>
              <span className="driver-badge">{conn.driver}</span>
            </button>

            {connExpanded && (
              <div className="tree-children">
                <div className="tree-filter-row">
                  <input
                    className="tree-filter"
                    value={filter}
                    onChange={(e) => onFilterChange(e.target.value)}
                    placeholder="Filter…"
                  />
                  <button className="icon-button" title="Refresh" onClick={onRefresh}>↻</button>
                </div>

                {Object.keys(objectsBySchema).length === 0 && (
                  <p className="tree-empty indent">No objects found</p>
                )}

                {Object.entries(objectsBySchema).map(([schema, schemaObjs]) => {
                  const schemaExpanded = expandedSchemas.has(schema)
                  const isActiveSchema = schema === activeSchema
                  const typeGroups = groupByType(schemaObjs)

                  return (
                    <div key={schema}>
                      <button
                        className={`tree-node schema-node${isActiveSchema ? ' is-active' : ''}`}
                        onClick={() => handleSchemaClick(schema)}
                      >
                        <span className={`chevron expandable${schemaExpanded ? ' open' : ''}`} />
                        <span className="node-icon schema-icon">◈</span>
                        <span className="node-label">{schema}</span>
                        <span className="count-badge">{schemaObjs.length}</span>
                      </button>

                      {schemaExpanded && (
                        <div className="tree-children">
                          {/* Foreign Keys — click opens view directly */}
                          {onGroupOpen && (
                            <button
                              className="tree-node type-group-node nav-group"
                              onClick={() => onGroupOpen(schema, 'foreignkeys')}
                            >
                              <span className="chevron" />
                              <span className="group-icon">{GROUP_ICON['Foreign Keys']}</span>
                              <span className="node-label">Foreign Keys</span>
                            </button>
                          )}

                          {typeGroups.map(({ groupName, items }) => {
                            const groupKey = `${schema}:${groupName}`
                            const groupExpanded = expandedGroups.has(groupKey)
                            const isOpenable = OPENABLE_GROUPS.has(groupName)
                            const managedKind = MANAGED_KIND[groupName]

                            return (
                              <div key={groupKey}>
                                <button
                                  className={`tree-node type-group-node${managedKind ? ' nav-group' : ''}`}
                                  onClick={() => {
                                    if (managedKind && onGroupOpen) onGroupOpen(schema, managedKind)
                                    else toggleGroup(groupKey)
                                  }}
                                >
                                  <span className={managedKind ? 'chevron' : `chevron expandable${groupExpanded ? ' open' : ''}`} />
                                  <span className="group-icon">{GROUP_ICON[groupName] ?? '▤'}</span>
                                  <span className="node-label">{groupName}</span>
                                  <span className="count-badge">{items.length}</span>
                                </button>

                                {!managedKind && groupExpanded && (
                                  <div className="tree-children">
                                    {items.map((obj) => (
                                      <button
                                        key={`${obj.schema}.${obj.name}`}
                                        className={`tree-node obj-leaf-node${isOpenable ? ' openable' : ''}`}
                                        onClick={() => {
                                          if (isOpenable) onTableOpen(obj.schema, obj.name)
                                        }}
                                        onContextMenu={(e) => {
                                          if (!isOpenable) return
                                          e.preventDefault()
                                          setContextMenu({ x: e.clientX, y: e.clientY, schema: obj.schema, name: obj.name })
                                        }}
                                        title={obj.name}
                                      >
                                        <span className="node-label">{obj.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { onTableOpen(contextMenu.schema, contextMenu.name); setContextMenu(null) }}>
            Open
          </button>
          <button onClick={() => { onTableOpenNewTab(contextMenu.schema, contextMenu.name); setContextMenu(null) }}>
            Open in New Tab
          </button>
        </div>
      )}
    </>
  )
}
