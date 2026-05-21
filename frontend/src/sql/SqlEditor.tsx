import { useMemo, useState, useEffect, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql, SQLite, PostgreSQL, MySQL, MSSQL, StandardSQL, keywordCompletionSource, schemaCompletionSource } from '@codemirror/lang-sql'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { autocompletion } from '@codemirror/autocomplete'
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { GetTableColumns } from '../../bindings/basalt/db/databaseservice'
import type { SchemaObject, ColumnInfo } from '../../bindings/basalt/db'

const basaltEditorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: '#0d0e0f', color: '#d0d2d5' },
  '.cm-scroller': { fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', fontSize: '13px', lineHeight: '23px' },
  '.cm-content': { caretColor: '#4183c4', padding: '8px 0' },
  '.cm-cursor': { borderLeftColor: '#4183c4' },
  '.cm-activeLine': { backgroundColor: '#111213' },
  '.cm-activeLineGutter': { backgroundColor: '#111213' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(65, 131, 196, 0.35) !important' },
  '.cm-gutters': { backgroundColor: '#0d0e0f', color: '#585f68', border: 'none', borderRight: '1px solid #2e3033' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px' },
  '.cm-tooltip': { backgroundColor: '#212325', border: '1px solid #2e3033', borderRadius: '4px' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: '#2f3234', color: '#d0d2d5' },
  '.cm-completionMatchedText': { textDecoration: 'none', color: '#4183c4', fontWeight: 'bold' },
}, { dark: true })

const basaltHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#4183c4' },
  { tag: t.string, color: '#2a8f6e' },
  { tag: t.number, color: '#c9803a' },
  { tag: t.comment, color: '#585f68', fontStyle: 'italic' },
  { tag: t.typeName, color: '#5194d6' },
  { tag: t.operator, color: '#888e96' },
  { tag: t.punctuation, color: '#888e96' },
  { tag: t.name, color: '#d0d2d5' },
  { tag: t.function(t.name), color: '#d0d2d5' },
])

function getDialect(driver: string | undefined) {
  switch (driver?.toLowerCase()) {
    case 'postgres':
    case 'postgresql':
      return PostgreSQL
    case 'sqlite':
    case 'sqlite3':
      return SQLite
    case 'mysql':
      return MySQL
    case 'sqlserver':
    case 'mssql':
      return MSSQL
    default:
      return StandardSQL
  }
}

type SchemaMap = Record<string, readonly (string | Completion)[]>

// Suggests all column names from all tables anywhere the user types.
// schemaCompletionSource only surfaces columns after "table." so this fills that gap.
function allColumnsSource(schemaMap: SchemaMap) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w+/)
    if (!word || (word.from === word.to && !context.explicit)) return null

    const seen = new Set<string>()
    const options: Completion[] = []
    for (const cols of Object.values(schemaMap)) {
      for (const col of cols) {
        const label = typeof col === 'string' ? col : (col as Completion).label
        if (!seen.has(label)) {
          seen.add(label)
          options.push(typeof col === 'string' ? { label: col, type: 'property' } : col as Completion)
        }
      }
    }

    if (!options.length) return null
    return { from: word.from, options, validFor: /^\w*$/ }
  }
}

interface Props {
  value: string
  connectionId?: string
  driver?: string
  objects: SchemaObject[]
  readOnly?: boolean
  onChange?: (value: string) => void
}

export function SqlEditor({ value, connectionId, driver, objects, readOnly, onChange }: Props) {
  const [columnOverrides, setColumnOverrides] = useState<Record<string, Completion[]>>({})
  const fetchKeyRef = useRef('')

  useEffect(() => {
    if (!connectionId) { setColumnOverrides({}); return }

    const tableObjects = objects.filter(obj => {
      const type = obj.type.toLowerCase()
      return type === 'table' || type.includes('view')
    })
    if (tableObjects.length === 0) { setColumnOverrides({}); return }

    const fetchKey = `${connectionId}:${tableObjects.map(o => `${o.schema}.${o.name}`).join(',')}`
    if (fetchKey === fetchKeyRef.current) return
    fetchKeyRef.current = fetchKey

    let cancelled = false
    Promise.all(
      tableObjects.map(obj =>
        GetTableColumns(connectionId, obj.schema, obj.name)
          .then(cols => ({ obj, cols }))
          .catch(() => ({ obj, cols: [] as ColumnInfo[] }))
      )
    ).then(results => {
      if (cancelled) return
      const overrides: Record<string, Completion[]> = {}
      for (const { obj, cols } of results) {
        const completions: Completion[] = cols.map((col: ColumnInfo) => ({
          label: col.name,
          type: 'property',
          detail: col.dataType,
        }))
        overrides[obj.name] = completions
        if (obj.schema) overrides[`${obj.schema}.${obj.name}`] = completions
      }
      setColumnOverrides(overrides)
    })

    return () => { cancelled = true }
  }, [connectionId, objects])

  // Table names always built synchronously; columns overlaid when available.
  const schemaMap = useMemo<SchemaMap>(() => {
    const map: SchemaMap = {}
    for (const obj of objects) {
      const type = obj.type.toLowerCase()
      if (type === 'table' || type.includes('view')) {
        map[obj.name] = columnOverrides[obj.name] ?? []
        if (obj.schema) map[`${obj.schema}.${obj.name}`] = columnOverrides[obj.name] ?? []
      }
    }
    return map
  }, [objects, columnOverrides])

  const extensions = useMemo(() => {
    const dialect = getDialect(driver)
    const exts = [
      sql({ dialect }),
      basaltEditorTheme,
      syntaxHighlighting(basaltHighlightStyle),
      EditorView.lineWrapping,
    ]
    if (readOnly) {
      exts.push(EditorState.readOnly.of(true))
    } else {
      exts.push(autocompletion({
        override: [
          keywordCompletionSource(dialect),
          schemaCompletionSource({ schema: schemaMap, dialect }),
          allColumnsSource(schemaMap),
        ],
      }))
    }
    return exts
  }, [driver, schemaMap, readOnly])

  return (
    <CodeMirror
      value={value}
      theme="none"
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      height="100%"
      style={{ height: '100%' }}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: !readOnly,
        highlightSelectionMatches: true,
        autocompletion: false,
        syntaxHighlighting: false,
      }}
    />
  )
}
