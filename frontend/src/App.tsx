import { useState, useEffect, useRef, type CSSProperties } from 'react'
import navStyles from './settings/settings.module.css'
import { Window, Events } from '@wailsio/runtime'
import { Paintbrush, Terminal, Settings, Link, Database, DatabaseIcon, Plus, ArrowLeft } from 'lucide-react'
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
import { useStatusLog } from './useStatusLog'
import { useTabPersistence } from './table/useTabPersistence'
import { useWorkspaceComposer } from './workspace/useWorkspaceComposer'
import type { SavedConnection } from '../bindings/basalt/localdb/models'
import { useResizeDrag } from './workspace/useResizeDrag'

type AppView = 'main' | 'settings'

const SETTINGS_NAV: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
  { id: 'appearance', label: 'Appearance',         icon: <Paintbrush size={17} /> },
  { id: 'query',      label: 'Query',              icon: <Terminal size={17} /> },
  { id: 'general',    label: 'General',            icon: <Settings size={17} /> },
  { id: 'connections', label: 'Connections',       icon: <Database size={17} /> },
  { id: 'accounts',   label: 'Connected Accounts', icon: <Link size={17} /> },
]

function App() {
  const [sidebarWidth, startSidebarDrag] = useResizeDrag(260, 160, 520)
  const [statusLog, addStatus] = useStatusLog()
  const db = useDatabase(addStatus)
  const { settings, saveSettings } = useSettings()
  const tableTabs = useTableTabs(addStatus)

  const [currentView, setCurrentView] = useState<AppView>('main')
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('appearance')
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ count: number } | null>(null)

  const openSettings = (section: SettingsSection = 'appearance') => {
    setSettingsSection(section)
    setCurrentView('settings')
  }

  useTabPersistence(tableTabs)

  const { session, connectionSession, handleTableCommit, handleOpenConnection, handleSettingsChange } =
    useWorkspaceComposer(db, tableTabs, settings, saveSettings, statusLog, addStatus, {
      openSettings,
      setEditingConnection,
      setConfirmDelete,
    })

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

  // ── Menu events ───────────────────────────────────────────────────────────

  const activeConnectionID = tableTabs.activeTab.connectionID
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

  return (
    <main
      className="app-shell"
      style={{
        '--cell-height': settings?.rowDensity === 'compact' ? '26px'
          : settings?.rowDensity === 'comfortable' ? '42px' : '34px',
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
            <nav className={navStyles.nav}>
              <div className={navStyles.navHeader}>Settings</div>
              {SETTINGS_NAV.map(item => (
                <button
                  key={item.id}
                  className={`${navStyles.navItem}${settingsSection === item.id ? ` ${navStyles.navItemActive}` : ''}`}
                  onClick={() => setSettingsSection(item.id)}
                >
                  <span className={navStyles.navIcon}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          <div className="sidebar-footer">
            {currentView === 'main' ? (
              <button className="sidebar-footer-btn" onClick={() => openSettings()}>
                <Settings size={14} strokeWidth={2} /> Settings
              </button>
            ) : (
              <button className="sidebar-footer-btn" onClick={() => setCurrentView('main')}>
                <ArrowLeft size={14} strokeWidth={2} /> Back
              </button>
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

      {currentView === 'settings' && settings && (
        <SettingsView
          settings={settings}
          savedConnections={db.savedConnections}
          connections={db.connections}
          isConnecting={db.isConnecting}
          onSettingsChange={handleSettingsChange}
          onDeleteSaved={(id) => db.deleteSaved(id)}
          onReconnect={db.reconnect}
          onDisconnect={db.disconnect}
          onEditSaved={setEditingConnection}
          onConnect={(name, driver, cs, psKey, sbKey) => db.connect(name, driver, cs, undefined, psKey, sbKey)}
          onOpenConnection={(id) => { handleOpenConnection(id); setCurrentView('main') }}
          activeSection={settingsSection}
        />
      )}

      {editingConnection && (
        <Modal title="Edit Connection" onClose={() => setEditingConnection(null)}>
          <ConnectForm
            isConnecting={db.isConnecting === editingConnection.id}
            initialValues={editingConnection}
            onConnect={(name, driver, connectionString, planetscaleKey) =>
              db.connect(name, driver, connectionString, () => setEditingConnection(null), planetscaleKey)
            }
            onSaveOnly={(conn) => { db.updateSaved(conn); setEditingConnection(null) }}
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
