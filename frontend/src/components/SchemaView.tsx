import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check, Plus, Trash2, RotateCcw, Database, AlertCircle } from 'lucide-react'
import { DatabaseService, type ColumnInfo, type TypeGroup } from '../../bindings/basalt/db'

interface Props {
  connectionID: string
  schema: string
  table: string
  onTableRefresh?: () => void
}

// ── TypeSelect (inline) ───────────────────────────────────────────────────────

function useColumnTypes(connectionID: string) {
  const [groups, setGroups] = useState<TypeGroup[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    DatabaseService.ListColumnTypes(connectionID)
      .then(r => { setGroups(r ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [connectionID])
  return { groups, loading }
}

function TypeSelect({ value, onChange, groups, loading, dirty = false }: {
  value: string
  onChange: (v: string) => void
  groups: TypeGroup[]
  loading: boolean
  dirty?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const q = search.toLowerCase()
  const filtered = q
    ? groups.map(g => ({ ...g, types: g.types.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) })).filter(g => g.types.length > 0)
    : groups

  return (
    <div className="type-select" ref={ref}>
      <button type="button" className={`type-select-trigger${dirty ? ' dirty' : ''}`} onClick={() => setOpen(v => !v)} disabled={loading}>
        <span className="type-select-value">
          {loading ? 'Loading…' : value || <span className="type-select-placeholder">select type…</span>}
        </span>
        <ChevronDown size={11} className={`type-select-chevron${open ? ' open' : ''}`} />
      </button>
      {open && (
        <div className="type-select-dropdown">
          <div className="type-select-search-wrap">
            <input ref={searchRef} className="type-select-search" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search types…"
              onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setSearch('') } }}
            />
          </div>
          <div className="type-select-list">
            {filtered.length === 0 && <div className="type-select-empty">No match for "{search}"</div>}
            {filtered.map(group => (
              <div key={group.label}>
                <div className="type-select-group-label">{group.label}</div>
                {group.types.map(t => (
                  <button key={t.name} type="button"
                    className={`type-select-item${value === t.name ? ' selected' : ''}`}
                    onMouseDown={e => { e.preventDefault(); onChange(t.name); setOpen(false); setSearch('') }}
                  >
                    <span className="type-select-item-name">{t.name}</span>
                    <span className="type-select-item-desc">{t.description}</span>
                    {value === t.name && <Check size={11} className="type-select-check" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function qi(name: string) { return `"${name.replace(/"/g, '""')}"` }
function tableRef(schema: string, table: string) { return `${qi(schema)}.${qi(table)}` }

interface ColEdit {
  dataType?: string
  isNullable?: boolean
  columnDefault?: string
}

interface NewCol {
  id: string
  name: string
  dataType: string
  isNullable: boolean
  columnDefault: string
}

function newColId() { return `new-${Date.now()}-${Math.random().toString(36).slice(2)}` }

// ── SchemaView ────────────────────────────────────────────────────────────────

export function SchemaView({ connectionID, schema, table, onTableRefresh }: Props) {
  const { groups, loading: typesLoading } = useColumnTypes(connectionID)

  const [dbCols, setDbCols] = useState<ColumnInfo[]>([])
  const [edits, setEdits] = useState<Record<string, ColEdit>>({})
  const [deletes, setDeletes] = useState<Set<string>>(new Set())
  const [newCols, setNewCols] = useState<NewCol[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCommitting, setIsCommitting] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setIsLoading(true)
    DatabaseService.GetTableColumns(connectionID, schema, table)
      .then(cols => { setDbCols(cols ?? []); setIsLoading(false) })
      .catch(err => { setError(String(err)); setIsLoading(false) })
  }

  useEffect(load, [connectionID, schema, table])

  // Set initial type for new cols once type groups load
  useEffect(() => {
    if (!typesLoading && groups.length > 0) {
      const defaultType = groups[0]?.types[0]?.name ?? 'text'
      setNewCols(prev => prev.map(c => c.dataType ? c : { ...c, dataType: defaultType }))
    }
  }, [typesLoading, groups])

  const patchEdit = (colName: string, patch: Partial<ColEdit>) =>
    setEdits(prev => ({ ...prev, [colName]: { ...prev[colName], ...patch } }))

  const toggleDelete = (colName: string) =>
    setDeletes(prev => {
      const next = new Set(prev)
      next.has(colName) ? next.delete(colName) : next.add(colName)
      return next
    })

  const addNewCol = () => {
    const defaultType = groups[0]?.types[0]?.name ?? 'text'
    setNewCols(prev => [...prev, { id: newColId(), name: '', dataType: defaultType, isNullable: true, columnDefault: '' }])
  }

  const removeNewCol = (id: string) => setNewCols(prev => prev.filter(c => c.id !== id))

  const patchNewCol = (id: string, patch: Partial<NewCol>) =>
    setNewCols(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))

  const hasPendingChanges = Object.keys(edits).length > 0 || deletes.size > 0 || newCols.length > 0

  const discard = () => { setEdits({}); setDeletes(new Set()); setNewCols([]); setError('') }

  const commit = async () => {
    setIsCommitting(true)
    setError('')
    const tRef = tableRef(schema, table)
    try {
      for (const name of deletes) {
        await DatabaseService.ExecuteQuery(connectionID, `ALTER TABLE ${tRef} DROP COLUMN ${qi(name)}`)
      }
      for (const [colName, edit] of Object.entries(edits)) {
        if (edit.dataType !== undefined) {
          await DatabaseService.ExecuteQuery(connectionID, `ALTER TABLE ${tRef} ALTER COLUMN ${qi(colName)} TYPE ${edit.dataType}`)
        }
        if (edit.isNullable !== undefined) {
          const op = edit.isNullable ? 'DROP NOT NULL' : 'SET NOT NULL'
          await DatabaseService.ExecuteQuery(connectionID, `ALTER TABLE ${tRef} ALTER COLUMN ${qi(colName)} ${op}`)
        }
        if (edit.columnDefault !== undefined) {
          const op = edit.columnDefault.trim() === ''
            ? 'DROP DEFAULT'
            : `SET DEFAULT ${edit.columnDefault.trim()}`
          await DatabaseService.ExecuteQuery(connectionID, `ALTER TABLE ${tRef} ALTER COLUMN ${qi(colName)} ${op}`)
        }
      }
      for (const col of newCols) {
        if (!col.name.trim() || !col.dataType) continue
        let sql = `ALTER TABLE ${tRef} ADD COLUMN ${qi(col.name.trim())} ${col.dataType}`
        if (!col.isNullable) sql += ' NOT NULL'
        if (col.columnDefault.trim()) sql += ` DEFAULT ${col.columnDefault.trim()}`
        await DatabaseService.ExecuteQuery(connectionID, sql)
      }
      setEdits({})
      setDeletes(new Set())
      setNewCols([])
      onTableRefresh?.()
      load()
    } catch (err) {
      setError(String(err))
    } finally {
      setIsCommitting(false)
    }
  }

  const pendingLabel = () => {
    const parts: string[] = []
    if (deletes.size > 0) parts.push(`${deletes.size} dropped`)
    if (Object.keys(edits).length > 0) parts.push(`${Object.keys(edits).length} altered`)
    if (newCols.length > 0) parts.push(`${newCols.length} added`)
    return parts.join(', ') + ' pending'
  }

  return (
    <div className="schema-view">
      <div className="grid-toolbar">
        <div className="grid-toolbar-left">
          <span className="grid-label">{schema}.{table}</span>
          <span className="grid-count">{dbCols.length} column{dbCols.length !== 1 ? 's' : ''}</span>
          {hasPendingChanges && (
            <>
              <div className="toolbar-sep" />
              <span className="dirty-indicator">{pendingLabel()}</span>
              <button className="compact-btn toolbar-btn" onClick={discard} disabled={isCommitting}>
                <RotateCcw size={12} /> Discard
              </button>
              <button className="compact-btn toolbar-btn primary" onClick={commit} disabled={isCommitting}>
                <Database size={12} /><Check size={10} strokeWidth={3} /> {isCommitting ? 'Saving…' : 'Commit'}
              </button>
            </>
          )}
        </div>
        <div className="grid-toolbar-right">
          <button className="compact-btn toolbar-btn" onClick={addNewCol}>
            <Plus size={12} strokeWidth={2.5} /> Add Column
          </button>
        </div>
      </div>

      {error && (
        <div className="schema-error-banner">
          <AlertCircle size={14} className="schema-error-icon" />
          <pre className="schema-error-text">{error}</pre>
          <button type="button" className="schema-error-dismiss" onClick={() => setError('')} title="Dismiss">✕</button>
        </div>
      )}

      {isLoading ? (
        <p className="empty-state centered">Loading columns…</p>
      ) : (
        <div className="schema-col-table-wrap">
          <table className="schema-col-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th className="col-center">Nullable</th>
                <th>Default</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {dbCols.map(col => {
                const isDeleted = deletes.has(col.name)
                const edit = edits[col.name] ?? {}
                const isEdited = !isDeleted && Object.keys(edit).length > 0
                const currentType = edit.dataType ?? col.dataType
                const currentNullable = edit.isNullable ?? col.isNullable
                const currentDefault = edit.columnDefault ?? (col.columnDefault ?? '')
                const originalDefault = col.columnDefault ?? ''

                const typeEdited = edit.dataType !== undefined
                const nullableEdited = edit.isNullable !== undefined
                const defaultEdited = edit.columnDefault !== undefined

                let rowClass = ''
                if (isDeleted) rowClass = 'schema-row-deleted'
                else if (isEdited) rowClass = 'schema-row-edited'

                return (
                  <tr key={col.name} className={rowClass}>
                    <td className="col-name">{col.name}</td>
                    <td className={`col-type${typeEdited ? ' cell-edited' : ''}`}>
                      {isDeleted ? (
                        <span className="deleted-value">{col.dataType}</span>
                      ) : (
                        <TypeSelect
                          value={currentType}
                          onChange={v => patchEdit(col.name, { dataType: v })}
                          groups={groups}
                          loading={typesLoading}
                          dirty={typeEdited}
                        />
                      )}
                    </td>
                    <td className={`col-center${nullableEdited ? ' cell-edited' : ''}`}>
                      <input
                        type="checkbox"
                        className="schema-checkbox"
                        checked={currentNullable}
                        disabled={isDeleted}
                        onChange={e => patchEdit(col.name, { isNullable: e.target.checked })}
                      />
                    </td>
                    <td className={`col-default${defaultEdited ? ' cell-edited' : ''}`}>
                      <input
                        className={`schema-default-input${defaultEdited ? ' input-dirty' : ''}`}
                        value={currentDefault}
                        disabled={isDeleted}
                        placeholder="none"
                        onChange={e => patchEdit(col.name, { columnDefault: e.target.value })}
                        onBlur={e => {
                          if (e.target.value === originalDefault) {
                            setEdits(prev => {
                              const next = { ...prev }
                              const { columnDefault: _, ...rest } = next[col.name] ?? {}
                              if (Object.keys(rest).length === 0) delete next[col.name]
                              else next[col.name] = rest
                              return next
                            })
                          }
                        }}
                      />
                    </td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className={`compact-btn icon-btn${isDeleted ? ' restore-btn' : ' delete-btn'}`}
                        title={isDeleted ? 'Restore column' : 'Drop column'}
                        onClick={() => toggleDelete(col.name)}
                      >
                        {isDeleted ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                      </button>
                    </td>
                  </tr>
                )
              })}

              {newCols.map(col => (
                <tr key={col.id} className="row-new">
                  <td className="col-name">
                    <input
                      className="schema-name-input"
                      value={col.name}
                      placeholder="column_name"
                      onChange={e => patchNewCol(col.id, { name: e.target.value })}
                      autoFocus
                    />
                  </td>
                  <td className="col-type">
                    <TypeSelect
                      value={col.dataType}
                      onChange={v => patchNewCol(col.id, { dataType: v })}
                      groups={groups}
                      loading={typesLoading}
                    />
                  </td>
                  <td className="col-center">
                    <input
                      type="checkbox"
                      className="schema-checkbox"
                      checked={col.isNullable}
                      onChange={e => patchNewCol(col.id, { isNullable: e.target.checked })}
                    />
                  </td>
                  <td className="col-default">
                    <input
                      className="schema-default-input"
                      value={col.columnDefault}
                      placeholder="none"
                      onChange={e => patchNewCol(col.id, { columnDefault: e.target.value })}
                    />
                  </td>
                  <td className="col-actions">
                    <button
                      type="button"
                      className="compact-btn icon-btn delete-btn"
                      title="Remove"
                      onClick={() => removeNewCol(col.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}

              {dbCols.length === 0 && newCols.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">No columns found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
