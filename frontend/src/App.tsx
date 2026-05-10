import { useEffect, useMemo, useState } from 'react'
import { DatabaseService, type Connection, type QueryResult, type SchemaObject } from '../bindings/basalt'

const starterSql = `select id, name, status, monthly_spend, last_seen
from public.customers
where status in ('active', 'paused')
order by monthly_spend desc
limit 100;`

type DirtyCells = Record<string, true>
type ResultRow = Record<string, string | undefined>

function cellKey(rowIndex: number, column: string) {
  return `${rowIndex}:${column}`
}

function App() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [activeConnectionID, setActiveConnectionID] = useState('')
  const [objects, setObjects] = useState<SchemaObject[]>([])
  const [sql, setSql] = useState(starterSql)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [rows, setRows] = useState<ResultRow[]>([])
  const [dirtyCells, setDirtyCells] = useState<DirtyCells>({})
  const [activeResultTab, setActiveResultTab] = useState<'data' | 'structure' | 'plan'>('data')
  const [filter, setFilter] = useState('')

  const activeConnection = connections.find((connection) => connection.id === activeConnectionID)

  useEffect(() => {
    DatabaseService.ListConnections().then((items) => {
      setConnections(items)
      setActiveConnectionID(items[0]?.id ?? '')
    })
  }, [])

  useEffect(() => {
    if (!activeConnectionID) return

    DatabaseService.ListSchemaObjects(activeConnectionID).then(setObjects)
    setDirtyCells({})
  }, [activeConnectionID])

  useEffect(() => {
    if (!activeConnectionID) return

    DatabaseService.ExecuteQuery(activeConnectionID, starterSql).then((queryResult) => {
      setResult(queryResult)
      setRows(queryResult.rows)
    })
  }, [activeConnectionID])

  const filteredObjects = useMemo(() => {
    const normalized = filter.trim().toLowerCase()
    if (!normalized) return objects

    return objects.filter((object) =>
      [object.schema, object.name, object.type].some((value) => value.toLowerCase().includes(normalized)),
    )
  }, [filter, objects])

  const runQuery = () => {
    if (!activeConnectionID) return

    DatabaseService.ExecuteQuery(activeConnectionID, sql).then((queryResult) => {
      setResult(queryResult)
      setRows(queryResult.rows)
      setDirtyCells({})
      setActiveResultTab('data')
    })
  }

  const updateCell = (rowIndex: number, column: string, value: string) => {
    setRows((currentRows) =>
      currentRows.map((row, index) => (index === rowIndex ? { ...row, [column]: value } : row)),
    )
    setDirtyCells((current) => ({ ...current, [cellKey(rowIndex, column)]: true }))
  }

  const discardEdits = () => {
    setRows(result?.rows ?? [])
    setDirtyCells({})
  }

  const dirtyCount = Object.keys(dirtyCells).length

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">D</div>
          <div>
            <h1>Basalt</h1>
            <p>Native database workspace</p>
          </div>
        </div>

        <section className="panel">
          <div className="panel-heading">
            <span>Connections</span>
            <button className="icon-button" title="Add connection">+</button>
          </div>
          <div className="connection-list">
            {connections.map((connection) => (
              <button
                className={connection.id === activeConnectionID ? 'connection-card active' : 'connection-card'}
                key={connection.id}
                onClick={() => setActiveConnectionID(connection.id)}
              >
                <span className="connection-topline">
                  <strong>{connection.name}</strong>
                  <small>{connection.driver}</small>
                </span>
                <span>{connection.user}@{connection.host}</span>
                <span className="muted-line">{connection.service} · {connection.lastUsed}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel schema-panel">
          <div className="panel-heading">
            <span>Object Browser</span>
            <button className="icon-button" title="Refresh objects">↻</button>
          </div>
          <input
            className="filter-input"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter schemas, tables, views"
          />
          <div className="object-list">
            {filteredObjects.map((object) => (
              <button className="object-row" key={`${object.schema}.${object.name}`}>
                <span className="object-type">{object.type.slice(0, 2).toUpperCase()}</span>
                <span>
                  <strong>{object.name}</strong>
                  <small>{object.schema} · {object.rows.toLocaleString()} rows</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Connected workspace</span>
            <h2>{activeConnection?.name ?? 'No connection selected'}</h2>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button">New worksheet</button>
            <button className="primary-button" onClick={runQuery}>Run</button>
          </div>
        </header>

        <section className="editor-layout">
          <div className="worksheet">
            <div className="tabs">
              <button className="tab active">Worksheet 1</button>
              <button className="tab">Scratch</button>
            </div>
            <textarea value={sql} onChange={(event) => setSql(event.target.value)} spellCheck={false} />
          </div>

          <aside className="inspector">
            <div className="stat-grid">
              {result?.objectStats.map((stat) => (
                <div className="stat-card" key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.count}</strong>
                </div>
              ))}
            </div>
            <div className="connection-details">
              <span className="eyebrow">Connection</span>
              <strong>{activeConnection?.driver}</strong>
              <p>{activeConnection?.user}@{activeConnection?.host}/{activeConnection?.service}</p>
            </div>
          </aside>
        </section>

        <section className="results">
          <div className="results-toolbar">
            <div className="segmented">
              <button className={activeResultTab === 'data' ? 'active' : ''} onClick={() => setActiveResultTab('data')}>Data</button>
              <button className={activeResultTab === 'structure' ? 'active' : ''} onClick={() => setActiveResultTab('structure')}>Structure</button>
              <button className={activeResultTab === 'plan' ? 'active' : ''} onClick={() => setActiveResultTab('plan')}>Plan</button>
            </div>
            <div className="edit-actions">
              <span>{result?.message ?? 'Ready'}</span>
              <span>{dirtyCount} pending edits</span>
              <button className="secondary-button compact" onClick={discardEdits} disabled={!dirtyCount}>Discard</button>
              <button className="primary-button compact" disabled={!dirtyCount}>Apply changes</button>
            </div>
          </div>

          {activeResultTab === 'data' && (
            <div className="data-grid" role="grid" aria-label="Editable query results">
              <table>
                <thead>
                  <tr>
                    <th className="row-index">#</th>
                    {result?.columns.map((column) => <th key={column}>{column}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="row-index">{rowIndex + 1}</td>
                      {result?.columns.map((column) => (
                        <td className={dirtyCells[cellKey(rowIndex, column)] ? 'dirty-cell' : ''} key={column}>
                          <input
                            value={row[column] ?? ''}
                            onChange={(event) => updateCell(rowIndex, column, event.target.value)}
                            aria-label={`${column} row ${rowIndex + 1}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeResultTab === 'structure' && (
            <div className="structure-view">
              {objects.map((object) => (
                <div className="structure-row" key={`${object.schema}.${object.name}`}>
                  <strong>{object.schema}.{object.name}</strong>
                  <span>{object.type}</span>
                  <span>{object.modified}</span>
                </div>
              ))}
            </div>
          )}

          {activeResultTab === 'plan' && (
            <div className="plan-view">
              {result?.plan.map((step) => (
                <div className="plan-row" key={step.id}>
                  <span>{step.id}</span>
                  <strong>{step.operation}</strong>
                  <span>{step.object || 'result'}</span>
                  <span>cost {step.cost}</span>
                  <span>{step.rows} rows</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
