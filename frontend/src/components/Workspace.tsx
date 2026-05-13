import { type Connection, type QueryResult, type SchemaObject } from '../../bindings/basalt'
import { type Tab, type TableState, type RowRecord, type DirtyCells, type FKError } from '../types'
import { SqlWorksheet } from './SqlWorksheet'
import { TableView } from './TableView'
import { SequenceView } from './SequenceView'
import { IndexView } from './IndexView'
import { ForeignKeyView } from './ForeignKeyView'
import { StatusBar } from './StatusBar'

interface Props {
  tabs: Tab[]
  activeTabId: string
  onTabClick: (id: string) => void
  onTabClose: (id: string) => void
  activeConnection: Connection | undefined
  isRunning: boolean
  sql: string
  queryResult: QueryResult | null
  queryRows: RowRecord[]
  queryDirty: DirtyCells
  objects: SchemaObject[]
  onSqlChange: (sql: string) => void
  onRunQuery: () => void
  onQueryCellChange: (rowIndex: number, col: string, value: string) => void
  onQueryDiscard: () => void
  activeTab: Tab
  activeTableState: TableState | null
  onTableCellChange: (rowIndex: number, col: string, value: string) => void
  onTableNewCellChange: (rowIndex: number, col: string, value: string) => void
  onTableAddRow: () => void
  onTableRemoveNewRow: (newRowIndex: number) => void
  onTableDeleteRow: (rowIndex: number) => void
  onTableRefresh: () => void
  onTableDiscard: () => void
  onTableCommit: () => void
  activeFkError: FKError | null
  onOpenFkTab: () => void
  statusMessage: string
  onStatus: (msg: string) => void
}

function tabLabel(tab: Tab): string {
  switch (tab.kind) {
    case 'worksheet': return 'Worksheet'
    case 'table': return `${tab.schema}.${tab.table}`
    case 'sequences': return `${tab.schema} · Sequences`
    case 'indexes': return `${tab.schema} · Indexes`
    case 'foreignkeys': return `${tab.schema} · Foreign Keys`
  }
}

export function Workspace({
  tabs, activeTabId, onTabClick, onTabClose,
  activeConnection, isRunning,
  sql, queryResult, queryRows, queryDirty, objects,
  onSqlChange, onRunQuery, onQueryCellChange, onQueryDiscard,
  activeTab, activeTableState,
  onTableCellChange, onTableNewCellChange, onTableAddRow,
  onTableRemoveNewRow, onTableDeleteRow,
  onTableRefresh, onTableDiscard, onTableCommit,
  activeFkError, onOpenFkTab,
  statusMessage, onStatus,
}: Props) {
  const connContext = activeConnection
    ? `${activeConnection.user || 'user'}@${activeConnection.host || 'host'}/${activeConnection.database || 'db'}`
    : 'Not connected'

  const activeDurationMs = activeTab.kind === 'worksheet'
    ? queryResult?.durationMs
    : activeTableState?.result?.durationMs

  return (
    <section className="workspace">
      <header className="topbar">
        <div className="topbar-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`ws-tab${tab.id === activeTabId ? ' active' : ''}`}
              onClick={() => onTabClick(tab.id)}
            >
              {tabLabel(tab)}
              {tab.kind !== 'worksheet' && (
                <span
                  className="tab-close"
                  role="button"
                  aria-label="Close tab"
                  onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
                >
                  ✕
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="topbar-context">{connContext}</div>

        <div className="topbar-actions">
          {activeTab.kind === 'worksheet' && (
            <button className="run-btn" onClick={onRunQuery} disabled={isRunning}>
              ▶ {isRunning ? 'Running…' : 'Run'}
            </button>
          )}
        </div>
      </header>

      <div className="workspace-body">
        {activeTab.kind === 'worksheet' && (
          <SqlWorksheet
            sql={sql}
            result={queryResult}
            rows={queryRows}
            dirtyCells={queryDirty}
            objects={objects}
            isRunning={isRunning}
            onSqlChange={onSqlChange}
            onCellChange={onQueryCellChange}
            onDiscard={onQueryDiscard}
          />
        )}

        {activeTab.kind === 'table' && activeTableState && (
          <TableView
            target={{ connectionID: activeTab.connectionID, schema: activeTab.schema, table: activeTab.table! }}
            result={activeTableState.result}
            rows={activeTableState.rows}
            newRows={activeTableState.newRows}
            dirtyCells={activeTableState.dirtyCells}
            pendingDeletes={activeTableState.pendingDeletes}
            isLoading={activeTableState.isLoading}
            isCommitting={activeTableState.isCommitting}
            onCellChange={onTableCellChange}
            onNewCellChange={onTableNewCellChange}
            onAddRow={onTableAddRow}
            onRemoveNewRow={onTableRemoveNewRow}
            onDeleteRow={onTableDeleteRow}
            onRefresh={onTableRefresh}
            onDiscard={onTableDiscard}
            onCommit={onTableCommit}
          />
        )}

        {activeTab.kind === 'sequences' && (
          <SequenceView
            connectionID={activeTab.connectionID}
            schema={activeTab.schema}
            onStatus={onStatus}
          />
        )}

        {activeTab.kind === 'indexes' && (
          <IndexView
            connectionID={activeTab.connectionID}
            schema={activeTab.schema}
            onStatus={onStatus}
          />
        )}

        {activeTab.kind === 'foreignkeys' && (
          <ForeignKeyView
            connectionID={activeTab.connectionID}
            schema={activeTab.schema}
            onStatus={onStatus}
          />
        )}
      </div>

      <StatusBar
        message={statusMessage}
        durationMs={activeDurationMs}
        fkError={activeFkError}
        onOpenFkTab={onOpenFkTab}
      />
    </section>
  )
}
