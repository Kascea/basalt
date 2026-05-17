import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react'
import { Window, Events } from '@wailsio/runtime'
import { Paintbrush, Terminal, Settings, Link, Database, DatabaseIcon, Plus } from 'lucide-react'
import { ConnectionTree } from './connection/ConnectionTree'
import { Workspace } from './workspace/Workspace'
import { SettingsView, type Section as SettingsSection } from './settings/SettingsView'
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

type AppView = 'main' | 'settings'

const SETTINGS_NAV: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
  { id: 'appearance', label: 'Appearance',        icon: <Paintbrush size={15} /> },
  { id: 'query',      label: 'Query',             icon: <Terminal size={15} /> },
  { id: 'general',    label: 'General',           icon: <Settings size={15} /> },
  { id: 'connections', label: 'Connections',      icon: <Database size={15} /> },
  { id: 'accounts',   label: 'Connected Accounts', icon: <Link size={15} /> },
]

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

  const [currentView, setCurrentView] = useState<AppView>('main')
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('appearance')
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ count: number } | null>(null)

  const db = useDatabase(addStatus)
  const { settings, saveSettings } = useSettings()
  const tableTabs = useTableTabs(addStatus)

  // Always-current ref so memoized callbacks never capture stale tableTabs functions
  const tableTabsRef = useRef(tableTabs)
  tableTabsRef.current = tableTabs

  const activeConnectionID = tableTabs.activeTab.connectionID
  const activeConnection = db.connections.find(c => c.id === activeConnectionID)

  const [settingsDraft, setSettingsDraft] = useState<AppSettings | null>(null)
  const effectiveSettings = settingsDraft ?? settings

  // ── Tab persistence ───────────────────────────────────────────────────────

  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const persisted = loadPersistedTabs()
    if (!persisted || persisted.tabs.length === 0) return
    tableTabs.restoreTabs(persisted.tabs, persisted.activeTabId, persisted.worksheetSQL)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const worksheetSQL: Record<string, string> = {}
      for (const [id, state] of Object.entries(tableTabs.worksheetStates)) {
        if (state.sql) worksheetSQL[id] = state.sql
      }
      localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify({
        tabs: tableTabs.tabs,
        activeTabId: tableTabs.activeTabId,
        worksheetSQL,
      }))
    }, 500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [tableTabs.tabs, tableTabs.activeTabId, tableTabs.worksheetStates])

  // ── Lazy tab loading ──────────────────────────────────────────────────────

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
  const handleCloseModal = () => setEditingConnection(null)

  const openSettings = (section: SettingsSection = 'appearance') => {
    setSettingsSection(section)
    setCurrentView('settings')
  }

  const handleSettingsChange = (patch: Partial<AppSettings>) => {
    const base = settingsDraft ?? settings
    if (base) setSettingsDraft({ ...base, ...patch })
  }

  const handleSettingsSave = () => {
    if (settingsDraft) saveSettings(settingsDraft).then(() => setSettingsDraft(null))
  }

  // ── Menu events ───────────────────────────────────────────────────────────

  const menuRef = useRef({
    openNewConnection: () => openSettings('connections'),
    openSettings: () => openSettings(),
    refreshSchema: () => db.refreshObjects(activeConnectionID),
    runQuery: () => tableTabs.runQuery(),
    connectSaved: (id: string) => db.reconnect(id),
    closeConnection: () => { if (activeConnectionID) db.disconnect(activeConnectionID) },
  })
  menuRef.current = {
    openNewConnection: () => openSettings('connections'),
    openSettings: () => openSettings(),
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
    onNewConnection: () => openSettings('connections'),
    onConnectionClick: () => {},
    onReconnect: db.reconnect,
    onDisconnect: db.disconnect,
    onDeleteSaved: db.deleteSaved,
    onEditSaved: handleEditSaved,
    onRefresh: () => db.refreshObjects(activeConnectionID),
    onTableOpen: (connectionID: string, schema: string, table: string) => { tableTabsRef.current.openTableTab(connectionID, schema, table); setCurrentView('main') },
    onTableOpenNewTab: (connectionID: string, schema: string, table: string) => { tableTabsRef.current.openTableTab(connectionID, schema, table); setCurrentView('main') },
    onTableOpenSchema: (connectionID: string, schema: string, table: string) => { tableTabsRef.current.openSchemaTab(connectionID, schema, table); setCurrentView('main') },
    onGroupOpen: (connectionID: string, schema: string, kind: 'sequences' | 'indexes') => { tableTabsRef.current.openGroupTab(connectionID, schema, kind); setCurrentView('main') },
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
  }), [activeWS, tableTabs.activeTab.connectionID]) // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* ── Persistent sidebar — always visible, content swaps by view ── */}
      <div className="sidebar-wrapper">
        <aside className="sidebar">
          <div className="brand-row" onDoubleClick={() => Window.ToggleMaximise()}>
            <img className="brand-mark" src="/logo-64.png" alt="basalt" />
            <span className="brand-name">basalt</span>
          </div>

          {currentView === 'main' ? (
            <ConnectionProvider value={connectionSession}>
              <div className="tree-root">
                <ConnectionTree />
                <button
                  className="tree-node conn-node new-connection-row"
                  onClick={() => openSettings('connections')}
                >
                  <span className="chevron" />
                  <span className="node-icon"><DatabaseIcon size={13} /></span>
                  <span className="node-label">New Connection</span>
                  <Plus size={11} strokeWidth={2.5} className="new-connection-plus" />
                </button>
              </div>
            </ConnectionProvider>
          ) : (
            <nav className="settings-nav">
              <div className="settings-nav-header">Settings</div>
              {SETTINGS_NAV.map(item => (
                <button
                  key={item.id}
                  className={`settings-nav-item${settingsSection === item.id ? ' is-active' : ''}`}
                  onClick={() => setSettingsSection(item.id)}
                >
                  <span className="settings-nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          <div className="sidebar-footer">
            {currentView === 'main' ? (
              <button className="sidebar-footer-btn" onClick={() => openSettings()}>
                ⚙ Settings
              </button>
            ) : (
              <>
                <button className="sidebar-footer-btn" onClick={() => setCurrentView('main')}>
                  ← Back
                </button>
                {settingsDraft && (
                  <button className="sidebar-footer-btn sidebar-footer-btn--save" onClick={handleSettingsSave}>
                    Save Changes
                  </button>
                )}
              </>
            )}
          </div>
        </aside>

        <div className="resize-handle resize-handle--h" onMouseDown={e => startSidebarDrag(e, 'x')} />
      </div>

      {/* ── Main content area — swaps by view ── */}
      {currentView === 'main' && (
        <WorkspaceProvider value={session}>
          <Workspace onCommit={handleTableCommit} />
        </WorkspaceProvider>
      )}

      {currentView === 'settings' && effectiveSettings && (
        <SettingsView
          settings={effectiveSettings}
          savedConnections={db.savedConnections}
          connections={db.connections}
          isConnecting={db.isConnecting}
          onSettingsChange={handleSettingsChange}
          onDeleteSaved={(id) => db.deleteSaved(id)}
          onReconnect={db.reconnect}
          onDisconnect={db.disconnect}
          onEditSaved={handleEditSaved}
          onConnect={(name, driver, cs, psKey) => db.connect(name, driver, cs, undefined, psKey)}
          activeSection={settingsSection}
        />
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
