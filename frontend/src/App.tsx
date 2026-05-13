import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Workspace } from './components/Workspace'
import { Modal } from './components/Modal'
import { ConnectForm } from './components/ConnectForm'
import { useDatabase } from './hooks/useDatabase'
import { useWorksheet } from './hooks/useWorksheet'
import { useTableView } from './hooks/useTableView'
import { type ObjectDetail } from './types'

type ActiveView = 'worksheet' | 'detail'

function App() {
  const [statusMessage, setStatusMessage] = useState('Not connected')
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [activeView, setActiveView] = useState<ActiveView>('worksheet')
  const [activeDetail, setActiveDetail] = useState<ObjectDetail | null>(null)

  const db = useDatabase(setStatusMessage)
  const worksheet = useWorksheet(db.activeConnectionID, setStatusMessage)
  const tableView = useTableView(db.activeConnectionID, setStatusMessage)

  const handleTableOpen = (schema: string, table: string) => {
    tableView.openTable(schema, table)
    setActiveDetail({ kind: 'table', connectionID: db.activeConnectionID, schema, table })
    setActiveView('detail')
  }

  const handleGroupOpen = (schema: string, kind: 'sequences' | 'indexes' | 'foreignkeys') => {
    setActiveDetail({ kind, connectionID: db.activeConnectionID, schema })
    setActiveView('detail')
  }

  const handleDetailClose = () => {
    tableView.closeTable()
    setActiveDetail(null)
    setActiveView('worksheet')
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
        onTableOpen={handleTableOpen}
        onGroupOpen={handleGroupOpen}
      />

      <Workspace
        activeView={activeView}
        activeDetail={activeDetail}
        activeConnection={db.activeConnection}
        isRunning={worksheet.isRunning}
        isLoadingTable={tableView.isLoading}
        isCommitting={tableView.isCommitting}
        sql={worksheet.sql}
        queryResult={worksheet.result}
        queryRows={worksheet.rows}
        queryDirty={worksheet.dirtyCells}
        objects={db.objects}
        tableResult={tableView.result}
        tableRows={tableView.rows}
        tableNewRows={tableView.newRows}
        tableDirty={tableView.dirtyCells}
        tablePendingDeletes={tableView.pendingDeletes}
        statusMessage={statusMessage}
        onSqlChange={worksheet.setSql}
        onRunQuery={worksheet.runQuery}
        onQueryCellChange={worksheet.updateCell}
        onQueryDiscard={worksheet.discardEdits}
        onTableCellChange={tableView.updateCell}
        onTableNewCellChange={tableView.updateNewCell}
        onTableAddRow={tableView.addNewRow}
        onTableRemoveNewRow={tableView.removeNewRow}
        onTableDeleteRow={tableView.markForDelete}
        onTableRefresh={tableView.refreshTable}
        onTableDiscard={tableView.discardEdits}
        onTableCommit={tableView.commitEdits}
        onViewChange={setActiveView}
        onDetailClose={handleDetailClose}
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
