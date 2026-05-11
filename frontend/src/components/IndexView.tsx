import { useEffect, useState } from 'react'
import { DatabaseService, type IndexInfo, type CreateIndexRequest } from '../../bindings/basalt'
import { Modal } from './Modal'

interface Props {
  connectionID: string
  schema: string
  onStatus: (msg: string) => void
}

const defaultReq = (schema: string): CreateIndexRequest => ({
  schema,
  table: '',
  name: '',
  columns: '',
  isUnique: false,
  method: 'btree',
})

export function IndexView({ connectionID, schema, onStatus }: Props) {
  const [indexes, setIndexes] = useState<IndexInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateIndexRequest>(defaultReq(schema))
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = () => {
    setIsLoading(true)
    DatabaseService.ListIndexes(connectionID, schema)
      .then(setIndexes)
      .catch((err) => onStatus(String(err)))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
  }, [connectionID, schema])

  const handleDrop = (idx: IndexInfo) => {
    if (idx.isPrimary) {
      onStatus(`Cannot drop primary key index ${idx.name} directly — drop the constraint instead`)
      return
    }
    if (!confirm(`Drop index ${idx.name}? This cannot be undone.`)) return
    DatabaseService.DropIndex(connectionID, schema, idx.name)
      .then(() => {
        onStatus(`Dropped index ${idx.name}`)
        load()
      })
      .catch((err) => onStatus(String(err)))
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    DatabaseService.CreateIndex(connectionID, form)
      .then(() => {
        onStatus(`Created index ${form.name}`)
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
        <span className="mgmt-title">{schema} · Indexes</span>
        <span className="mgmt-count">{indexes.length} indexes</span>
        <div className="mgmt-actions">
          <button className="compact-btn" onClick={load}>↻ Refresh</button>
          <button className="compact-btn primary" onClick={openCreate}>+ Create</button>
        </div>
      </div>

      {isLoading ? (
        <p className="empty-state centered">Loading indexes…</p>
      ) : indexes.length === 0 ? (
        <p className="empty-state centered">No indexes in {schema}</p>
      ) : (
        <div className="mgmt-list">
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Table</th>
                <th>Type</th>
                <th>Definition</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {indexes.map((idx) => (
                <tr key={idx.name}>
                  <td className="mono-cell">{idx.name}</td>
                  <td className="mono-cell">{idx.tableName}</td>
                  <td>
                    {idx.isPrimary ? (
                      <span className="badge badge-primary">PRIMARY</span>
                    ) : idx.isUnique ? (
                      <span className="badge badge-unique">UNIQUE</span>
                    ) : (
                      <span className="badge">INDEX</span>
                    )}
                  </td>
                  <td className="mono-cell def-cell" title={idx.definition}>{idx.definition}</td>
                  <td className="action-cell">
                    <button
                      className="danger-btn"
                      onClick={() => handleDrop(idx)}
                      disabled={idx.isPrimary}
                      title={idx.isPrimary ? 'Cannot drop primary key index' : `Drop ${idx.name}`}
                    >
                      Drop
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Create Index" onClose={() => setShowCreate(false)}>
          <form className="mgmt-form" onSubmit={handleCreate}>
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
              <span>Index name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="idx_table_column"
                required
              />
            </label>
            <label>
              <span>Columns (comma-separated)</span>
              <input
                value={form.columns}
                onChange={(e) => setForm({ ...form, columns: e.target.value })}
                placeholder="col1, col2"
                required
              />
            </label>
            <div className="form-row">
              <label>
                <span>Method</span>
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option value="btree">btree</option>
                  <option value="hash">hash</option>
                  <option value="gin">gin</option>
                  <option value="gist">gist</option>
                </select>
              </label>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.isUnique} onChange={(e) => setForm({ ...form, isUnique: e.target.checked })} />
              <span>Unique</span>
            </label>
            <div className="form-footer">
              <button type="button" className="compact-btn" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="compact-btn primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create Index'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
