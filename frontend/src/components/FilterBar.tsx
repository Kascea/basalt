import { useState, useEffect, type KeyboardEvent } from 'react'

interface Props {
  expr: string
  hasError: boolean
  onChange: (expr: string) => void
}

export function FilterBar({ expr, hasError, onChange }: Props) {
  const [draft, setDraft] = useState(expr)

  // Sync draft when the committed filter is cleared externally
  useEffect(() => {
    if (expr === '') setDraft('')
  }, [expr])

  const commit = (value: string) => {
    onChange(value.trim())
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit(draft)
    if (e.key === 'Escape') { setDraft(expr); (e.target as HTMLInputElement).blur() }
  }

  const handleClear = () => {
    setDraft('')
    commit('')
  }

  const isDirty = draft.trim() !== expr.trim()

  return (
    <div className={`filter-bar${!expr && !draft ? ' filter-bar-empty' : ''}${hasError ? ' filter-bar-error' : ''}`}>
      <span className="filter-clause-kw">WHERE</span>
      <input
        className="filter-where-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="name LIKE '%value%'  AND  col > 100  (press Enter to apply)"
        spellCheck={false}
      />
      {isDirty && (
        <span className="filter-enter-hint" title="Press Enter to apply">↵</span>
      )}
      {(draft || expr) && (
        <button className="filter-remove-btn" onClick={handleClear} title="Clear filter">×</button>
      )}
    </div>
  )
}
