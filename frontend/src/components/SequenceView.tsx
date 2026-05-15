import { DatabaseService, type SequenceInfo, type CreateSequenceRequest } from '../../bindings/basalt/db'
import { Modal } from './Modal'
import { useSchemaObjects } from '../hooks/useSchemaObjects'

interface Props {
  connectionID: string
  schema: string
  onStatus: (msg: string) => void
}

const defaultForm = (schema: string): CreateSequenceRequest => ({
  schema,
  name: '',
  incrementBy: 1,
  startValue: 1,
  minValue: 1,
  maxValue: 9223372036854775807,
  isCycled: false,
})

export function SequenceView({ connectionID, schema, onStatus }: Props) {
  const { items: sequences, isLoading, showCreate, form, isSubmitting,
          load, setForm, openCreate, closeCreate, handleDrop, handleCreate } =
    useSchemaObjects<SequenceInfo, CreateSequenceRequest>({
      connectionID,
      schema,
      onStatus,
      onLoad: () => DatabaseService.ListSequences(connectionID, schema),
      onDrop: (seq) => DatabaseService.DropSequence(connectionID, schema, seq.name),
      onCreate: (f) => DatabaseService.CreateSequence(connectionID, f),
      defaultForm: () => defaultForm(schema),
      dropConfirmMessage: (seq) => `Drop sequence ${schema}.${seq.name}? This cannot be undone.`,
      dropStatusMessage: (seq) => `Dropped sequence ${schema}.${seq.name}`,
      createStatusMessage: (f) => `Created sequence ${schema}.${f.name}`,
    })

  return (
    <div className="mgmt-view">
      <div className="mgmt-toolbar">
        <span className="mgmt-title">{schema} · Sequences</span>
        <span className="mgmt-count">{sequences.length} sequences</span>
        <div className="mgmt-actions">
          <button className="compact-btn" onClick={load}>↻ Refresh</button>
          <button className="compact-btn primary" onClick={openCreate}>+ Create</button>
        </div>
      </div>

      {isLoading ? (
        <p className="empty-state centered">Loading sequences…</p>
      ) : sequences.length === 0 ? (
        <p className="empty-state centered">No sequences in {schema}</p>
      ) : (
        <div className="mgmt-list">
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Last Value</th>
                <th>Increment</th>
                <th>Min</th>
                <th>Max</th>
                <th>Cycled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((seq) => (
                <tr key={seq.name}>
                  <td className="mono-cell">{seq.name}</td>
                  <td className="mono-cell">{seq.lastValue}</td>
                  <td className="mono-cell">{seq.incrementBy}</td>
                  <td className="mono-cell">{seq.minValue}</td>
                  <td className="mono-cell">{seq.maxValue}</td>
                  <td>{seq.isCycled ? 'Yes' : 'No'}</td>
                  <td className="action-cell">
                    <button className="danger-btn" onClick={() => handleDrop(seq)}>Drop</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Create Sequence" onClose={closeCreate}>
          <form className="mgmt-form" onSubmit={handleCreate}>
            <label>
              <span>Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                placeholder="sequence_name"
                required
              />
            </label>
            <div className="form-row">
              <label>
                <span>Increment by</span>
                <input type="number" value={form.incrementBy} onChange={(e) => setForm({ incrementBy: parseInt(e.target.value) || 1 })} />
              </label>
              <label>
                <span>Start value</span>
                <input type="number" value={form.startValue} onChange={(e) => setForm({ startValue: parseInt(e.target.value) || 1 })} />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Min value</span>
                <input type="number" value={form.minValue} onChange={(e) => setForm({ minValue: parseInt(e.target.value) || 1 })} />
              </label>
              <label>
                <span>Max value</span>
                <input type="number" value={form.maxValue} onChange={(e) => setForm({ maxValue: parseInt(e.target.value) || 9223372036854775807 })} />
              </label>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.isCycled} onChange={(e) => setForm({ isCycled: e.target.checked })} />
              <span>Cycle when limit reached</span>
            </label>
            <div className="form-footer">
              <button type="button" className="compact-btn" onClick={closeCreate}>Cancel</button>
              <button type="submit" className="compact-btn primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create Sequence'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
