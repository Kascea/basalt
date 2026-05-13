import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Workspace } from './components/Workspace'
import { Modal } from './components/Modal'
import { ConnectForm } from './components/ConnectForm'
import { useDatabase } from './hooks/useDatabase'
import { useWorksheet } from './hooks/useWorksheet'
import { useTableTabs } from './hooks/useTableTabs'

function App() {
  const [statusMessage, setStatusMessage] = useState('Not connected')
  const [showConnectForm, setShowConnectForm] = useState(false)

  const db = useDatabase(setStatusMessage)
  const worksheet = useWorksheet(db.activeConnectionID, setStatusMessage)
  const tableTabs = useTableTabs(db.activeConnectionID, setStatusMessage)

  const activeFkError = tableTabs.activeTableState?.commitError ?? null

  const handleOpenFkTab = () => {
    if (!activeFkError) return
    tableTabs.openTableTabWithPrefill(
      tableTabs.activeTab.schema,
      activeFkError.referencedTable,
      { [activeFkError.column]: activeFkError.value },
    )
  }

  return (
    <main className="app-shell">
      <Sidebar
        connections={db.connections}
        activeConnectionID={db.activeConnectionID}
        objects={db.objects}
        expandedConnections={db.expandedConnections}
        expandedSchemas={db.expandedSchemas}
        filter={db.filter}
        onNewConnection={() => setShowConnectForm(true)}
        onConnectionClick={db.toggleConnection}
        onSchemaToggle={db.toggleSchema}
        onFilterChange={db.setFilter}
        onRefresh={db.refreshObjects}
        onTableOpen={(schema, table) => tableTabs.openTableTab(schema, table, false)}
        onTableOpenNewTab={(schema, table) => tableTabs.openTableTab(schema, table, true)}
        onGroupOpen={tableTabs.openGroupTab}
      />

      <Workspace
        tabs={tableTabs.tabs}
        activeTabId={tableTabs.activeTabId}
        onTabClick={tableTabs.setActiveTab}
        onTabClose={tableTabs.closeTab}
        activeConnection={db.activeConnection}
        isRunning={worksheet.isRunning}
        sql={worksheet.sql}
        queryResult={worksheet.result}
        queryRows={worksheet.rows}
        queryDirty={worksheet.dirtyCells}
        objects={db.objects}
        onSqlChange={worksheet.setSql}
        onRunQuery={worksheet.runQuery}
        onQueryCellChange={worksheet.updateCell}
        onQueryDiscard={worksheet.discardEdits}
        activeTableState={tableTabs.activeTableState}
        activeTab={tableTabs.activeTab}
        onTableCellChange={tableTabs.updateCell}
        onTableNewCellChange={tableTabs.updateNewCell}
        onTableAddRow={tableTabs.addNewRow}
        onTableRemoveNewRow={tableTabs.removeNewRow}
        onTableDeleteRow={tableTabs.markForDelete}
        onTableRefresh={tableTabs.refreshActiveTable}
        onTableFilterChange={tableTabs.setFilterExpr}
        onTableDiscard={tableTabs.discardEdits}
        onTableCommit={tableTabs.commitEdits}
        activeFkError={activeFkError}
        onOpenFkTab={handleOpenFkTab}
        statusMessage={statusMessage}
        onStatus={setStatusMessage}
      />

      {showConnectForm && (
        <Modal title="New Connection" onClose={() => setShowConnectForm(false)}>
          <ConnectForm
            isConnecting={db.isConnecting}
            onConnect={(name, driver, connectionString) =>
              db.connect(name, driver, connectionString, () => setShowConnectForm(false))
            }
          />
        </Modal>
      )}
    </main>
  )
}

export default App
