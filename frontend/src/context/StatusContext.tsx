import { createContext, useContext, useMemo } from 'react'
import type { FKError, LogEntry } from '../types'

export interface StatusSession {
  log: LogEntry[]
  set: (msg: string) => void
  activeFkError: FKError | null
  openFkTab: () => void
}

const StatusContext = createContext<StatusSession | null>(null)

export function StatusProvider({ value, children }: { value: StatusSession; children: React.ReactNode }) {
  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>
}

export function useStatusSession(): StatusSession {
  const ctx = useContext(StatusContext)
  if (!ctx) throw new Error('useStatusSession must be used inside StatusProvider')
  return ctx
}

export function useStatusSessionValue(raw: StatusSession): StatusSession {
  return useMemo(() => raw, [raw.log, raw.activeFkError]) // eslint-disable-line react-hooks/exhaustive-deps
}
