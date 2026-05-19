import { useEffect } from 'react'
import { useTabManager } from '../tabs/useTabManager'
import { useTableSession } from './useTableSession'
import { useWorksheetSession } from '../sql/useWorksheetSession'
import type { Tab } from '../types'

export function useTableTabs(setStatus: (msg: string, isSuccess?: boolean) => void) {
  const tabManager = useTabManager()
  const { lastTabEvent, clearTabEvent } = tabManager

  const tableSession = useTableSession({
    activeTabId: tabManager.activeTabId,
    activeTab: tabManager.activeTab,
    setStatus,
  })

  const worksheetSession = useWorksheetSession({
    activeTabId: tabManager.activeTabId,
    activeTab: tabManager.activeTab,
    setStatus,
  })

  // Drain tab lifecycle events. The coordinator reacts here rather than
  // receiving callbacks — keeping the lifecycle protocol typed and explicit.
  useEffect(() => {
    if (!lastTabEvent) return
    switch (lastTabEvent.type) {
      case 'load-table':
        tableSession.loadTable(
          lastTabEvent.id, lastTabEvent.connID,
          lastTabEvent.schema, lastTabEvent.table,
          lastTabEvent.prefill,
        )
        break
      case 'create-worksheet':
        worksheetSession.createWorksheet(lastTabEvent.id)
        break
      case 'cleanup-tab':
        tableSession.removeState(lastTabEvent.id)
        worksheetSession.removeState(lastTabEvent.id)
        break
    }
    clearTabEvent()
  }, [lastTabEvent]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore tabs from persistence without triggering loads (App.tsx drives lazy loading)
  const restoreTabs = (tabs: Tab[], activeTabId: string, worksheetSQL: Record<string, string>) => {
    tabManager.restoreTabs(tabs, activeTabId)
    for (const [id, sql] of Object.entries(worksheetSQL)) {
      worksheetSession.initWorksheetState(id, sql)
    }
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
    setTabConnectionID: tabManager.setTabConnectionID,
    togglePinTab: tabManager.togglePinTab,
    renameTab: tabManager.renameTab,
    closeTab: tabManager.closeTab,
    closeAllTabs: tabManager.closeAllTabs,
    reorderTabs: tabManager.reorderTabs,
    restoreTabs,

    // State access for persistence
    tableStates: tableSession.tableStates,
    worksheetStates: worksheetSession.worksheetStates,

    // Lazy loading
    loadActiveTab: tableSession.loadActiveTab,

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
    clearWorksheetLog: worksheetSession.clearWorksheetLog,
  }
}
