import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { Events } from '@wailsio/runtime'
import { Sidebar } from './components/Sidebar'
import { Workspace } from './components/Workspace'
import { SettingsView } from './components/SettingsView'
import { Modal } from './components/Modal'
import { ConfirmModal } from './components/ConfirmModal'
import { ConnectForm } from './components/ConnectForm'
import { useDatabase } from './hooks/useDatabase'
import { useTableTabs } from './hooks/useTableTabs'
import { useSettings } from './hooks/useSettings'
import { WorkspaceProvider } from './context/WorkspaceContext'
import type { AppSettings, SavedConnection } from '../bindings/basalt/config'
import type { LogEntry } from './types'
import { useResizeDrag } from './hooks/useResizeDrag'

function App() {
  const [sidebarWidth, startSidebarDrag] = useResizeDrag(260, 160, 520)

  const [statusLog, setStatusLog] = useState<LogEntry[]>(() => [{
    id: 0,
    ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
    text: 'Ready — no active connection',
    isError: false,
  }])

  const logIdRef = useRef(1)
  const addStatus = useCallback((msg: string) => {
    const id = logIdRef.current++
    setStatusLog(prev => [...prev, {
      id,
      ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
      text: msg,
      isError: msg.startsWith('Error:'),
    }])
  }, [])
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ count: number } | null>(null)

  const db = useDatabase(addStatus)
  const { settings, saveSettings } = useSettings()
  const tableTabs = useTableTabs(db.activeConnectionID, addStatus)

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

  const handleTableCommit = () => {
    const state = tableTabs.activeTableState
    if (effectiveSettings?.confirmDeleteRows && state && state.pendingDeletes.size > 0) {
      setConfirmDelete({ count: state.pendingDeletes.size })
      return
    }
    tableTabs.commitEdits()
  }

  const handleEditSaved = (conn: SavedConnection) => setEditingConnection(conn)
  const handleCloseModal = () => { setShowConnectForm(false); setEditingConnection(null) }

  const handleSettingsChange = (patch: Partial<AppSettings>) => {
    const base = settingsDraft ?? settings
    if (base) setSettingsDraft({ ...base, ...patch })
  }

  const handleSettingsSave = (s: AppSettings) => {
    saveSettings(s).then(() => setSettingsDraft(null))
  }

  const menuRef = useRef({
    openNewConnection: () => setShowConnectForm(true),
    openSettings: () => setShowSettings(true),
    refreshSchema: () => db.refreshObjects(),
    runQuery: () => tableTabs.runQuery(),
    connectSaved: (id: string) => db.reconnect(id),
    closeConnection: () => { if (db.activeConnectionID) db.disconnect(db.activeConnectionID) },
  })
  menuRef.current = {
    openNewConnection: () => setShowConnectForm(true),
    openSettings: () => setShowSettings(true),
    refreshSchema: () => db.refreshObjects(),
    runQuery: () => tableTabs.runQuery(),
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

  const activeWS = tableTabs.activeWorksheetState

  const session = {
    connection: {
      active: db.activeConnection,
      objects: db.objects,
    },

    tabs: {
      list: tableTabs.tabs,
      activeId: tableTabs.activeTabId,
      active: tableTabs.activeTab,
      activeTableState: tableTabs.activeTableState,
      activeWorksheetState: tableTabs.activeWorksheetState,
      setActive: tableTabs.setActiveTab,
      close: tableTabs.closeTab,
      togglePin: tableTabs.togglePinTab,
      rename: tableTabs.renameTab,
      openTable: tableTabs.openTableTab,
      openTableWithPrefill: tableTabs.openTableTabWithPrefill,
      openSchema: tableTabs.openSchemaTab,
      openGroup: tableTabs.openGroupTab,
      openWorksheet: tableTabs.openWorksheetTab,
    },

    tableEditor: {
      updateCell: tableTabs.updateCell,
      updateNewCell: tableTabs.updateNewCell,
      addRow: tableTabs.addNewRow,
      removeRow: tableTabs.removeNewRow,
      markForDelete: tableTabs.markForDelete,
      discard: tableTabs.discardEdits,
      commit: tableTabs.commitEdits,
      refresh: tableTabs.refreshActiveTable,
      setFilter: tableTabs.setFilterExpr,
    },

    worksheet: {
      isRunning: activeWS?.isRunning ?? false,
      result: activeWS?.result ?? null,
      rows: activeWS?.rows ?? [],
      dirtyCells: activeWS?.dirtyCells ?? {},
      sql: activeWS?.sql ?? '',
      setSql: tableTabs.setSql,
      run: tableTabs.runQuery,
      updateCell: tableTabs.updateQueryCell,
      discard: tableTabs.discardQueryEdits,
    },

    status: {
      log: statusLog,
      set: addStatus,
      activeFkError,
      openFkTab: handleOpenFkTab,
    },

    nullText: effectiveSettings?.nullText ?? 'NULL',
  }

  return (
    <main
      className="app-shell"
      style={{
        '--cell-height': effectiveSettings?.rowDensity === 'compact' ? '26px'
          : effectiveSettings?.rowDensity === 'comfortable' ? '42px' : '34px',
        '--cell-font-size': effectiveSettings?.fontSize ? `${effectiveSettings.fontSize}px` : '13px',
        '--sidebar-width': `${sidebarWidth}px`,
      } as CSSProperties}
    >
      <div className="sidebar-wrapper">
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
          onTableOpen={(schema, table) => { tableTabs.openTableTab(schema, table); setShowSettings(false) }}
          onTableOpenNewTab={(schema, table) => { tableTabs.openTableTab(schema, table); setShowSettings(false) }}
          onTableOpenSchema={(schema, table) => { tableTabs.openSchemaTab(schema, table); setShowSettings(false) }}
          onGroupOpen={(schema, kind) => { tableTabs.openGroupTab(schema, kind); setShowSettings(false) }}
          onSettingsToggle={() => setShowSettings((v) => !v)}
        />
        <div className="resize-handle resize-handle--h" onMouseDown={e => startSidebarDrag(e, 'x')} />
      </div>

      {showSettings && effectiveSettings ? (
        <SettingsView
          settings={effectiveSettings}
          onClose={() => setShowSettings(false)}
          onSettingsChange={handleSettingsChange}
          onSettingsSave={handleSettingsSave}
        />
      ) : (
        <WorkspaceProvider value={session}>
          <Workspace onCommit={handleTableCommit} />
        </WorkspaceProvider>
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
            onSaveOnly={(conn) => { db.updateSaved(conn); handleCloseModal() }}
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
