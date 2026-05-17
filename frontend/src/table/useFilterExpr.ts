import { useState, useEffect } from 'react'

export function useFilterExpr(committedExpr: string, onCommit: (expr: string) => void) {
  const [draft, setDraft] = useState(committedExpr)

  useEffect(() => { setDraft(committedExpr) }, [committedExpr])

  const addFilter = (col: string) => {
    const snippet = `${col} = ''`
    setDraft(prev => prev.trim() ? `${prev.trim()} AND ${snippet}` : snippet)
  }

  return { draft, setDraft, addFilter, commit: onCommit }
}
