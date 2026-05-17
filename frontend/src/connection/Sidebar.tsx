import { Window } from '@wailsio/runtime'
import { DatabaseIcon, Plus } from 'lucide-react'
import { ConnectionTree } from './ConnectionTree'
import { useConnectionSession } from './ConnectionContext'

interface Props {
  showSettings: boolean
  onSettingsToggle: () => void
}

export function Sidebar({ showSettings, onSettingsToggle }: Props) {
  const { onNewConnection } = useConnectionSession()

  return (
    <aside className="sidebar">
      <div className="brand-row" onDoubleClick={() => Window.ToggleMaximise()}>
        <img className="brand-mark" src="/logo-64.png" alt="basalt" />
        <span className="brand-name">basalt</span>
      </div>

      <div className="tree-root">
        <ConnectionTree />
        <button className="tree-node conn-node new-connection-row" onClick={onNewConnection}>
          <span className="chevron" />
          <span className="node-icon"><DatabaseIcon size={13} /></span>
          <span className="node-label">New Connection</span>
          <Plus size={11} strokeWidth={2.5} className="new-connection-plus" />
        </button>
      </div>

      <div className="sidebar-footer">
        <button
          className={`sidebar-footer-btn${showSettings ? ' is-active' : ''}`}
          title="Settings"
          onClick={onSettingsToggle}
        >
          ⚙ Settings
        </button>
      </div>
    </aside>
  )
}
