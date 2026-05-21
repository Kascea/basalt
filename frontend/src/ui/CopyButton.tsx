import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import styles from './copyButton.module.css'

interface Props {
  text: string
  title?: string
  label?: string
}

export function CopyButton({ text, title = 'Copy', label = 'Copy' }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      className={`compact-btn toolbar-btn${copied ? ` ${styles.copySuccess}` : ''}`}
      onClick={copy}
      title={title}
    >
      {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2.5} />}
      {copied ? 'Copied' : label}
    </button>
  )
}
