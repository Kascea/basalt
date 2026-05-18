// Wails serializes Go errors in several shapes depending on the transport path:
//   1. Plain object:  { message: "human text", cause: {}, kind: "RuntimeError" }
//   2. Error instance whose .message is the JSON envelope above
//   3. String like "Error: {json}" or "RuntimeError: {json}"
// This function normalizes all three into a plain human-readable string.
export function parseError(err: unknown): string {
  if (err == null) return 'Unknown error'

  // Shape 1: plain object thrown by Wails (message is already the Go error text)
  if (typeof err === 'object' && !Array.isArray(err)) {
    const obj = err as Record<string, unknown>
    if (obj.kind === 'RuntimeError' && typeof obj.message === 'string') {
      return capitalize(obj.message)
    }
  }

  // Shape 2: Error instance — .message may be the JSON envelope
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message)
      if (parsed && typeof parsed.message === 'string') return capitalize(parsed.message)
    } catch { /* message is plain text, fall through */ }
    return capitalize(err.message)
  }

  // Shape 3: stringified form — strip "Error:" / "RuntimeError:" prefix then try JSON
  const raw = String(err).replace(/^(?:RuntimeError|Error):\s*/, '')
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.message === 'string') return capitalize(parsed.message)
  } catch { /* not JSON */ }
  return capitalize(raw)
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}
