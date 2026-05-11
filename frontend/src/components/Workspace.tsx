import { type Connection, type QueryResult, type SchemaObject } from '../../bindings/basalt'
import { type ObjectDetail, type RowRecord, type DirtyCells } from '../types'
import { SqlWorksheet } from './SqlWorksheet'
import { TableView } from './TableView'
import { SequenceView } from './SequenceView'
import { IndexView } from './IndexView'
import { ForeignKeyView } from './ForeignKeyView'
import { StatusBar } from './StatusBar'

type ActiveView = 'worksheet' | 'detail'

interface Props {
  activeView: ActiveView
  activeDetail: ObjectDetail | null
  activeConnection: Connection | undefined
  isRunning: boolean
  isLoadingTable: boolean
  isCommitting: boolean
  sql: string
  queryResult: QueryResult | null
  queryRows: RowRecord[]
  queryDirty: DirtyCells
  objects: SchemaObject[]
  tableResult: QueryResult | null
  tableRows: RowRecord[]
  tableDirty: DirtyCells
  statusMessage: string
  onSqlChange: (sql: string) => void
  onRunQuery: () => void
  onQueryCellChange: (rowIndex: number, col: string, value: string) => void
  onQueryDiscard: () => void
  onTableCellChange: (rowIndex: number, col: string, value: string) => void
  onTableRefresh: () => void
  onTableDiscard: () => void
  onTableCommit: () => void
  onViewChange: (view: ActiveView) => void
  onDetailClose: () => void
  onStatus: (msg: string) => void
}

function detailTabLabel(detail: ObjectDetail): string {
  switch (detail.kind) {
    case 'table': return detail.table ?? detail.schema
    case 'sequences': return `${detail.schema} · Sequences`
    case 'indexes': return `${detail.schema} · Indexes`
    case 'foreignkeys': return `${detail.schema} · Foreign Keys`
  }
}

export function Workspace({
  activeView, activeDetail, activeConnection, isRunning, isLoadingTable, isCommitting,
  sql, queryResult, queryRows, queryDirty, objects,
  tableResult, tableRows, tableDirty,
  statusMessage,
  onSqlChange, onRunQuery, onQueryCellChange, onQueryDiscard,
  onTableCellChange, onTableRefresh, onTableDiscard, onTableCommit,
  onViewChange, onDetailClose, onStatus,
}: Props) {
  const connContext = activeConnection
    ? `${activeConnection.user || 'user'}@${activeConnection.host || 'host'}/${activeConnection.database || 'db'}`
    : 'Not connected'

  const activeDurationMs = activeView === 'worksheet'
    ? queryResult?.durationMs
    : tableResult?.durationMs

  return (
    <section className="workspace">
      <header className="topbar">
        <div className="topbar-tabs">
          <button
            className={`ws-tab${activeView === 'worksheet' ? ' active' : ''}`}
            onClick={() => onViewChange('worksheet')}
          >
            Worksheet
          </button>
          {activeDetail && (
            <button
              className={`ws-tab${activeView === 'detail' ? ' active' : ''}`}
              onClick={() => onViewChange('detail')}
            >
              {detailTabLabel(activeDetail)}
              <span
                className="tab-close"
                role="button"
                aria-label="Close tab"
                onClick={(e) => { e.stopPropagation(); onDetailClose() }}
              >
                ✕
              </span>
            </button>
          )}
        </div>

        <div className="topbar-context">{connContext}</div>

        <div className="topbar-actions">
          {activeView === 'worksheet' && (
            <button className="run-btn" onClick={onRunQuery} disabled={isRunning}>
              ▶ {isRunning ? 'Running…' : 'Run'}
            </button>
          )}
        </div>
      </header>

      <div className="workspace-body">
        {activeView === 'worksheet' && (
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

        {activeView === 'detail' && activeDetail?.kind === 'table' && (
          <TableView
            target={{ connectionID: activeDetail.connectionID, schema: activeDetail.schema, table: activeDetail.table! }}
            result={tableResult}
            rows={tableRows}
            dirtyCells={tableDirty}
            isLoading={isLoadingTable}
            isCommitting={isCommitting}
            onCellChange={onTableCellChange}
            onRefresh={onTableRefresh}
            onDiscard={onTableDiscard}
            onCommit={onTableCommit}
          />
        )}

        {activeView === 'detail' && activeDetail?.kind === 'sequences' && (
          <SequenceView
            connectionID={activeDetail.connectionID}
            schema={activeDetail.schema}
            onStatus={onStatus}
          />
        )}

        {activeView === 'detail' && activeDetail?.kind === 'indexes' && (
          <IndexView
            connectionID={activeDetail.connectionID}
            schema={activeDetail.schema}
            onStatus={onStatus}
          />
        )}

        {activeView === 'detail' && activeDetail?.kind === 'foreignkeys' && (
          <ForeignKeyView
            connectionID={activeDetail.connectionID}
            schema={activeDetail.schema}
            onStatus={onStatus}
          />
        )}
      </div>

      <StatusBar message={statusMessage} durationMs={activeDurationMs} />
    </section>
  )
}
