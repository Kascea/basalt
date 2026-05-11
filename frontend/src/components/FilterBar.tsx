import { useId } from 'react'
import { type FilterClause, type FilterOperator } from '../types'

const OPS: { value: FilterOperator; label: string; needsValue: boolean }[] = [
  { value: 'contains',  label: 'contains',     needsValue: true  },
  { value: 'eq',        label: '=',             needsValue: true  },
  { value: 'neq',       label: '≠',             needsValue: true  },
  { value: 'starts',    label: 'starts with',   needsValue: true  },
  { value: 'ends',      label: 'ends with',     needsValue: true  },
  { value: 'gt',        label: '>',             needsValue: true  },
  { value: 'gte',       label: '≥',             needsValue: true  },
  { value: 'lt',        label: '<',             needsValue: true  },
  { value: 'lte',       label: '≤',             needsValue: true  },
  { value: 'null',      label: 'is null',       needsValue: false },
  { value: 'notnull',   label: 'is not null',   needsValue: false },
]

interface Props {
  columns: string[]
  filters: FilterClause[]
  onFiltersChange: (filters: FilterClause[]) => void
}

export function FilterBar({ columns, filters, onFiltersChange }: Props) {
  const uid = useId()

  const add = () => {
    onFiltersChange([...filters, {
      id: `${uid}-${Date.now()}`,
      column: columns[0] ?? '',
      op: 'contains',
      value: '',
    }])
  }

  const update = (id: string, patch: Partial<FilterClause>) => {
    onFiltersChange(filters.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  const remove = (id: string) => {
    onFiltersChange(filters.filter(f => f.id !== id))
  }

  return (
    <div className={`filter-bar${filters.length === 0 ? ' filter-bar-empty' : ''}`}>
      {filters.map((clause, i) => {
        const opDef = OPS.find(o => o.value === clause.op)
        return (
          <div key={clause.id} className="filter-clause">
            <span className="filter-clause-kw">{i === 0 ? 'WHERE' : 'AND'}</span>
            <select
              className="filter-select"
              value={clause.column}
              onChange={e => update(clause.id, { column: e.target.value })}
            >
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
            <select
              className="filter-select filter-op-select"
              value={clause.op}
              onChange={e => update(clause.id, { op: e.target.value as FilterOperator })}
            >
              {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {opDef?.needsValue && (
              <input
                className="filter-value-input"
                value={clause.value}
                onChange={e => update(clause.id, { value: e.target.value })}
                placeholder="value"
                autoFocus={i === filters.length - 1}
              />
            )}
            <button className="filter-remove-btn" onClick={() => remove(clause.id)} title="Remove filter">×</button>
          </div>
        )
      })}
      <div className="filter-clause-add">
        <button className="filter-add-btn" onClick={add}>+ Add filter</button>
      </div>
    </div>
  )
}
