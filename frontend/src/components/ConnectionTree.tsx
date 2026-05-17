import { useEffect, useRef, useState } from 'react'
import { type SchemaObject } from '../../bindings/basalt/db'
import { useConnectionSession } from '../context/ConnectionContext'
import { DeleteConfirmModal } from './DeleteConfirmModal'

// ── Icons ────────────────────────────────────────────────────────────────────

function IconDb() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="6" cy="3.5" rx="4" ry="1.5" />
      <path d="M2 3.5v5c0 .83 1.79 1.5 4 1.5s4-.67 4-1.5v-5" />
      <path d="M2 6.5c0 .83 1.79 1.5 4 1.5s4-.67 4-1.5" />
    </svg>
  )
}

function IconSchema() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6.5h10V5H6.5L5.5 3.5H1V4z" />
    </svg>
  )
}

function IconTable() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="10" height="10" rx="1" />
      <line x1="1" y1="4.5" x2="11" y2="4.5" />
      <line x1="4.5" y1="4.5" x2="4.5" y2="11" />
    </svg>
  )
}

function IconEye() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" />
      <circle cx="6" cy="6" r="1.5" />
    </svg>
  )
}

function IconEyeSolid() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" />
      <circle cx="6" cy="6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconKey() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4" cy="5" r="2.5" />
      <path d="M5.8 6.8L10 11" />
      <path d="M8 9l-1 1.5" />
    </svg>
  )
}

function IconSequence() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 10.5h2V8h2V5.5h2V3h2" />
    </svg>
  )
}


function IconSquares() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="4" height="4" rx="0.5" />
      <rect x="7" y="1" width="4" height="4" rx="0.5" />
      <rect x="1" y="7" width="4" height="4" rx="0.5" />
      <rect x="7" y="7" width="4" height="4" rx="0.5" />
    </svg>
  )
}

function IconOpen() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6h7" />
      <path d="M6.5 3.5L9.5 6l-3 2.5" />
    </svg>
  )
}

function IconOpenNewTab() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2H2.5a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" />
      <path d="M7.5 1.5h3v3" />
      <path d="M10.5 1.5L5.5 6.5" />
    </svg>
  )
}

function IconOpenSchema() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="10" height="10" rx="1" />
      <line x1="1" y1="4.5" x2="11" y2="4.5" />
      <line x1="1" y1="7.5" x2="11" y2="7.5" />
    </svg>
  )
}

function IconConnect() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1.5v3M8 1.5v3M3 4.5h6v1.5a3 3 0 0 1-6 0V4.5z" />
      <line x1="6" y1="8.5" x2="6" y2="10.5" />
    </svg>
  )
}

function IconDisconnect() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1.5v3M8 1.5v3M3 4.5h6v1.5a3 3 0 0 1-6 0V4.5z" />
      <line x1="6" y1="8.5" x2="6" y2="10.5" />
      <line x1="4" y1="9" x2="8" y2="11" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="3.5" x2="10" y2="3.5" />
      <path d="M4.5 3.5V2.5h3v1" />
      <path d="M4 3.5v6.5h4V3.5" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 6a4 4 0 1 1-1.17-2.83" />
      <polyline points="10 2 10 5.5 6.5 5.5" />
    </svg>
  )
}

function IconPlanetScale() {
  return (
    <svg width="13" height="13" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M-0.0981445 16C-0.0981438 7.16344 7.0653 -7.52254e-07 15.9019 0C22.399 5.67998e-07 27.9917 3.87258 30.4975 9.43544L9.3373 30.5956C8.42926 30.1866 7.56625 29.6953 6.75778 29.1313L19.8891 16H15.9019L4.58815 27.3137C1.69272 24.4183 -0.0981449 20.4183 -0.0981445 16Z" fill="white" />
      <path d="M31.9019 16.0055L15.9074 32C24.7396 31.997 31.8989 24.8377 31.9019 16.0055Z" fill="white" />
    </svg>
  )
}

// ── Type metadata ────────────────────────────────────────────────────────────

const TYPE_TO_GROUP: Record<string, string> = {
  Table: 'Tables',
  View: 'Views',
  'Materialized View': 'Materialized Views',
  Index: 'Indexes',
  Sequence: 'Sequences',
}

