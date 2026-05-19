import { useState, useCallback, useRef } from 'react'
import type { LogEntry } from './types'

export function useStatusLog(): [LogEntry[], (msg: string, isSuccess?: boolean) => void] {
  const [statusLog, setStatusLog] = useState<LogEntry[]>(() => [{
    id: 0,
    ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
    text: 'Ready — no active connection',
    isError: false,
  }])

  const logIdRef = useRef(1)
  const addStatus = useCallback((msg: string, isSuccess = false) => {
    const id = logIdRef.current++
    setStatusLog(prev => [...prev, {
      id,
      ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
      text: msg,
      isError: msg.startsWith('Error:'),
      isSuccess,
    }])
  }, [])

  return [statusLog, addStatus]
}
