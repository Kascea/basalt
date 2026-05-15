import { useEffect, useState } from 'react'
import { DatabaseService, type ForeignKeyInfo, type AddForeignKeyRequest } from '../../bindings/basalt/db'
import { Modal } from './Modal'

interface Props {
  connectionID: string
  schema: string
  onStatus: (msg: string) => void
}

const defaultReq = (schema: string): AddForeignKeyRequest => ({
  schema,
  table: '',
  name: '',
  column: '',
  foreignSchema: schema,
  foreignTable: '',
  foreignColumn: '',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})

const RULE_OPTIONS = ['NO ACTION', 'CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT']

export function ForeignKeyView({ connectionID, schema, onStatus }: Props) {
  const [fks, setFks] = useState<ForeignKeyInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<AddForeignKeyRequest>(defaultReq(schema))
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = () => {
    setIsLoading(true)
    DatabaseService.ListForeignKeys(connectionID, schema)
      .then(setFks)
      .catch((err) => onStatus(String(err)))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
  }, [connectionID, schema])

  const handleDrop = (fk: ForeignKeyInfo) => {
    if (!confirm(`Drop foreign key ${fk.name} on ${fk.tableName}? This cannot be undone.`)) return
    DatabaseService.DropForeignKey(connectionID, schema, fk.tableName, fk.name)
      .then(() => {
        onStatus(`Dropped foreign key ${fk.name}`)
        load()
      })
      .catch((err) => onStatus(String(err)))
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    DatabaseService.AddForeignKey(connectionID, form)
      .then(() => {
        onStatus(`Added foreign key ${form.name}`)
        setShowCreate(false)
        setForm(defaultReq(schema))
        load()
      })
      .catch((err) => onStatus(String(err)))
      .finally(() => setIsSubmitting(false))
  }

  const openCreate = () => {
    setForm(defaultReq(schema))
    setShowCreate(true)
  }

  return (
    <div className="mgmt-view">
      <div className="mgmt-toolbar">
        <span className="mgmt-title">{schema} · Foreign Keys</span>
        <span className="mgmt-count">{fks.length} constraints</span>
        <div className="mgmt-actions">
          <button className="compact-btn" onClick={load}>↻ Refresh</button>
          <button className="compact-btn primary" onClick={openCreate}>+ Add</button>
        </div>
      </div>

      {isLoading ? (
        <p className="empty-state centered">Loading foreign keys…</p>
      ) : fks.length === 0 ? (
        <p className="empty-state centered">No foreign keys in {schema}</p>
      ) : (
        <div className="mgmt-list">
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>Constraint</th>
                <th>Table · Column</th>
                <th>References</th>
                <th>On Delete</th>
                <th>On Update</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fks.map((fk) => (
                <tr key={`${fk.tableName}.${fk.name}`}>
                  <td className="mono-cell">{fk.name}</td>
                  <td className="mono-cell">{fk.tableName}.{fk.columnName}</td>
                  <td className="mono-cell">{fk.foreignSchema}.{fk.foreignTable}.{fk.foreignColumn}</td>
                  <td>{fk.onDelete}</td>
                  <td>{fk.onUpdate}</td>
                  <td className="action-cell">
                    <button className="danger-btn" onClick={() => handleDrop(fk)}>Drop</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Add Foreign Key" onClose={() => setShowCreate(false)}>
          <form className="mgmt-form" onSubmit={handleCreate}>
            <label>
              <span>Constraint name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="fk_table_column"
                required
              />
            </label>
            <div className="form-row">
              <label>
                <span>Table</span>
                <input
                  value={form.table}
                  onChange={(e) => setForm({ ...form, table: e.target.value })}
                  placeholder="table_name"
                  required
                />
              </label>
              <label>
                <span>Column</span>
                <input
                  value={form.column}
                  onChange={(e) => setForm({ ...form, column: e.target.value })}
                  placeholder="column_name"
                  required
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Foreign schema</span>
                <input
                  value={form.foreignSchema}
                  onChange={(e) => setForm({ ...form, foreignSchema: e.target.value })}
                  placeholder={schema}
                />
              </label>
              <label>
                <span>Foreign table</span>
                <input
                  value={form.foreignTable}
                  onChange={(e) => setForm({ ...form, foreignTable: e.target.value })}
                  placeholder="ref_table"
                  required
                />
              </label>
            </div>
            <label>
              <span>Foreign column</span>
              <input
                value={form.foreignColumn}
                onChange={(e) => setForm({ ...form, foreignColumn: e.target.value })}
                placeholder="ref_column"
                required
              />
            </label>
            <div className="form-row">
              <label>
                <span>On delete</span>
                <select value={form.onDelete} onChange={(e) => setForm({ ...form, onDelete: e.target.value })}>
                  {RULE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label>
                <span>On update</span>
                <select value={form.onUpdate} onChange={(e) => setForm({ ...form, onUpdate: e.target.value })}>
                  {RULE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            </div>
            <div className="form-footer">
              <button type="button" className="compact-btn" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="compact-btn primary" disabled={isSubmitting}>
                {isSubmitting ? 'Adding…' : 'Add Constraint'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
