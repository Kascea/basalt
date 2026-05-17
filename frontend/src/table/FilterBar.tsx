import { type KeyboardEvent } from 'react'

interface Props {
  expr: string
  draft: string
  hasError: boolean
  onChange: (draft: string) => void
  onCommit: (expr: string) => void
}

export function FilterBar({ expr, draft, hasError, onChange, onCommit }: Props) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onCommit(draft.trim())
    if (e.key === 'Escape') { onChange(expr); (e.target as HTMLInputElement).blur() }
  }

  const handleClear = () => {
    onChange('')
    onCommit('')
  }

  const isDirty = draft.trim() !== expr.trim()

  return (
    <div className={`filter-bar${!expr && !draft ? ' filter-bar-empty' : ''}${hasError ? ' filter-bar-error' : ''}`}>
      <span className="filter-clause-kw">WHERE</span>
      <input
        className="filter-where-input"
        value={draft}
        onChange={e => onChange(e.target.value)}
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
