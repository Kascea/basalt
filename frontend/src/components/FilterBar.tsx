interface Props {
  expr: string
  hasError: boolean
  onChange: (expr: string) => void
}

export function FilterBar({ expr, hasError, onChange }: Props) {
  return (
    <div className={`filter-bar${!expr ? ' filter-bar-empty' : ''}${hasError ? ' filter-bar-error' : ''}`}>
      <span className="filter-clause-kw">WHERE</span>
      <input
        className="filter-where-input"
        value={expr}
        onChange={e => onChange(e.target.value)}
        placeholder="lower(name) = 'cole'  AND  age > 25  OR  status != 'active'"
        spellCheck={false}
      />
      {expr && (
        <button className="filter-remove-btn" onClick={() => onChange('')} title="Clear filter">×</button>
      )}
    </div>
  )
}
