// WorkspaceSession is now composed of four focused contexts, each memoized
// independently so changes to one don't force re-renders across unrelated consumers.
//
// Consumers that need everything (e.g. Workspace.tsx) can import WorkspaceSession
// from here; components that only need one slice can import that context directly.

import { createContext, useContext } from 'react'
import type { Connection, SchemaObject } from '../../bindings/basalt/db'
import type { LogEntry } from '../types'
import type { TabSession } from '../tabs/TabContext'
import type { TableEditorSession } from '../table/TableEditorContext'
import type { WorksheetSession } from '../sql/WorksheetContext'
import type { StatusSession } from './StatusContext'

export type { TabSession } from '../tabs/TabContext'
export type { TableEditorSession } from '../table/TableEditorContext'
export type { WorksheetSession } from '../sql/WorksheetContext'
export type { StatusSession } from './StatusContext'

export interface WorkspaceSession {
  connection: {
    connections: Connection[]
    active: Connection | undefined
    objects: SchemaObject[]
  }
  tabs: TabSession
  tableEditor: TableEditorSession
  worksheet: WorksheetSession
  status: StatusSession
  tabStatus: { log: LogEntry[]; set: (msg: string) => void }
  defaultRowLimit: number
}

const WorkspaceContext = createContext<WorkspaceSession | null>(null)

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceSession
  children: React.ReactNode
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceSession(): WorkspaceSession {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspaceSession must be used inside WorkspaceProvider')
  return ctx
}
