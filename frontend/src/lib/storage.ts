import type { Tab } from '../types'

export interface PersistedTabs {
  tabs: Tab[]
  activeTabId: string
  worksheetSQL: Record<string, string>
}

const KEYS = {
  tabs: 'basalt:tabs',
} as const

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function set<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export const storage = {
  tabs: {
    get: (): PersistedTabs | null => get<PersistedTabs | null>(KEYS.tabs, null),
    set: (v: PersistedTabs): void => set(KEYS.tabs, v),
  },
}
