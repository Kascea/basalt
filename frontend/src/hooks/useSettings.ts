import { useEffect, useState } from 'react'
import { DatabaseService, type AppSettings } from '../../bindings/basalt/db'

const DENSITY_VARS: Record<string, Record<string, string>> = {
  compact:     { '--cell-height': '26px', '--cell-font-size': '12px' },
  normal:      { '--cell-height': '34px', '--cell-font-size': '13px' },
  comfortable: { '--cell-height': '42px', '--cell-font-size': '14px' },
}

export interface SettingsState {
  settings: AppSettings | null
  isLoading: boolean
  saveSettings: (s: AppSettings) => Promise<void>
}

function applyDensity(density: string) {
  const vars = DENSITY_VARS[density] ?? DENSITY_VARS.normal
  for (const [k, v] of Object.entries(vars)) {
    document.documentElement.style.setProperty(k, v)
  }
}

export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    DatabaseService.GetSettings()
      .then((s) => {
        setSettings(s)
        applyDensity(s.rowDensity)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const saveSettings = async (s: AppSettings) => {
    await DatabaseService.SaveSettings(s)
    setSettings(s)
    applyDensity(s.rowDensity)
  }

  return { settings, isLoading, saveSettings }
}
