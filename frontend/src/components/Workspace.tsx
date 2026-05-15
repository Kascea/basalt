import { Window } from '@wailsio/runtime'
import { SqlWorksheet } from './SqlWorksheet'
import { TableView } from './TableView'
import { SequenceView } from './SequenceView'
import { IndexView } from './IndexView'
import { ForeignKeyView } from './ForeignKeyView'
import { SchemaView } from './SchemaView'
import { StatusBar } from './StatusBar'
import { useWorkspaceSession } from '../context/WorkspaceContext'
import type { Tab } from '../types'

function tabLabel(tab: Tab): string {
  switch (tab.kind) {
    case 'worksheet': return 'Worksheet'
    case 'table': return `${tab.schema}.${tab.table}`
    case 'sequences': return `${tab.schema} · Sequences`
    case 'indexes': return `${tab.schema} · Indexes`
    case 'foreignkeys': return `${tab.schema} · Foreign Keys`
    case 'schema': return `${tab.schema}.${tab.table} · Schema`
  }
}

interface Props {
  onCommit: () => void
}

export function Workspace({ onCommit }: Props) {
  const session = useWorkspaceSession()
  const {
    tabs, activeTabId, activeTab, activeTableState,
    setActiveTab, closeTab,
    activeConnection, objects,
    isRunning, sql, queryResult, queryRows, queryDirty,
    updateCell, updateNewCell, addNewRow, removeNewRow, markForDelete,
    discardEdits, refreshActiveTable, setFilterExpr,
    setSql, runQuery, updateQueryCell, discardQueryEdits,
    openSchemaTab,
    statusMessage, activeFkError, openFkTab, setStatus,
    nullText,
  } = session

  const connContext = activeConnection
    ? `${activeConnection.user || 'user'}@${activeConnection.host || 'host'}/${activeConnection.database || 'db'}`
    : 'Not connected'

  const activeDurationMs = activeTab.kind === 'worksheet'
    ? queryResult?.durationMs
    : activeTableState?.result?.durationMs

  return (
    <section className="workspace">
      <header className="topbar" onDoubleClick={() => Window.ToggleMaximise()}>
        <div className="topbar-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`ws-tab${tab.id === activeTabId ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tabLabel(tab)}
              {tab.kind !== 'worksheet' && (
                <span
                  className="tab-close"
                  role="button"
                  aria-label="Close tab"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
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
            <button className="run-btn" onClick={runQuery} disabled={isRunning}>
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
            nullText={nullText}
            onSqlChange={setSql}
            onCellChange={updateQueryCell}
            onDiscard={discardQueryEdits}
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
            isRefreshing={activeTableState.isRefreshing}
            isCommitting={activeTableState.isCommitting}
            nullText={nullText}
            onCellChange={updateCell}
            onNewCellChange={updateNewCell}
            onAddRow={addNewRow}
            onRemoveNewRow={removeNewRow}
            onDeleteRow={markForDelete}
            onRefresh={refreshActiveTable}
            filterExpr={activeTableState.filterExpr}
            onFilterChange={setFilterExpr}
            onDiscard={discardEdits}
            onCommit={onCommit}
            onEditSchema={() => openSchemaTab(activeTab.schema, activeTab.table!)}
          />
        )}

        {activeTab.kind === 'sequences' && (
          <SequenceView
            connectionID={activeTab.connectionID}
            schema={activeTab.schema}
            onStatus={setStatus}
          />
        )}

        {activeTab.kind === 'indexes' && (
          <IndexView
            connectionID={activeTab.connectionID}
            schema={activeTab.schema}
            onStatus={setStatus}
          />
        )}

        {activeTab.kind === 'foreignkeys' && (
          <ForeignKeyView
            connectionID={activeTab.connectionID}
            schema={activeTab.schema}
            onStatus={setStatus}
          />
        )}

        {activeTab.kind === 'schema' && activeTab.table && (
          <SchemaView
            connectionID={activeTab.connectionID}
            schema={activeTab.schema}
            table={activeTab.table}
            onTableRefresh={refreshActiveTable}
          />
        )}
      </div>

      <StatusBar
        message={statusMessage}
        durationMs={activeDurationMs}
        fkError={activeFkError}
        onOpenFkTab={openFkTab}
      />
    </section>
  )
}
