// Column category classifies a DB type string into a coarse input-handling category.
// This is the single source of truth — DataGrid consumes it for keystroke filtering
// and any future validation logic should extend it here rather than in components.

export type ColumnCategory = 'numeric' | 'boolean' | 'text'

const NUMERIC_TYPES = new Set([
  'INT2', 'INT4', 'INT8', 'INT', 'INTEGER', 'SMALLINT', 'BIGINT',
  'FLOAT4', 'FLOAT8', 'REAL', 'DOUBLE PRECISION',
  'NUMERIC', 'DECIMAL', 'MONEY',
  'OID', 'XID', 'CID',
])

const BOOL_TYPES = new Set(['BOOL', 'BOOLEAN'])

export function colCategory(dbType: string): ColumnCategory {
  const upper = dbType.toUpperCase()
  if (NUMERIC_TYPES.has(upper)) return 'numeric'
  if (BOOL_TYPES.has(upper)) return 'boolean'
  return 'text'
}

export function isKeyAllowed(key: string, category: ColumnCategory, currentValue: string): boolean {
  if (category === 'text') return true
  if (key.length > 1) return true
  if (category === 'boolean') {
    return ['t', 'f', 'T', 'F', '1', '0'].includes(key)
  }
  if (category === 'numeric') {
    if (/[0-9]/.test(key)) return true
    if (key === '-' && currentValue === '') return true
    if (key === '.' && !currentValue.includes('.')) return true
    if (key === 'e' && !currentValue.includes('e') && !currentValue.includes('E')) return true
    return false
  }
  return true
}
