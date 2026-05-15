import { useState } from 'react'
import { type QueryResult, type SchemaObject } from '../../bindings/basalt/db'
import { type RowRecord, type DirtyCells } from '../types'
import { DataGrid } from './DataGrid'

type ResultTab = 'data' | 'structure' | 'plan'

interface Props {
  sql: string
  result: QueryResult | null
  rows: RowRecord[]
  dirtyCells: DirtyCells
  objects: SchemaObject[]
  isRunning: boolean
  nullText?: string
  onSqlChange: (sql: string) => void
  onCellChange: (rowIndex: number, column: string, value: string) => void
  onDiscard: () => void
}

export function SqlWorksheet({
  sql, result, rows, dirtyCells, objects, isRunning,
  nullText = 'NULL',
  onSqlChange, onCellChange, onDiscard,
}: Props) {
  const [activeTab, setActiveTab] = useState<ResultTab>('data')
  const dirtyCount = Object.keys(dirtyCells).length

  return (
    <div className="sql-worksheet">
      <div className="editor-area">
        <textarea value={sql} onChange={(e) => onSqlChange(e.target.value)} spellCheck={false} />
      </div>

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
            nullText={nullText}
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
    </div>
  )
}
