import { useEffect, useState } from 'react'
import { DatabaseService, type SequenceInfo, type CreateSequenceRequest } from '../../bindings/basalt'
import { Modal } from './Modal'

interface Props {
  connectionID: string
  schema: string
  onStatus: (msg: string) => void
}

const defaultReq = (): CreateSequenceRequest => ({
  schema: '',
  name: '',
  incrementBy: 1,
  startValue: 1,
  minValue: 1,
  maxValue: 9223372036854775807,
  isCycled: false,
})

export function SequenceView({ connectionID, schema, onStatus }: Props) {
  const [sequences, setSequences] = useState<SequenceInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateSequenceRequest>({ ...defaultReq(), schema })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = () => {
    setIsLoading(true)
    DatabaseService.ListSequences(connectionID, schema)
      .then(setSequences)
      .catch((err) => onStatus(String(err)))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
  }, [connectionID, schema])

  const handleDrop = (name: string) => {
    if (!confirm(`Drop sequence ${schema}.${name}? This cannot be undone.`)) return
    DatabaseService.DropSequence(connectionID, schema, name)
      .then(() => {
        onStatus(`Dropped sequence ${schema}.${name}`)
        load()
      })
      .catch((err) => onStatus(String(err)))
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    DatabaseService.CreateSequence(connectionID, form)
      .then(() => {
        onStatus(`Created sequence ${schema}.${form.name}`)
        setShowCreate(false)
        setForm({ ...defaultReq(), schema })
        load()
      })
      .catch((err) => onStatus(String(err)))
      .finally(() => setIsSubmitting(false))
  }

  const openCreate = () => {
    setForm({ ...defaultReq(), schema })
    setShowCreate(true)
  }

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
                    <button className="danger-btn" onClick={() => handleDrop(seq.name)}>Drop</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Create Sequence" onClose={() => setShowCreate(false)}>
          <form className="mgmt-form" onSubmit={handleCreate}>
            <label>
              <span>Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="sequence_name"
                required
              />
            </label>
            <div className="form-row">
              <label>
                <span>Increment by</span>
                <input type="number" value={form.incrementBy} onChange={(e) => setForm({ ...form, incrementBy: parseInt(e.target.value) || 1 })} />
              </label>
              <label>
                <span>Start value</span>
                <input type="number" value={form.startValue} onChange={(e) => setForm({ ...form, startValue: parseInt(e.target.value) || 1 })} />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Min value</span>
                <input type="number" value={form.minValue} onChange={(e) => setForm({ ...form, minValue: parseInt(e.target.value) || 1 })} />
              </label>
              <label>
                <span>Max value</span>
                <input type="number" value={form.maxValue} onChange={(e) => setForm({ ...form, maxValue: parseInt(e.target.value) || 9223372036854775807 })} />
              </label>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.isCycled} onChange={(e) => setForm({ ...form, isCycled: e.target.checked })} />
              <span>Cycle when limit reached</span>
            </label>
            <div className="form-footer">
              <button type="button" className="compact-btn" onClick={() => setShowCreate(false)}>Cancel</button>
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
