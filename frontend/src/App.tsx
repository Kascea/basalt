import { useState, useEffect, useRef } from 'react'
import { Events } from '@wailsio/runtime'
import { Sidebar } from './components/Sidebar'
import { Workspace } from './components/Workspace'
import { SettingsView } from './components/SettingsView'
import { Modal } from './components/Modal'
import { ConfirmModal } from './components/ConfirmModal'
import { ConnectForm } from './components/ConnectForm'
import { useDatabase } from './hooks/useDatabase'
import { useWorksheet } from './hooks/useWorksheet'
import { useTableTabs } from './hooks/useTableTabs'
import { useSettings } from './hooks/useSettings'
import type { AppSettings, SavedConnection } from '../bindings/basalt/db'

function App() {
  const [statusMessage, setStatusMessage] = useState('Not connected')
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ count: number } | null>(null)

  const db = useDatabase(setStatusMessage)
  const { settings, saveSettings } = useSettings()
  const worksheet = useWorksheet(db.activeConnectionID, setStatusMessage)
  const tableTabs = useTableTabs(db.activeConnectionID, setStatusMessage)

  // Local draft of settings (applied immediately, saved on "Save Changes")
  const [settingsDraft, setSettingsDraft] = useState<AppSettings | null>(null)
  const effectiveSettings = settingsDraft ?? settings

  const activeFkError = tableTabs.activeTableState?.commitError ?? null

  const handleOpenFkTab = () => {
    if (!activeFkError) return
    tableTabs.openTableTabWithPrefill(
      tableTabs.activeTab.schema,
      activeFkError.referencedTable,
      { [activeFkError.column]: activeFkError.value },
    )
  }

  const handleEditSaved = (conn: SavedConnection) => {
    setEditingConnection(conn)
  }

  const handleCloseModal = () => {
    setShowConnectForm(false)
    setEditingConnection(null)
  }

  const handleSettingsChange = (patch: Partial<AppSettings>) => {
    const base = settingsDraft ?? settings
    if (base) setSettingsDraft({ ...base, ...patch })
  }

  const handleSettingsSave = (s: AppSettings) => {
    saveSettings(s).then(() => setSettingsDraft(null))
  }

  // Keep a ref to the latest callbacks so the menu event listeners (registered
  // once) always call the current versions without needing re-registration.
  const menuRef = useRef({
    openNewConnection: () => setShowConnectForm(true),
    openSettings: () => setShowSettings(true),
    refreshSchema: () => db.refreshObjects(),
    runQuery: () => worksheet.runQuery(),
    connectSaved: (id: string) => db.reconnect(id),
    closeConnection: () => { if (db.activeConnectionID) db.disconnect(db.activeConnectionID) },
  })
  menuRef.current = {
    openNewConnection: () => setShowConnectForm(true),
    openSettings: () => setShowSettings(true),
    refreshSchema: () => db.refreshObjects(),
    runQuery: () => worksheet.runQuery(),
    connectSaved: (id: string) => db.reconnect(id),
    closeConnection: () => { if (db.activeConnectionID) db.disconnect(db.activeConnectionID) },
  }

  useEffect(() => {
    const offs = [
      Events.On('menu:new-connection', () => menuRef.current.openNewConnection()),
      Events.On('menu:settings', () => menuRef.current.openSettings()),
      Events.On('menu:refresh-schema', () => menuRef.current.refreshSchema()),
      Events.On('menu:run-query', () => menuRef.current.runQuery()),
      Events.On('menu:connect-saved', (e) => menuRef.current.connectSaved(e.data as string)),
      Events.On('menu:close-connection', () => menuRef.current.closeConnection()),
    ]
    return () => offs.forEach((off) => off())
  }, [])

  return (
    <main
      className="app-shell"
      style={{
        '--cell-height': effectiveSettings?.rowDensity === 'compact' ? '26px'
          : effectiveSettings?.rowDensity === 'comfortable' ? '42px' : '34px',
        '--cell-font-size': effectiveSettings?.fontSize ? `${effectiveSettings.fontSize}px` : '13px',
      } as React.CSSProperties}
    >
      <Sidebar
        savedConnections={db.savedConnections}
        connections={db.connections}
        activeConnectionID={db.activeConnectionID}
        objects={db.objects}
        expandedConnections={db.expandedConnections}
        expandedSchemas={db.expandedSchemas}
        filter={db.filter}
        isConnecting={db.isConnecting}
        showSettings={showSettings}
        onNewConnection={() => setShowConnectForm(true)}
        onConnectionClick={db.toggleConnection}
        onReconnect={db.reconnect}
        onDisconnect={db.disconnect}
        onDeleteSaved={db.deleteSaved}
        onEditSaved={handleEditSaved}
        onSchemaToggle={db.toggleSchema}
        onFilterChange={db.setFilter}
        onRefresh={db.refreshObjects}
        onTableOpen={(schema, table) => { tableTabs.openTableTab(schema, table, false); setShowSettings(false) }}
        onTableOpenNewTab={(schema, table) => { tableTabs.openTableTab(schema, table, true); setShowSettings(false) }}
        onGroupOpen={(schema, kind) => { tableTabs.openGroupTab(schema, kind); setShowSettings(false) }}
        onSettingsToggle={() => setShowSettings((v) => !v)}
      />

      {showSettings && effectiveSettings ? (
        <SettingsView
          settings={effectiveSettings}
          onClose={() => setShowSettings(false)}
          onSettingsChange={handleSettingsChange}
          onSettingsSave={handleSettingsSave}
        />
      ) : (
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
          onTableCommit={() => {
            const state = tableTabs.activeTableState
            if (effectiveSettings?.confirmDeleteRows && state && state.pendingDeletes.size > 0) {
              setConfirmDelete({ count: state.pendingDeletes.size })
              return
            }
            tableTabs.commitEdits()
          }}
          onTableEditSchema={tableTabs.openSchemaTab}
          activeFkError={activeFkError}
          onOpenFkTab={handleOpenFkTab}
          statusMessage={statusMessage}
          onStatus={setStatusMessage}
          nullText={effectiveSettings?.nullText ?? 'NULL'}
        />
      )}

      {showConnectForm && (
        <Modal title="New Connection" onClose={handleCloseModal}>
          <ConnectForm
            isConnecting={db.isConnecting === 'new'}
            onConnect={(name, driver, connectionString) =>
              db.connect(name, driver, connectionString, handleCloseModal)
            }
          />
        </Modal>
      )}

      {editingConnection && (
        <Modal title="Edit Connection" onClose={handleCloseModal}>
          <ConnectForm
            isConnecting={db.isConnecting === editingConnection.id}
            initialValues={editingConnection}
            onConnect={(name, driver, connectionString) =>
              db.connect(name, driver, connectionString, handleCloseModal)
            }
            onSaveOnly={(conn) => {
              db.updateSaved(conn)
              handleCloseModal()
            }}
          />
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Delete ${confirmDelete.count} row${confirmDelete.count !== 1 ? 's' : ''}? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => { setConfirmDelete(null); tableTabs.commitEdits() }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </main>
  )
}

export default App
