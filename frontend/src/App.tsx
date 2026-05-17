import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react'
import { Events } from '@wailsio/runtime'
import { Sidebar } from './connection/Sidebar'
import { Workspace } from './workspace/Workspace'
import { SettingsView } from './settings/SettingsView'
import { Modal } from './ui/Modal'
import { ConfirmModal } from './ui/ConfirmModal'
import { ConnectForm } from './connection/ConnectForm'
import { useDatabase } from './connection/useDatabase'
import { useTableTabs } from './table/useTableTabs'
import { useSettings } from './settings/useSettings'
import { WorkspaceProvider } from './workspace/WorkspaceContext'
import { ConnectionProvider } from './connection/ConnectionContext'
import type { AppSettings, SavedConnection } from '../bindings/basalt/localdb/models'
import type { LogEntry, Tab } from './types'
import { useResizeDrag } from './workspace/useResizeDrag'

const TAB_STORAGE_KEY = 'basalt:tabs'

interface PersistedTabs {
  tabs: Tab[]
  activeTabId: string
  worksheetSQL: Record<string, string>
}

function loadPersistedTabs(): PersistedTabs | null {
  try {
    const raw = localStorage.getItem(TAB_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedTabs
  } catch {
    return null
  }
}

function App() {
  const [sidebarWidth, startSidebarDrag] = useResizeDrag(260, 160, 520)

  const [statusLog, setStatusLog] = useState<LogEntry[]>(() => [{
    id: 0,
    ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
    text: 'Ready — no active connection',
    isError: false,
  }])

  const logIdRef = useRef(1)
  const addStatus = useCallback((msg: string, isSuccess = false) => {
    const id = logIdRef.current++
    setStatusLog(prev => [...prev, {
      id,
      ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
      text: msg,
      isError: msg.startsWith('Error:'),
      isSuccess,
    }])
  }, [])

  const [showConnectForm, setShowConnectForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ count: number } | null>(null)

  const db = useDatabase(addStatus)
  const { settings, saveSettings } = useSettings()
  const tableTabs = useTableTabs(addStatus)

  // Derived: which connection the current tab belongs to
  const activeConnectionID = tableTabs.activeTab.connectionID
  const activeConnection = db.connections.find(c => c.id === activeConnectionID)

  const [settingsDraft, setSettingsDraft] = useState<AppSettings | null>(null)
  const effectiveSettings = settingsDraft ?? settings

  // ── Tab persistence ───────────────────────────────────────────────────────

  // Restore tabs once on mount (before first render of saved connections)
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const persisted = loadPersistedTabs()
    if (!persisted || persisted.tabs.length === 0) return
    tableTabs.restoreTabs(persisted.tabs, persisted.activeTabId, persisted.worksheetSQL)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save on every tab/SQL change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const worksheetSQL: Record<string, string> = {}
      for (const [id, state] of Object.entries(tableTabs.worksheetStates)) {
        if (state.sql) worksheetSQL[id] = state.sql
      }
      const data: PersistedTabs = {
        tabs: tableTabs.tabs,
        activeTabId: tableTabs.activeTabId,
        worksheetSQL,
      }
      localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(data))
    }, 500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [tableTabs.tabs, tableTabs.activeTabId, tableTabs.worksheetStates])

  // ── Lazy tab loading ──────────────────────────────────────────────────────

  // When the active tab changes or connections change, load the table if needed
  useEffect(() => {
    const tab = tableTabs.activeTab
    if (tab.kind !== 'table' || !tab.table) return
    const state = tableTabs.tableStates[tab.id]
    if (state?.result !== null || state?.isLoading) return

    const isLive = db.connections.some(c => c.id === tab.connectionID)
    if (isLive) {
      tableTabs.loadActiveTab(tab.connectionID, tab.schema, tab.table)
    } else {
      db.reconnect(tab.connectionID, () => {
        tableTabs.loadActiveTab(tab.connectionID, tab.schema, tab.table!)
      })
    }
  }, [tableTabs.activeTabId, db.connections]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── FK tab handler ────────────────────────────────────────────────────────

  const activeFkError = tableTabs.activeTableState?.commitError ?? null

  const handleOpenFkTab = () => {
    if (!activeFkError) return
    tableTabs.openTableTabWithPrefill(
      tableTabs.activeTab.connectionID,
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

  // ── Menu events ───────────────────────────────────────────────────────────

  const menuRef = useRef({
    openNewConnection: () => setShowConnectForm(true),
    openSettings: () => setShowSettings(true),
    refreshSchema: () => db.refreshObjects(activeConnectionID),
    runQuery: () => tableTabs.runQuery(),
    connectSaved: (id: string) => db.reconnect(id),
    closeConnection: () => { if (activeConnectionID) db.disconnect(activeConnectionID) },
  })
  menuRef.current = {
    openNewConnection: () => setShowConnectForm(true),
    openSettings: () => setShowSettings(true),
    refreshSchema: () => db.refreshObjects(activeConnectionID),
    runQuery: () => tableTabs.runQuery(),
    connectSaved: (id: string) => db.reconnect(id),
    closeConnection: () => { if (activeConnectionID) db.disconnect(activeConnectionID) },
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

  // ── Context values ────────────────────────────────────────────────────────

  const activeWS = tableTabs.activeWorksheetState

  const connectionSession = useMemo(() => ({
    savedConnections: db.savedConnections,
    connections: db.connections,
    activeTabConnectionID: activeConnectionID,
    objectsByConnection: db.objectsByConnection,
    isConnecting: db.isConnecting,
    onNewConnection: () => setShowConnectForm(true),
    onConnectionClick: () => {}, // expand/collapse handled locally in ConnectionTree
    onReconnect: db.reconnect,
    onDisconnect: db.disconnect,
    onDeleteSaved: db.deleteSaved,
    onEditSaved: handleEditSaved,
    onRefresh: () => db.refreshObjects(activeConnectionID),
    onTableOpen: (connectionID: string, schema: string, table: string) => { tableTabs.openTableTab(connectionID, schema, table); setShowSettings(false) },
    onTableOpenNewTab: (connectionID: string, schema: string, table: string) => { tableTabs.openTableTab(connectionID, schema, table); setShowSettings(false) },
    onTableOpenSchema: (connectionID: string, schema: string, table: string) => { tableTabs.openSchemaTab(connectionID, schema, table); setShowSettings(false) },
    onGroupOpen: (connectionID: string, schema: string, kind: 'sequences' | 'indexes') => { tableTabs.openGroupTab(connectionID, schema, kind); setShowSettings(false) },
  }), [db.savedConnections, db.connections, db.objectsByConnection, db.isConnecting, activeConnectionID]) // eslint-disable-line react-hooks/exhaustive-deps

  const tabsValue = useMemo(() => ({
    list: tableTabs.tabs,
    activeId: tableTabs.activeTabId,
    active: tableTabs.activeTab,
    activeTableState: tableTabs.activeTableState,
    activeWorksheetState: tableTabs.activeWorksheetState,
    setActive: tableTabs.setActiveTab,
    close: tableTabs.closeTab,
    closeAll: tableTabs.closeAllTabs,
    togglePin: tableTabs.togglePinTab,
    rename: tableTabs.renameTab,
    openTable: tableTabs.openTableTab,
    openTableWithPrefill: tableTabs.openTableTabWithPrefill,
    openSchema: tableTabs.openSchemaTab,
    openGroup: tableTabs.openGroupTab,
    openWorksheet: tableTabs.openWorksheetTab,
    setTabConnectionID: tableTabs.setTabConnectionID,
    reorder: tableTabs.reorderTabs,
  }), [tableTabs.tabs, tableTabs.activeTabId, tableTabs.activeTab, tableTabs.activeTableState, tableTabs.activeWorksheetState]) // eslint-disable-line react-hooks/exhaustive-deps

  const tableEditorValue = useMemo(() => ({
    updateCell: tableTabs.updateCell,
    updateNewCell: tableTabs.updateNewCell,
    addRow: tableTabs.addNewRow,
    removeRow: tableTabs.removeNewRow,
    markForDelete: tableTabs.markForDelete,
    discard: tableTabs.discardEdits,
    commit: tableTabs.commitEdits,
    refresh: tableTabs.refreshActiveTable,
    setFilter: tableTabs.setFilterExpr,
  }), [tableTabs.activeTabId]) // eslint-disable-line react-hooks/exhaustive-deps

  const worksheetValue = useMemo(() => ({
    isRunning: activeWS?.isRunning ?? false,
    result: activeWS?.result ?? null,
    rows: activeWS?.rows ?? [],
    dirtyCells: activeWS?.dirtyCells ?? {},
    sql: activeWS?.sql ?? '',
    setSql: tableTabs.setSql,
    run: tableTabs.runQuery,
    updateCell: tableTabs.updateQueryCell,
    discard: tableTabs.discardQueryEdits,
  }), [activeWS]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusValue = useMemo(() => ({
    log: statusLog,
    set: addStatus,
    activeFkError,
    openFkTab: handleOpenFkTab,
  }), [statusLog, activeFkError]) // eslint-disable-line react-hooks/exhaustive-deps

  const session = useMemo(() => ({
    connection: {
      connections: db.connections,
      active: activeConnection,
      objects: db.objectsByConnection[activeConnectionID] ?? [],
    },
    tabs: tabsValue,
    tableEditor: tableEditorValue,
    worksheet: worksheetValue,
    status: statusValue,
  }), [db.connections, activeConnection, db.objectsByConnection, activeConnectionID, tabsValue, tableEditorValue, worksheetValue, statusValue])

  return (
    <main
      className="app-shell"
      style={{
        '--cell-height': effectiveSettings?.rowDensity === 'compact' ? '26px'
          : effectiveSettings?.rowDensity === 'comfortable' ? '42px' : '34px',
        '--sidebar-width': `${sidebarWidth}px`,
      } as CSSProperties}
    >
      <div className="sidebar-wrapper">
        <ConnectionProvider value={connectionSession}>
          <Sidebar
            showSettings={showSettings}
            onSettingsToggle={() => setShowSettings((v) => !v)}
          />
        </ConnectionProvider>
        <div className="resize-handle resize-handle--h" onMouseDown={e => startSidebarDrag(e, 'x')} />
      </div>

      {showSettings && effectiveSettings ? (
        <SettingsView
          settings={effectiveSettings}
          savedConnections={db.savedConnections}
          onClose={() => setShowSettings(false)}
          onSettingsChange={handleSettingsChange}
          onSettingsSave={handleSettingsSave}
          onDeleteSaved={(id) => db.deleteSaved(id)}
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
            onConnect={(name, driver, connectionString, planetscaleKey) =>
              db.connect(name, driver, connectionString, handleCloseModal, planetscaleKey)
            }
          />
        </Modal>
      )}

      {editingConnection && (
        <Modal title="Edit Connection" onClose={handleCloseModal}>
          <ConnectForm
            isConnecting={db.isConnecting === editingConnection.id}
            initialValues={editingConnection}
            onConnect={(name, driver, connectionString, planetscaleKey) =>
              db.connect(name, driver, connectionString, handleCloseModal, planetscaleKey)
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
