import { useState } from 'react'
import { useResizeDrag } from '../workspace/useResizeDrag'
import { type QueryResult, type SchemaObject } from '../../bindings/basalt/db'
import { type RowRecord, type DirtyCells, type LogEntry } from '../types'
import { ResultGrid } from './ResultGrid'
import { PlanView } from './PlanView'
import { SqlEditor } from './SqlEditor'
import { WorksheetLog } from './WorksheetLog'

type ResultTab = 'data' | 'plan'

interface Props {
  sql: string
  result: QueryResult | null
  rows: RowRecord[]
  dirtyCells: DirtyCells
  log: LogEntry[]
  objects: SchemaObject[]
  connectionId?: string
  driver?: string
  isRunning: boolean
  isPlanLoading: boolean
  planLines: string[]
  onSqlChange: (sql: string) => void
  onCellChange: (rowIndex: number, column: string, value: string) => void
  onDiscard: () => void
  onClearLog: () => void
}

export function SqlWorksheet({
  sql, result, rows, dirtyCells, log, objects, connectionId, driver,
  isRunning, isPlanLoading, planLines,
  onSqlChange, onCellChange, onDiscard, onClearLog,
}: Props) {
  const [activeTab, setActiveTab] = useState<ResultTab>('data')
  const [editorHeight, startEditorDrag] = useResizeDrag(280, 80, 800)
  const [logHeight, startLogDrag] = useResizeDrag(120, 60, 400)
  const dirtyCount = Object.keys(dirtyCells).length

  return (
    <div className="sql-worksheet">
      <div className="editor-area" style={{ height: editorHeight }}>
        <SqlEditor value={sql} connectionId={connectionId} driver={driver} objects={objects} onChange={onSqlChange} />
      </div>

      <div className="resize-handle resize-handle--v" onMouseDown={e => startEditorDrag(e, 'y')} />

      <div className="results">
        <div className="results-toolbar">
          <div className="segmented">
            <button className={activeTab === 'data' ? 'active' : ''} onClick={() => setActiveTab('data')}>
              Data
            </button>
            <button className={activeTab === 'plan' ? 'active' : ''} onClick={() => setActiveTab('plan')}>
              Plan
            </button>
          </div>
          <div className="edit-actions">
            {dirtyCount > 0 && (
              <>
                <span className="dirty-indicator">{dirtyCount} unsaved</span>
                <button className="compact-btn" onClick={onDiscard}>Discard</button>
              </>
            )}
          </div>
        </div>

        {activeTab === 'data' && (
          <ResultGrid
            columns={result?.columns ?? []}
            rows={rows}
            emptyMessage={isRunning ? 'Running…' : 'Run a query to see results'}
          />
        )}

        {activeTab === 'plan' && (
          planLines.length > 0 ? (
            <PlanView lines={planLines} />
          ) : (
            <p className="empty-state centered">
              {isPlanLoading ? 'Loading plan…' : 'Run a query to see the plan'}
            </p>
          )
        )}
      </div>

      <div className="resize-handle resize-handle--v" onMouseDown={e => startLogDrag(e, 'y', true)} />
      <div style={{ height: logHeight, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <WorksheetLog log={log} onClear={onClearLog} />
      </div>
    </div>
  )
}
