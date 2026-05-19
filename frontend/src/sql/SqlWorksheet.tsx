import { useState } from 'react'
import { useResizeDrag } from '../workspace/useResizeDrag'
import { type QueryResult, type SchemaObject } from '../../bindings/basalt/db'
import { type RowRecord, type DirtyCells, type LogEntry } from '../types'
import { DataGrid } from '../table/DataGrid'
import { SqlEditor } from './SqlEditor'
import { WorksheetLog } from './WorksheetLog'

type ResultTab = 'data' | 'structure' | 'plan'

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
  onSqlChange: (sql: string) => void
  onCellChange: (rowIndex: number, column: string, value: string) => void
  onDiscard: () => void
  onClearLog: () => void
}

export function SqlWorksheet({
  sql, result, rows, dirtyCells, log, objects, connectionId, driver, isRunning,
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
            <button className={activeTab === 'structure' ? 'active' : ''} onClick={() => setActiveTab('structure')}>
              Structure
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
          <DataGrid
            columns={result?.columns ?? []}
            columnTypes={result?.columnTypes ?? []}
            rows={rows}
            newRows={[]}
            dirtyCells={dirtyCells}
            pendingDeletes={new Set()}
            onCellChange={onCellChange}
            onNewCellChange={() => {}}
            onDeleteRow={() => {}}
            onRemoveNewRow={() => {}}
            emptyMessage={isRunning ? 'Running…' : 'Run a query to see results'}
          />
        )}

        {activeTab === 'structure' && (
          <div className="structure-view">
            {objects.map((obj) => (
              <div className="structure-row" key={`${obj.schema}.${obj.name}`}>
                <strong>{obj.schema}.{obj.name}</strong>
                <span>{obj.type}</span>
                <span>{obj.modified}</span>
              </div>
            ))}
            {objects.length === 0 && (
              <p className="empty-state centered">Connect to a database to browse objects</p>
            )}
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="plan-view">
            {result?.plan.map((step) => (
              <div className="plan-row" key={step.id}>
                <span>{step.id}</span>
                <strong>{step.operation}</strong>
                <span>{step.object || 'result'}</span>
                <span>cost {step.cost}</span>
                <span>{step.rows} rows</span>
              </div>
            ))}
            {!result && <p className="empty-state centered">Run a query to see the explain plan</p>}
          </div>
        )}
      </div>

      <div className="resize-handle resize-handle--v" onMouseDown={e => startLogDrag(e, 'y', true)} />
      <div style={{ height: logHeight, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <WorksheetLog log={log} onClear={onClearLog} />
      </div>
    </div>
  )
}
