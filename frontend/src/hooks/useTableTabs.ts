import { useRef } from 'react'
import { useTabManager } from './useTabManager'
import { useTableSession } from './useTableSession'
import { useWorksheetSession } from './useWorksheetSession'

export function useTableTabs(connectionID: string, setStatus: (msg: string, isSuccess?: boolean) => void) {
  // Refs let useTabManager call back into session hooks without circular deps.
  // The ref values are updated each render, so they are always current.
  const loadTableRef = useRef<(id: string, schema: string, table: string, prefill?: Record<string, string>) => void>(() => {})
  const createWorksheetRef = useRef<(id: string) => void>(() => {})
  const cleanupTabRef = useRef<(id: string) => void>(() => {})

  const tabManager = useTabManager({
    connectionID,
    onLoadTable: (id, schema, table, prefill) => loadTableRef.current(id, schema, table, prefill),
    onCreateWorksheet: (id) => createWorksheetRef.current(id),
    onCleanupTab: (id) => cleanupTabRef.current(id),
  })

  const tableSession = useTableSession({
    connectionID,
    activeTabId: tabManager.activeTabId,
    activeTab: tabManager.activeTab,
    setStatus,
  })

  const worksheetSession = useWorksheetSession({
    connectionID,
    activeTabId: tabManager.activeTabId,
    activeTab: tabManager.activeTab,
    setStatus,
  })

  // Wire refs after all hooks have been called
  loadTableRef.current = tableSession.loadTable
  createWorksheetRef.current = worksheetSession.createWorksheet
  cleanupTabRef.current = (id) => {
    tableSession.removeState(id)
    worksheetSession.removeState(id)
  }

  return {
    // Tab management
    tabs: tabManager.tabs,
    activeTabId: tabManager.activeTabId,
    activeTab: tabManager.activeTab,
    setActiveTab: tabManager.setActiveTab,
    openTableTab: tabManager.openTableTab,
    openTableTabWithPrefill: tabManager.openTableTabWithPrefill,
    openSchemaTab: tabManager.openSchemaTab,
    openGroupTab: tabManager.openGroupTab,
    openWorksheetTab: tabManager.openWorksheetTab,
    togglePinTab: tabManager.togglePinTab,
    renameTab: tabManager.renameTab,
    closeTab: tabManager.closeTab,
    closeAllTabs: tabManager.closeAllTabs,
    reorderTabs: tabManager.reorderTabs,

    // Table editing
    activeTableState: tableSession.activeTableState,
    refreshActiveTable: tableSession.refreshActiveTable,
    setFilterExpr: tableSession.setFilterExpr,
    updateCell: tableSession.updateCell,
    updateNewCell: tableSession.updateNewCell,
    addNewRow: tableSession.addNewRow,
    removeNewRow: tableSession.removeNewRow,
    markForDelete: tableSession.markForDelete,
    discardEdits: tableSession.discardEdits,
    commitEdits: tableSession.commitEdits,

    // Worksheet
    activeWorksheetState: worksheetSession.activeWorksheetState,
    setSql: worksheetSession.setSql,
    runQuery: worksheetSession.runQuery,
    updateQueryCell: worksheetSession.updateQueryCell,
    discardQueryEdits: worksheetSession.discardQueryEdits,
  }
}
