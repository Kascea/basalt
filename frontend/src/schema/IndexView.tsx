import { DatabaseService, type IndexInfo, type CreateIndexRequest } from '../../bindings/basalt/db'
import { Modal } from '../ui/Modal'
import { useSchemaObjects } from '../connection/useSchemaObjects'

interface Props {
  connectionID: string
  schema: string
  onStatus: (msg: string) => void
}

const defaultForm = (schema: string): CreateIndexRequest => ({
  schema,
  table: '',
  name: '',
  columns: '',
  isUnique: false,
  method: 'btree',
})

export function IndexView({ connectionID, schema, onStatus }: Props) {
  const { items: indexes, isLoading, showCreate, form, isSubmitting,
          load, setForm, openCreate, closeCreate, handleDrop, handleCreate } =
    useSchemaObjects<IndexInfo, CreateIndexRequest>({
      connectionID,
      schema,
      onStatus,
      onLoad: () => DatabaseService.ListIndexes(connectionID, schema),
      onDrop: (idx) => DatabaseService.DropIndex(connectionID, schema, idx.name),
      onCreate: (f) => DatabaseService.CreateIndex(connectionID, f),
      defaultForm: () => defaultForm(schema),
      dropConfirmMessage: (idx) => `Drop index ${idx.name}? This cannot be undone.`,
      dropStatusMessage: (idx) => `Dropped index ${idx.name}`,
      createStatusMessage: (f) => `Created index ${f.name}`,
      canDrop: (idx) => idx.isPrimary
        ? `Cannot drop primary key index ${idx.name} directly — drop the constraint instead`
        : null,
    })

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
        <Modal title="Create Index" onClose={closeCreate}>
          <form className="mgmt-form" onSubmit={handleCreate}>
            <label>
              <span>Table</span>
              <input
                value={form.table}
                onChange={(e) => setForm({ table: e.target.value })}
                placeholder="table_name"
                required
              />
            </label>
            <label>
              <span>Index name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                placeholder="idx_table_column"
                required
              />
            </label>
            <label>
              <span>Columns (comma-separated)</span>
              <input
                value={form.columns}
                onChange={(e) => setForm({ columns: e.target.value })}
                placeholder="col1, col2"
                required
              />
            </label>
            <div className="form-row">
              <label>
                <span>Method</span>
                <select value={form.method} onChange={(e) => setForm({ method: e.target.value })}>
                  <option value="btree">btree</option>
                  <option value="hash">hash</option>
                  <option value="gin">gin</option>
                  <option value="gist">gist</option>
                </select>
              </label>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.isUnique} onChange={(e) => setForm({ isUnique: e.target.checked })} />
              <span>Unique</span>
            </label>
            <div className="form-footer">
              <button type="button" className="compact-btn" onClick={closeCreate}>Cancel</button>
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
