import { useState, useEffect } from 'react'
import { Plus, Trash2, RotateCcw, AlertCircle, X } from 'lucide-react'
import { DatabaseService, type ColumnInfo } from '../../bindings/basalt/db'
import { GridToolbar } from '../table/GridToolbar'
import { TypeSelect, useColumnTypes } from '../ui/TypeSelect'

interface Props {
  connectionID: string
  schema: string
  table: string
  addColumn?: boolean
  onTableRefresh?: () => void
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

export function SchemaView({ connectionID, schema, table, addColumn, onTableRefresh }: Props) {
  const { groups, loading: typesLoading } = useColumnTypes(connectionID)

  const [dbCols, setDbCols] = useState<ColumnInfo[]>([])
  const [edits, setEdits] = useState<Record<string, ColEdit>>({})
  const [deletes, setDeletes] = useState<Set<string>>(new Set())
  const [newCols, setNewCols] = useState<NewCol[]>(() =>
    addColumn ? [{ id: newColId(), name: '', dataType: '', isNullable: true, columnDefault: '' }] : []
  )
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

  const pendingLabel = (() => {
    const parts: string[] = []
    if (deletes.size > 0) parts.push(`${deletes.size} dropped`)
    if (Object.keys(edits).length > 0) parts.push(`${Object.keys(edits).length} altered`)
    if (newCols.length > 0) parts.push(`${newCols.length} added`)
    return parts.length > 0 ? `${parts.join(', ')} pending` : undefined
  })()

  return (
    <div className="schema-view">
      <GridToolbar
        label={`${schema}.${table}`}
        count={`${dbCols.length} column${dbCols.length !== 1 ? 's' : ''}`}
        pendingLabel={pendingLabel}
        isCommitting={isCommitting}
        onDiscard={discard}
        onCommit={commit}
        actions={
          <button className="compact-btn toolbar-btn" onClick={addNewCol}>
            <Plus size={12} strokeWidth={2.5} /> Add Column
          </button>
        }
      />

      {error && (
        <div className="schema-error-banner">
          <AlertCircle size={14} className="schema-error-icon" />
          <pre className="schema-error-text">{error}</pre>
          <button type="button" className="schema-error-dismiss" onClick={() => setError('')} title="Dismiss"><X size={14} /></button>
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
