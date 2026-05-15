import { useState, useCallback, useRef, useEffect } from 'react'
import { Window, Dialogs } from '@wailsio/runtime'
import { Pin, X, Save } from 'lucide-react'
import { SqlWorksheet } from './SqlWorksheet'
import { TableView } from './TableView'
import { SequenceView } from './SequenceView'
import { IndexView } from './IndexView'
import { ForeignKeyView } from './ForeignKeyView'
import { SchemaView } from './SchemaView'
import { StatusBar } from './StatusBar'
import { TabContextMenu } from './TabContextMenu'
import { useWorkspaceSession } from '../context/WorkspaceContext'
import { DatabaseService } from '../../bindings/basalt/db'
import type { Tab } from '../types'

function tabLabel(tab: Tab): string {
  if (tab.kind === 'worksheet') return tab.name || 'Worksheet'
  switch (tab.kind) {
    case 'table': return `${tab.schema}.${tab.table}`
    case 'sequences': return `${tab.schema} · Sequences`
    case 'indexes': return `${tab.schema} · Indexes`
    case 'foreignkeys': return `${tab.schema} · Foreign Keys`
    case 'schema': return `${tab.schema}.${tab.table} · Schema`
  }
}

interface ContextMenuState { tabId: string; x: number; y: number }

interface Props { onCommit: () => void }

