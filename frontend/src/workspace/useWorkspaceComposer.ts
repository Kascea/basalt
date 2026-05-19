import { useMemo, useRef } from 'react'
import type { AppSettings, SavedConnection } from '../../bindings/basalt/localdb/models'
import type { ConnectionSession } from '../connection/ConnectionContext'
import type { DatabaseState } from '../connection/useDatabase'
import type { useTableTabs } from '../table/useTableTabs'
import type { LogEntry } from '../types'
import type { WorkspaceSession } from './WorkspaceContext'
import type { Section as SettingsSection } from '../settings/SettingsView'

type TableTabs = ReturnType<typeof useTableTabs>

interface ViewCallbacks {
  openSettings: (section?: SettingsSection) => void
  setEditingConnection: (conn: SavedConnection | null) => void
  setConfirmDelete: (val: { count: number } | null) => void
}

interface WorkspaceComposerResult {
  session: WorkspaceSession
  connectionSession: ConnectionSession
  handleOpenFkTab: () => void
  handleTableCommit: () => void
  handleOpenConnection: (id: string) => void
  handleSettingsChange: (patch: Partial<AppSettings>) => void
}

export function useWorkspaceComposer(
  db: DatabaseState,
  tableTabs: TableTabs,
  settings: AppSettings | null,
  saveSettings: (s: AppSettings) => void,
  statusLog: LogEntry[],
  addStatus: (msg: string, isSuccess?: boolean) => void,
  view: ViewCallbacks,
): WorkspaceComposerResult {
  const tableTabsRef = useRef(tableTabs)
  tableTabsRef.current = tableTabs

  const activeConnectionID = tableTabs.activeTab.connectionID
  const activeConnection = db.connections.find(c => c.id === activeConnectionID)
  const activeFkError = tableTabs.activeTableState?.commitError ?? null
  const activeWS = tableTabs.activeWorksheetState

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
    if (settings?.confirmDeleteRows && state && state.pendingDeletes.size > 0) {
      view.setConfirmDelete({ count: state.pendingDeletes.size })
      return
    }
    tableTabs.commitEdits()
  }

  const handleOpenConnection = (id: string) => {
    const isConnected = db.connections.some(c => c.id === id)
    if (isConnected) {
      tableTabsRef.current.openWorksheetTab(id)
    } else {
      db.reconnect(id, () => tableTabsRef.current.openWorksheetTab(id))
    }
  }

  const handleSettingsChange = (patch: Partial<AppSettings>) => {
    if (settings) saveSettings({ ...settings, ...patch })
  }

  const connectionSession = useMemo(() => ({
    savedConnections: db.savedConnections,
    connections: db.connections,
    activeTabConnectionID: activeConnectionID,
    objectsByConnection: db.objectsByConnection,
    isConnecting: db.isConnecting,
    onNewConnection: () => view.openSettings('connections'),
    onConnectionClick: () => {},
    onReconnect: db.reconnect,
    onDisconnect: db.disconnect,
    onDeleteSaved: db.deleteSaved,
    onEditSaved: view.setEditingConnection,
    onReorderSaved: db.reorderSaved,
    onRefresh: () => db.refreshObjects(activeConnectionID),
    onTableOpen: (connectionID: string, schema: string, table: string) => { tableTabsRef.current.openTableTab(connectionID, schema, table) },
    onTableOpenNewTab: (connectionID: string, schema: string, table: string) => { tableTabsRef.current.openTableTab(connectionID, schema, table) },
    onTableOpenSchema: (connectionID: string, schema: string, table: string) => { tableTabsRef.current.openSchemaTab(connectionID, schema, table) },
    onGroupOpen: (connectionID: string, schema: string, kind: 'sequences' | 'indexes') => { tableTabsRef.current.openGroupTab(connectionID, schema, kind) },
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

  return {
    session,
    connectionSession,
    handleOpenFkTab,
    handleTableCommit,
    handleOpenConnection,
    handleSettingsChange,
  }
}
