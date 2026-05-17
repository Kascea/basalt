import { useState } from 'react'
import { X } from 'lucide-react'
import { DatabaseService, type ColumnDef, type CreateSequenceRequest, type CreateIndexRequest } from '../../bindings/basalt/db'
import { Modal } from './Modal'

interface Props {
  connectionID: string
  schema: string
  kind: 'table' | 'sequence' | 'index'
  onClose: () => void
  onCreated: (msg: string) => void
}

// ── Column types ──────────────────────────────────────────────────────────────

const COMMON_TYPES = [
  'integer', 'bigint', 'smallint',
  'text', 'varchar(255)', 'char(1)',
  'boolean',
  'numeric(10,2)', 'real', 'double precision',
  'date', 'timestamp with time zone', 'timestamp',
  'uuid', 'jsonb', 'bytea',
]

// ── Table form ────────────────────────────────────────────────────────────────

function makeCol(): ColumnDef {
  return { name: '', dataType: 'text', nullable: true, default: '' }
}

function TableForm({ connectionID, schema, onClose, onCreated }: Omit<Props, 'kind'>) {
  const [name, setName] = useState('')
  const [columns, setColumns] = useState<ColumnDef[]>([makeCol()])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateCol = (i: number, patch: Partial<ColumnDef>) => {
    setColumns((cols) => cols.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  }

  const addCol = () => setColumns((c) => [...c, makeCol()])
  const removeCol = (i: number) => setColumns((c) => c.filter((_, idx) => idx !== i))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validCols = columns.filter((c) => c.name.trim() && c.dataType.trim())
    if (validCols.length === 0) return
    setIsSubmitting(true)
    DatabaseService.CreateTable(connectionID, { schema, name, columns: validCols })
      .then(() => onCreated(`Created table ${schema}.${name}`))
      .catch((err) => { onCreated(String(err)); setIsSubmitting(false) })
  }

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <label className="create-field">
        <span>Table name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="table_name"
          required
          autoFocus
        />
      </label>

      <div className="col-builder">
        <div className="col-builder-header">
          <span>Columns</span>
        </div>
        <div className="col-builder-labels">
          <span>Name</span>
          <span>Type</span>
          <span>Nullable</span>
          <span>Default</span>
          <span />
        </div>
        {columns.map((col, i) => (
          <div className="col-builder-row" key={i}>
            <input
              className="col-name-input"
              value={col.name}
              onChange={(e) => updateCol(i, { name: e.target.value })}
              placeholder="column_name"
            />
            <div className="col-type-wrap">
              <input
                list={`types-${i}`}
                className="col-type-input"
                value={col.dataType}
                onChange={(e) => updateCol(i, { dataType: e.target.value })}
                placeholder="text"
              />
              <datalist id={`types-${i}`}>
                {COMMON_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="col-nullable-wrap">
              <input
                type="checkbox"
                checked={col.nullable}
                onChange={(e) => updateCol(i, { nullable: e.target.checked })}
              />
            </div>
            <input
              className="col-default-input"
              value={col.default}
              onChange={(e) => updateCol(i, { default: e.target.value })}
              placeholder="—"
            />
            <button
              type="button"
              className="col-remove-btn"
              onClick={() => removeCol(i)}
              disabled={columns.length === 1}
              title="Remove column"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button type="button" className="add-col-btn" onClick={addCol}>
          + Add column
        </button>
      </div>

      <div className="create-footer">
        <button type="button" className="compact-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="compact-btn primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create Table'}
        </button>
      </div>
    </form>
  )
}

// ── Sequence form ─────────────────────────────────────────────────────────────

function SequenceForm({ connectionID, schema, onClose, onCreated }: Omit<Props, 'kind'>) {
  const [form, setForm] = useState<CreateSequenceRequest>({
    schema,
    name: '',
    incrementBy: 1,
    startValue: 1,
    minValue: 1,
    maxValue: 9223372036854775807,
    isCycled: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    DatabaseService.CreateSequence(connectionID, form)
      .then(() => onCreated(`Created sequence ${schema}.${form.name}`))
      .catch((err) => { onCreated(String(err)); setIsSubmitting(false) })
  }

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <label className="create-field">
        <span>Sequence name</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="sequence_name" required autoFocus />
      </label>
      <div className="create-row">
        <label className="create-field">
          <span>Increment by</span>
          <input type="number" value={form.incrementBy} onChange={(e) => setForm({ ...form, incrementBy: +e.target.value || 1 })} />
        </label>
        <label className="create-field">
          <span>Start value</span>
          <input type="number" value={form.startValue} onChange={(e) => setForm({ ...form, startValue: +e.target.value || 1 })} />
        </label>
      </div>
      <div className="create-row">
        <label className="create-field">
          <span>Min value</span>
          <input type="number" value={form.minValue} onChange={(e) => setForm({ ...form, minValue: +e.target.value || 1 })} />
        </label>
        <label className="create-field">
          <span>Max value</span>
          <input type="number" value={form.maxValue} onChange={(e) => setForm({ ...form, maxValue: +e.target.value })} />
        </label>
      </div>
      <label className="create-checkbox">
        <input type="checkbox" checked={form.isCycled} onChange={(e) => setForm({ ...form, isCycled: e.target.checked })} />
        <span>Cycle when limit is reached</span>
      </label>
      <div className="create-footer">
        <button type="button" className="compact-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="compact-btn primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create Sequence'}
        </button>
      </div>
    </form>
  )
}

// ── Index form ────────────────────────────────────────────────────────────────

function IndexForm({ connectionID, schema, onClose, onCreated }: Omit<Props, 'kind'>) {
  const [form, setForm] = useState<CreateIndexRequest>({
    schema,
    table: '',
    name: '',
    columns: '',
    isUnique: false,
    method: 'btree',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    DatabaseService.CreateIndex(connectionID, form)
      .then(() => onCreated(`Created index ${form.name}`))
      .catch((err) => { onCreated(String(err)); setIsSubmitting(false) })
  }

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <label className="create-field">
        <span>Table</span>
        <input value={form.table} onChange={(e) => setForm({ ...form, table: e.target.value })} placeholder="table_name" required autoFocus />
      </label>
      <label className="create-field">
        <span>Index name</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="idx_table_column" required />
      </label>
      <label className="create-field">
        <span>Columns (comma-separated)</span>
        <input value={form.columns} onChange={(e) => setForm({ ...form, columns: e.target.value })} placeholder="col1, col2" required />
      </label>
      <div className="create-row">
        <label className="create-field">
          <span>Method</span>
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            <option value="btree">btree</option>
            <option value="hash">hash</option>
            <option value="gin">gin</option>
            <option value="gist">gist</option>
          </select>
        </label>
      </div>
      <label className="create-checkbox">
        <input type="checkbox" checked={form.isUnique} onChange={(e) => setForm({ ...form, isUnique: e.target.checked })} />
        <span>Unique index</span>
      </label>
      <div className="create-footer">
        <button type="button" className="compact-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="compact-btn primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create Index'}
        </button>
      </div>
    </form>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────

const TITLES: Record<Props['kind'], string> = {
  table: 'Create Table',
  sequence: 'Create Sequence',
  index: 'Create Index',
}

export function CreateObjectModal({ connectionID, schema, kind, onClose, onCreated }: Props) {
  return (
    <Modal title={TITLES[kind]} onClose={onClose}>
      <div className="modal-body">
        {kind === 'table' && (
          <TableForm connectionID={connectionID} schema={schema} onClose={onClose} onCreated={onCreated} />
        )}
        {kind === 'sequence' && (
          <SequenceForm connectionID={connectionID} schema={schema} onClose={onClose} onCreated={onCreated} />
        )}
        {kind === 'index' && (
          <IndexForm connectionID={connectionID} schema={schema} onClose={onClose} onCreated={onCreated} />
        )}
      </div>
    </Modal>
  )
}