export function Workspace({ onCommit }: Props) {
  const session = useWorkspaceSession()
  const { connection, tabs: tabsNs, tableEditor, worksheet, status, nullText } = session
  const { active: activeConnection, objects } = connection
  const {
    list: tabs, activeId: activeTabId, active: activeTab, activeTableState,
    setActive: setActiveTab, close: closeTab, togglePin: togglePinTab,
    rename: renameTab, openWorksheet: openWorksheetTab, openSchema: openSchemaTab,
  } = tabsNs
  const {
    updateCell, updateNewCell, addRow: addNewRow, removeRow: removeNewRow,
    markForDelete, discard: discardEdits, refresh: refreshActiveTable, setFilter: setFilterExpr,
  } = tableEditor
  const {
    isRunning, result: queryResult, rows: queryRows, dirtyCells: queryDirty,
    sql, setSql, run: runQuery, updateCell: updateQueryCell, discard: discardQueryEdits,
  } = worksheet
  const { message: statusMessage, set: setStatus, activeFkError, openFkTab } = status

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingTabId) renameInputRef.current?.select()
  }, [renamingTabId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && activeTab.kind === 'worksheet') {
        e.preventDefault()
        handleSaveFile()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, sql])

  const startRename = (tab: Tab) => {
    if (tab.kind !== 'worksheet') return
    setRenamingTabId(tab.id)
    setRenameValue(tab.name || 'Worksheet')
  }

  const commitRename = () => {
    if (renamingTabId) renameTab(renamingTabId, renameValue)
    setRenamingTabId(null)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setRenamingTabId(null)
  }

  const handleTabContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    setContextMenu({ tabId, x: e.clientX, y: e.clientY })
  }, [])

  const handleSaveFile = async () => {
    const path = await Dialogs.SaveFile({
      Title: 'Save SQL file',
      Filename: `${activeTab.name || 'query'}.sql`,
      Filters: [{ DisplayName: 'SQL Files', Pattern: '*.sql' }],
    })
    if (!path) return
    try {
      await DatabaseService.WriteFile(path, sql)
      const filename = path.split(/[\\/]/).pop()?.replace(/\.sql$/i, '') ?? path
      renameTab(activeTabId, filename)
      setStatus(`Saved to ${path}`)
    } catch (err) {
      setStatus(`Failed to save file: ${String(err)}`)
    }
  }

  const buildMenuItems = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return []
    const items: { label: string; onClick: () => void; danger?: boolean }[] = []

    items.push({ label: tab.pinned ? 'Unpin tab' : 'Pin tab', onClick: () => togglePinTab(tabId) })

    if (tab.kind === 'worksheet') {
      items.push({ label: 'Rename tab', onClick: () => { setActiveTab(tabId); startRename(tab) } })
      items.push({
        label: 'Import SQL file…',
        onClick: async () => {
          const path = await Dialogs.OpenFile({
            Title: 'Import SQL file',
            Filters: [{ DisplayName: 'SQL Files', Pattern: '*.sql' }, { DisplayName: 'All Files', Pattern: '*' }],
          }) as string
          if (!path) return
          try {
            const content = await DatabaseService.ReadFile(path)
            const filename = path.split(/[\\/]/).pop()?.replace(/\.sql$/i, '') ?? path
            setSql(content)
            renameTab(tabId, filename)
            setActiveTab(tabId)
          } catch (err) {
            setStatus(`Failed to read file: ${String(err)}`)
          }
        },
      })
    }

    if (!tab.pinned) {
      items.push({ label: 'Close tab', onClick: () => closeTab(tabId), danger: true })
    }

    return items
  }

  const connContext = activeConnection
    ? `${activeConnection.user || 'user'}@${activeConnection.host || 'host'}/${activeConnection.database || 'db'}`
    : 'Not connected'

  const activeDurationMs = activeTab.kind === 'worksheet'
    ? queryResult?.durationMs
    : activeTableState?.result?.durationMs

  if (tabs.length === 0) {
    return (
      <section className="workspace workspace-empty">
        <header className="topbar" onDoubleClick={() => Window.ToggleMaximise()}>
          <div className="topbar-tabs">
            <button className="tab-new-worksheet" aria-label="New worksheet" title="New worksheet" onClick={openWorksheetTab}>+</button>
          </div>
        </header>
        <div className="empty-state-screen">
          <span className="empty-state-logo">basalt</span>
        </div>
      </section>
    )
  }

  return (
    <section className="workspace">
      <header className="topbar" onDoubleClick={() => Window.ToggleMaximise()}>
        <div className="topbar-tabs">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId
            const isPinned = tab.pinned ?? false
            const isRenaming = renamingTabId === tab.id

            return (
              <button
                key={tab.id}
                className={`ws-tab${isActive ? ' active' : ''}${isPinned ? ' pinned' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                onDoubleClick={() => startRename(tab)}
                onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
              >
                {isPinned && <Pin size={10} className="tab-pin-indicator" />}
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    className="tab-rename-input"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleRenameKeyDown}
                    onClick={e => e.stopPropagation()}
                    style={{ width: `${Math.max(renameValue.length, 4)}ch` }}
                  />
                ) : (
                  tabLabel(tab)
                )}
                {!isPinned && !isRenaming && (
                  <span
                    className="tab-close"
                    role="button"
                    aria-label="Close tab"
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  >
                    <X size={10} />
                  </span>
                )}
              </button>
            )
          })}

          <button
            className="tab-new-worksheet"
            aria-label="New worksheet"
            title="New worksheet"
            onClick={openWorksheetTab}
          >
            +
          </button>
        </div>

        <div className="topbar-context">{connContext}</div>

        <div className="topbar-actions">
          {activeTab.kind === 'worksheet' && (
            <>
              <button className="compact-btn" onClick={handleSaveFile}><Save size={13} />Save…</button>
              <button className="run-btn" onClick={runQuery} disabled={isRunning || !activeConnection}>
                ▶ {isRunning ? 'Running…' : 'Run'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="workspace-body">
        {activeTab.kind === 'worksheet' && (
          <SqlWorksheet
            sql={sql}
            result={queryResult}
            rows={queryRows}
            dirtyCells={queryDirty}
            objects={objects}
            connectionId={activeConnection?.id}
            driver={activeConnection?.driver}
            isRunning={isRunning}
            nullText={nullText}
            onSqlChange={setSql}
            onCellChange={updateQueryCell}
            onDiscard={discardQueryEdits}
          />
        )}

        {activeTab.kind === 'table' && activeTableState && (
          <TableView
            target={{ connectionID: activeTab.connectionID, schema: activeTab.schema, table: activeTab.table! }}
            result={activeTableState.result}
            rows={activeTableState.rows}
            newRows={activeTableState.newRows}
            dirtyCells={activeTableState.dirtyCells}
            pendingDeletes={activeTableState.pendingDeletes}
            isLoading={activeTableState.isLoading}
            isRefreshing={activeTableState.isRefreshing}
            isCommitting={activeTableState.isCommitting}
            nullText={nullText}
            onCellChange={updateCell}
            onNewCellChange={updateNewCell}
            onAddRow={addNewRow}
            onRemoveNewRow={removeNewRow}
            onDeleteRow={markForDelete}
            onRefresh={refreshActiveTable}
            filterExpr={activeTableState.filterExpr}
            onFilterChange={setFilterExpr}
            onDiscard={discardEdits}
            onCommit={onCommit}
            onEditSchema={() => openSchemaTab(activeTab.schema, activeTab.table!)}
          />
        )}

        {activeTab.kind === 'sequences' && (
          <SequenceView connectionID={activeTab.connectionID} schema={activeTab.schema} onStatus={setStatus} />
        )}

        {activeTab.kind === 'indexes' && (
          <IndexView connectionID={activeTab.connectionID} schema={activeTab.schema} onStatus={setStatus} />
        )}

        {activeTab.kind === 'foreignkeys' && (
          <ForeignKeyView connectionID={activeTab.connectionID} schema={activeTab.schema} onStatus={setStatus} />
        )}

        {activeTab.kind === 'schema' && activeTab.table && (
          <SchemaView
            connectionID={activeTab.connectionID}
            schema={activeTab.schema}
            table={activeTab.table}
            onTableRefresh={refreshActiveTable}
          />
        )}
      </div>

      <StatusBar
        message={statusMessage}
        durationMs={activeDurationMs}
        fkError={activeFkError}
        onOpenFkTab={openFkTab}
      />

      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildMenuItems(contextMenu.tabId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </section>
  )
}