const GROUP_ICON: Record<string, JSX.Element> = {
  Tables: <IconTable />,
  Views: <IconEye />,
  'Materialized Views': <IconEyeSolid />,
  Indexes: <IconKey />,
  Sequences: <IconSequence />,
}

const GROUP_ORDER = ['Tables', 'Views', 'Materialized Views', 'Sequences']

const OPENABLE_GROUPS = new Set(['Tables', 'Views', 'Materialized Views'])

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

interface TableContextMenu {
  kind: 'table'
  x: number
  y: number
  connectionID: string
  schema: string
  name: string
}

interface ConnContextMenu {
  kind: 'connection'
  x: number
  y: number
  id: string
  connected: boolean
}

type ContextMenu = TableContextMenu | ConnContextMenu

const GROUP_TAB_KIND: Record<string, 'sequences' | 'indexes'> = {
  Sequences: 'sequences',
  Indexes: 'indexes',
}

export function ConnectionTree() {
  const {
    savedConnections, connections, activeTabConnectionID, objectsByConnection,
    isConnecting,
    onConnectionClick, onReconnect, onDisconnect, onDeleteSaved, onEditSaved,
    onRefresh, onTableOpen, onTableOpenNewTab,
    onTableOpenSchema, onGroupOpen,
  } = useConnectionSession()

  // UI state lives here — not in the data hook or context
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set())
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [activeSchema, setActiveSchema] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Auto-expand newly connected connections
  const autoExpandedConnsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const newIds = connections.filter(c => !autoExpandedConnsRef.current.has(c.id)).map(c => c.id)
    if (newIds.length === 0) return
    setExpandedConnections(prev => new Set([...prev, ...newIds]))
    newIds.forEach(id => autoExpandedConnsRef.current.add(id))
  }, [connections])

  // Auto-expand first schema when objects load for a connection
  const autoExpandedSchemaRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const [connID, objs] of Object.entries(objectsByConnection)) {
      if (objs.length > 0 && !autoExpandedSchemaRef.current.has(connID)) {
        setExpandedSchemas(prev => new Set([...prev, objs[0].schema]))
        autoExpandedSchemaRef.current.add(connID)
      }
    }
  }, [objectsByConnection])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  const q = filter.trim().toLowerCase()

  const toggleConnection = (id: string) => {
    setExpandedConnections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    onConnectionClick(id)
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleSchemaClick = (schema: string) => {
    setActiveSchema(schema)
    setExpandedSchemas(prev => {
      const next = new Set(prev)
      next.has(schema) ? next.delete(schema) : next.add(schema)
      return next
    })
  }

  if (savedConnections.length === 0) {
    return <p className="tree-empty">No connections — click + to add one</p>
  }

  return (
    <>
      {savedConnections.map((saved) => {
        const liveConn = connections.find((c) => c.id === saved.id)
        const isConnected = !!liveConn
        const isActive = saved.id === activeTabConnectionID
        const connExpanded = expandedConnections.has(saved.id)
        const connecting = isConnecting === saved.id

        const connObjects = objectsByConnection[saved.id] ?? []
        const filteredObjects = q
          ? connObjects.filter((o) => [o.schema, o.name, o.type].some((v) => v.toLowerCase().includes(q)))
          : connObjects
        const objectsBySchema = groupBySchema(filteredObjects)

        const handleConnClick = () => {
          if (isConnected) {
            toggleConnection(saved.id)
          } else {
            onReconnect(saved.id)
          }
        }

        return (
          <div key={saved.id} className="tree-section">
            <button
              className={`tree-node conn-node${isActive ? ' is-active' : ''}${!isConnected ? ' is-disconnected' : ''}`}
              onClick={handleConnClick}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ kind: 'connection', x: e.clientX, y: e.clientY, id: saved.id, connected: isConnected })
              }}
            >
              <span className={`chevron${isConnected ? ' expandable' : ''}${connExpanded ? ' open' : ''}`} />
              <span className={`node-icon conn-icon${!isConnected ? ' conn-icon--off' : ''}`}>{saved.planetscaleKey ? <IconPlanetScale /> : <IconDb />}</span>
              <span className="node-label">{liveConn?.name ?? saved.name}</span>
              <span className="driver-badge">{saved.driver}</span>
              {connecting && <span className="conn-spinner" />}
              {!isConnected && !connecting && <span className="conn-status-dot conn-status-dot--off" title="Disconnected" />}
            </button>

            {isConnected && connExpanded && (
              <div className="tree-children">
                <input
                  className="tree-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter…"
                />

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
                        <span className="node-icon schema-icon"><IconSchema /></span>
                        <span className="node-label">{schema}</span>
                        <span className="count-badge">{schemaObjs.length}</span>
                      </button>

                      {schemaExpanded && (
                        <div className="tree-children">
                          {typeGroups.map(({ groupName, items }) => {
                            const groupKey = `${schema}:${groupName}`
                            const groupExpanded = expandedGroups.has(groupKey)
                            const isOpenable = OPENABLE_GROUPS.has(groupName)
                            const leafIcon = GROUP_ICON[groupName] ?? <IconSquares />

                            const tabKind = GROUP_TAB_KIND[groupName]

                            return (
                              <div key={groupKey}>
                                <button
                                  className="tree-node type-group-node"
                                  onClick={() => {
                                    if (tabKind && onGroupOpen) onGroupOpen(saved.id, schema, tabKind)
                                    else toggleGroup(groupKey)
                                  }}
                                >
                                  <span className={tabKind ? 'chevron' : `chevron expandable${groupExpanded ? ' open' : ''}`} />
                                  <span className="group-icon">{leafIcon}</span>
                                  <span className="node-label">{groupName}</span>
                                  <span className="count-badge">{items.length}</span>
                                </button>

                                {groupExpanded && (
                                  <div className="tree-children">
                                    {items.map((obj) => (
                                      <button
                                        key={`${obj.schema}.${obj.name}`}
                                        className={`tree-node obj-leaf-node${isOpenable ? ' openable' : ''}`}
                                        onClick={() => {
                                          if (isOpenable) onTableOpen(saved.id, obj.schema, obj.name)
                                        }}
                                        onContextMenu={(e) => {
                                          if (!isOpenable) return
                                          e.preventDefault()
                                          setContextMenu({ kind: 'table', x: e.clientX, y: e.clientY, connectionID: saved.id, schema: obj.schema, name: obj.name })
                                        }}
                                        title={obj.name}
                                      >
                                        <span className="node-icon">{leafIcon}</span>
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

      {contextMenu?.kind === 'table' && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { onTableOpen(contextMenu.connectionID, contextMenu.schema, contextMenu.name); setContextMenu(null) }}>
            <IconOpen /> Open
          </button>
          <button onClick={() => { onTableOpenNewTab(contextMenu.connectionID, contextMenu.schema, contextMenu.name); setContextMenu(null) }}>
            <IconOpenNewTab /> Open in New Tab
          </button>
          <button onClick={() => { onTableOpenSchema(contextMenu.connectionID, contextMenu.schema, contextMenu.name); setContextMenu(null) }}>
            <IconOpenSchema /> Open Schema
          </button>
        </div>
      )}

      {contextMenu?.kind === 'connection' && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.connected ? (
            <>
              <button onClick={() => { onRefresh(); setContextMenu(null) }}>
                <IconRefresh /> Refresh
              </button>
              <button onClick={() => { onDisconnect(contextMenu.id); setContextMenu(null) }}>
                <IconDisconnect /> Disconnect
              </button>
            </>
          ) : (
            <button onClick={() => { onReconnect(contextMenu.id); setContextMenu(null) }}>
              <IconConnect /> Connect
            </button>
          )}
          <button onClick={() => {
            const saved = savedConnections.find((s) => s.id === contextMenu.id)
            if (saved) onEditSaved(saved)
            setContextMenu(null)
          }}>
            <IconPencil /> Edit
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-danger" onClick={() => { setConfirmDeleteId(contextMenu.id); setContextMenu(null) }}>
            <IconTrash /> Delete
          </button>
        </div>
      )}

      {confirmDeleteId && (() => {
        const conn = savedConnections.find(s => s.id === confirmDeleteId)
        return conn ? (
          <DeleteConfirmModal
            message={`Remove "${conn.name}"? The saved credentials will be deleted.`}
            confirmText={conn.name}
            onConfirm={() => { onDeleteSaved(confirmDeleteId); setConfirmDeleteId(null) }}
            onCancel={() => setConfirmDeleteId(null)}
          />
        ) : null
      })()}
    </>
  )
}
