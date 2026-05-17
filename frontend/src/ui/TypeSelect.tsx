import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { DatabaseService, type TypeGroup } from '../../bindings/basalt/db'

export function useColumnTypes(connectionID: string) {
  const [groups, setGroups] = useState<TypeGroup[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    DatabaseService.ListColumnTypes(connectionID)
      .then(r => { setGroups(r ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [connectionID])
  return { groups, loading }
}

export function TypeSelect({ value, onChange, groups, loading, dirty = false }: {
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
