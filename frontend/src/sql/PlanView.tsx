import styles from './PlanView.module.css'

interface PlanNode {
  type: 'node'
  depth: number
  operation: string
  detail: string
  costStart: number
  costTotal: number
  estimatedRows: number
}

interface PlanCondition {
  type: 'condition'
  depth: number
  label: string
  value: string
}

interface PlanRaw {
  type: 'raw'
  depth: number
  text: string
}

type PlanLine = PlanNode | PlanCondition | PlanRaw

// ── Parser ────────────────────────────────────────────────────────────────────

const COST_RE = /^(.*?)\s*\(cost=(\d+\.?\d*)\.\.(\d+\.?\d*)\s+rows=(\d+)\s+width=\d+\)/
const COND_RE = /^([A-Za-z][A-Za-z\s]*):\s*(.+)$/

function parseLine(raw: string): PlanLine {
  const leadingSpaces = raw.match(/^(\s*)/)?.[1].length ?? 0
  const trimmed = raw.trim()
  const isArrow = trimmed.startsWith('->')
  const content = isArrow ? trimmed.slice(2).trim() : trimmed
  const depth = Math.floor(leadingSpaces / 4) + (isArrow ? 0 : leadingSpaces > 0 ? 1 : 0)

  const costMatch = content.match(COST_RE)
  if (costMatch) {
    const opText = costMatch[1].trim()
    // Split "operation on table" or "operation using index on table"
    const usingMatch = opText.match(/^(.+?)\s+using\s+(\S+)\s+on\s+(\S+)/)
    const onMatch = !usingMatch ? opText.match(/^(.+?)\s+on\s+(\S+)/) : null
    let operation = opText
    let detail = ''
    if (usingMatch) {
      operation = usingMatch[1]
      detail = `using ${usingMatch[2]} on ${usingMatch[3]}`
    } else if (onMatch) {
      operation = onMatch[1]
      detail = `on ${onMatch[2]}`
    }
    return {
      type: 'node',
      depth: isArrow ? depth : 0,
      operation,
      detail,
      costStart: parseFloat(costMatch[2]),
      costTotal: parseFloat(costMatch[3]),
      estimatedRows: parseInt(costMatch[4]),
    }
  }

  const condMatch = content.match(COND_RE)
  if (condMatch) {
    return {
      type: 'condition',
      depth: Math.floor(leadingSpaces / 4),
      label: condMatch[1].trim(),
      value: condMatch[2].trim(),
    }
  }

  return { type: 'raw', depth: 0, text: trimmed }
}

// ── Operation classification ───────────────────────────────────────────────────

type OpClass = 'scan-seq' | 'scan-index' | 'join' | 'sort' | 'other'

function classifyOp(op: string): OpClass {
  const lower = op.toLowerCase()
  if (lower.includes('seq scan')) return 'scan-seq'
  if (lower.includes('index')) return 'scan-index'
  if (lower.includes('join') || lower.includes('nested loop') || lower.includes('merge')) return 'join'
  if (lower.includes('sort') || lower.includes('aggregate') || lower.includes('limit')) return 'sort'
  return 'other'
}

const OP_LABELS: Record<OpClass, string> = {
  'scan-seq': 'Seq Scan',
  'scan-index': 'Index',
  'join': 'Join',
  'sort': 'Sort',
  'other': 'Op',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRows(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtCost(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  lines: string[]
}

export function PlanView({ lines }: Props) {
  const parsed = lines.map(parseLine)

  return (
    <div className={styles.planView}>
      {parsed.map((line, i) => {
        if (line.type === 'node') {
          const cls = classifyOp(line.operation)
          return (
            <div
              key={i}
              className={`${styles.node} ${styles[cls]}`}
              style={{ paddingLeft: 16 + line.depth * 24 }}
            >
              <div className={styles.nodeMain}>
                <span className={`${styles.badge} ${styles[`badge-${cls}`]}`}>
                  {OP_LABELS[cls]}
                </span>
                <span className={styles.operation}>{line.operation}</span>
                {line.detail && <span className={styles.detail}>{line.detail}</span>}
              </div>
              <div className={styles.metrics}>
                <span className={styles.metric} title="Estimated startup..total cost">
                  cost {fmtCost(line.costStart)}‥{fmtCost(line.costTotal)}
                </span>
                <span className={styles.metric} title="Planner estimate — may differ from actual row count. Run ANALYZE to refresh statistics.">
                  est. {fmtRows(line.estimatedRows)} rows
                </span>
              </div>
            </div>
          )
        }

        if (line.type === 'condition') {
          return (
            <div
              key={i}
              className={styles.condition}
              style={{ paddingLeft: 16 + line.depth * 24 + 28 }}
            >
              <span className={styles.condLabel}>{line.label}:</span>
              <span className={styles.condValue}>{line.value}</span>
            </div>
          )
        }

        return (
          <div key={i} className={styles.rawLine}>{line.text}</div>
        )
      })}
    </div>
  )
}
