import { createContext, useContext, useMemo } from 'react'

export interface TableEditorSession {
  updateCell: (rowIndex: number, col: string, value: string) => void
  updateNewCell: (rowIndex: number, col: string, value: string) => void
  addRow: () => void
  removeRow: (i: number) => void
  markForDelete: (i: number) => void
  discard: () => void
  commit: () => void
  refresh: () => void
  setFilter: (expr: string) => void
}

const TableEditorContext = createContext<TableEditorSession | null>(null)

export function TableEditorProvider({ value, children }: { value: TableEditorSession; children: React.ReactNode }) {
  return <TableEditorContext.Provider value={value}>{children}</TableEditorContext.Provider>
}

export function useTableEditorSession(): TableEditorSession {
  const ctx = useContext(TableEditorContext)
  if (!ctx) throw new Error('useTableEditorSession must be used inside TableEditorProvider')
  return ctx
}

// Stable memoized value — the methods are always new function refs; we memo on identity.
export function useTableEditorSessionValue(raw: TableEditorSession): TableEditorSession {
  return useMemo(() => raw, Object.values(raw)) // eslint-disable-line react-hooks/exhaustive-deps
}
