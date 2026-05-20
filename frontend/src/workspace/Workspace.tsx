import { useState, useCallback, useRef, useEffect } from 'react'
import { Dialogs } from '@wailsio/runtime'
import { Pin, X, Save, Play } from 'lucide-react'
import { SqlWorksheet } from '../sql/SqlWorksheet'
import { TableView } from '../table/TableView'
import { SequenceView } from '../schema/SequenceView'
import { IndexView } from '../schema/IndexView'
import { ForeignKeyView } from '../table/ForeignKeyView'
import { SchemaView } from '../schema/SchemaView'
import { StatusBar } from './StatusBar'
import { TableStatusBar } from './TableStatusBar'
import { TabContextMenu } from '../tabs/TabContextMenu'
import { useWorkspaceSession } from './WorkspaceContext'
import { DatabaseClient } from '../db/client'
import { parseError } from '../lib/parseError'
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

function EmptyHexGrid() {
  const R = 26
  const colStep = R * Math.sqrt(3)
  const rowStep = R * 1.5
  const cols = 32
  const rows = 24
  const W = cols * colStep + colStep
  const H = rows * rowStep + R * 2

  const hexes: Array<React.ReactNode> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * colStep + (r % 2 ? colStep / 2 : 0)
      const cy = r * rowStep + R
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6
        return `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`
      }).join(' ')
      hexes.push(<polygon key={`${r}-${c}`} points={pts} />)
    }
  }

  return (
    <svg
      className="empty-hex-bg"
      viewBox={`0 0 ${W.toFixed(0)} ${H.toFixed(0)}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hex-vignette" cx="50%" cy="50%" r="55%">
          <stop offset="0%"   stopColor="white" stopOpacity="0" />
          <stop offset="55%"  stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </radialGradient>
        <mask id="hex-vignette-mask">
          <rect width={W} height={H} fill="url(#hex-vignette)" />
        </mask>
      </defs>
      <g mask="url(#hex-vignette-mask)">{hexes}</g>
    </svg>
  )
}

interface ContextMenuState { tabId: string; x: number; y: number }

interface Props { onCommit: () => void }

export function Workspace({ onCommit }: Props) {
  const session = useWorkspaceSession()
  const { connection, tabs: tabsNs, tableEditor, worksheet, status, tabStatus } = session
  const { connections, active: activeConnection, objects } = connection
  const {
    list: tabs, activeId: activeTabId, active: activeTab, activeTableState,
    setActive: setActiveTab, close: closeTab, closeAll, togglePin: togglePinTab,
    rename: renameTab, openWorksheet: openWorksheetTab, openSchema: openSchemaTab,
    setTabConnectionID, reorder: reorderTabs,
  } = tabsNs
  const {
    updateCell, updateNewCell, addRow: addNewRow, removeRow: removeNewRow,
    markForDelete, discard: discardEdits, refresh: refreshActiveTable, setFilter: setFilterExpr,
    goToPage, setPageSize,
  } = tableEditor
  const { defaultRowLimit } = session
  const {
    isRunning, isPlanLoading, planLines,
    result: queryResult, rows: queryRows, dirtyCells: queryDirty,
    sql, setSql, run: runQuery, updateCell: updateQueryCell, discard: discardQueryEdits,
    log: worksheetLog, clearLog: clearWorksheetLog,
  } = worksheet
  const { log: statusLog, set: setStatus, activeFkError, openFkTab } = status

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
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
    setRenameValue(tab.name || tabLabel(tab))
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
      await DatabaseClient.writeFile(path, sql)
      const filename = path.split(/[\\/]/).pop()?.replace(/\.sql$/i, '') ?? path
      renameTab(activeTabId, filename)
      setStatus(`Saved to ${path}`)
    } catch (err) {
      setStatus(`Failed to save file: ${parseError(err)}`)
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
            const content = await DatabaseClient.readFile(path)
            const filename = path.split(/[\\/]/).pop()?.replace(/\.sql$/i, '') ?? path
            setSql(content)
            renameTab(tabId, filename)
            setActiveTab(tabId)
          } catch (err) {
            setStatus(`Failed to read file: ${parseError(err)}`)
          }
        },
      })
    }

    if (!tab.pinned) {
      items.push({ label: 'Close tab', onClick: () => closeTab(tabId), danger: true })
    }

    const closeable = tabs.filter(t => !t.pinned)
    if (closeable.length > 1) {
      items.push({ label: 'Close all tabs', onClick: () => closeAll(), danger: true })
    }

    return items
  }

  const connContext = activeConnection
    ? `${activeConnection.user || 'user'}@${activeConnection.host || 'host'}/${activeConnection.database || 'db'}`
    : 'Not connected'

  const activeDurationMs = activeTableState?.result?.durationMs

  if (tabs.length === 0) {
    return (
      <section className="workspace workspace-empty">
        <header className="topbar">
          <div className="topbar-tabs">
            <button className="tab-new-worksheet" aria-label="New worksheet" title="New worksheet" onClick={() => openWorksheetTab()}>+</button>
          </div>
        </header>
        <div className="empty-state-screen">
          <EmptyHexGrid />
          <div className="empty-state-content">
            <span className="empty-state-logo">basalt</span>
            <p className="empty-state-hint">open a table or start a new worksheet</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="workspace">
      <header className="topbar">
        <div className="topbar-tab-area">
        <div className="topbar-tabs">
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId
            const isPinned = tab.pinned ?? false
            const isRenaming = renamingTabId === tab.id
            const isDragOver = dragOverIdx === idx && dragSrcIdx !== idx

            return (
              <button
                key={tab.id}
                draggable
                className={`ws-tab${isActive ? ' active' : ''}${isPinned ? ' pinned' : ''}${isDragOver ? ' drag-over' : ''}`}
                onClick={() => { if (isActive) { startRename(tab) } else { setActiveTab(tab.id) } }}
                onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragSrcIdx(idx) }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx) }}
                onDrop={(e) => { e.preventDefault(); if (dragSrcIdx !== null) reorderTabs(dragSrcIdx, idx); setDragSrcIdx(null); setDragOverIdx(null) }}
                onDragEnd={() => { setDragSrcIdx(null); setDragOverIdx(null) }}
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

        </div>

          <button
            className="tab-new-worksheet"
            aria-label="New worksheet"
            title="New worksheet"
            onClick={() => openWorksheetTab()}
          >
            +
          </button>
        </div>

        <div className="topbar-context">{connContext}</div>

        <div className="topbar-actions">
          {activeTab.kind === 'worksheet' && (
            <>
              <select
                className="worksheet-connection-select"
                value={activeTab.connectionID}
                onChange={e => setTabConnectionID(activeTab.id, e.target.value)}
              >
                <option value="">— Select database —</option>
                {connections.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.host || c.id}</option>
                ))}
              </select>
              <button className="compact-btn" onClick={handleSaveFile}><Save size={13} />Save…</button>
              <button className="run-btn" onClick={runQuery} disabled={isRunning || !activeTab.connectionID}>
                <Play size={12} /> {isRunning ? 'Running…' : 'Run'}
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
            log={worksheetLog}
            objects={objects}
            connectionId={activeConnection?.id}
            driver={activeConnection?.driver}
            isRunning={isRunning}
            isPlanLoading={isPlanLoading}
            planLines={planLines}
            onSqlChange={setSql}
            onCellChange={updateQueryCell}
            onDiscard={discardQueryEdits}
            onClearLog={clearWorksheetLog}
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
            onEditSchema={() => openSchemaTab(activeTab.connectionID, activeTab.schema, activeTab.table!)}
            onAddColumn={() => openSchemaTab(activeTab.connectionID, activeTab.schema, activeTab.table!, true)}
          />
        )}

        {activeTab.kind === 'sequences' && (
          <SequenceView connectionID={activeTab.connectionID} schema={activeTab.schema} onStatus={tabStatus.set} />
        )}

        {activeTab.kind === 'indexes' && (
          <IndexView connectionID={activeTab.connectionID} schema={activeTab.schema} onStatus={tabStatus.set} />
        )}

        {activeTab.kind === 'foreignkeys' && (
          <ForeignKeyView connectionID={activeTab.connectionID} schema={activeTab.schema} onStatus={tabStatus.set} />
        )}

        {activeTab.kind === 'schema' && activeTab.table && (
          <SchemaView
            connectionID={activeTab.connectionID}
            schema={activeTab.schema}
            table={activeTab.table}
            addColumn={activeTab.addColumn}
            onTableRefresh={refreshActiveTable}
          />
        )}
      </div>

      {activeTab.kind === 'table' && (
        <TableStatusBar
          entries={statusLog}
          durationMs={activeDurationMs}
          fkError={activeFkError}
          onOpenFkTab={openFkTab}
          currentPage={activeTableState?.currentPage ?? 0}
          totalRows={activeTableState?.totalRows ?? 0}
          pageSize={activeTableState?.pageSize ?? defaultRowLimit}
          defaultPageSize={defaultRowLimit}
          isRefreshing={activeTableState?.isRefreshing ?? false}
          onGoToPage={goToPage}
          onSetPageSize={setPageSize}
        />
      )}
      {(activeTab.kind === 'schema' || activeTab.kind === 'sequences' || activeTab.kind === 'indexes' || activeTab.kind === 'foreignkeys') && (
        <StatusBar
          entries={tabStatus.log}
        />
      )}

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
