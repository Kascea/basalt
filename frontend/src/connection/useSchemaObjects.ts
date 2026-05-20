import { useEffect, useState } from 'react'
import { parseError } from '../lib/parseError'

interface UseSchemaObjectsOptions<TItem, TForm> {
  connectionID: string
  schema: string
  onStatus: (msg: string) => void
  onLoad: () => Promise<TItem[]>
  onDrop: (item: TItem) => Promise<void>
  onCreate: (form: TForm) => Promise<void>
  defaultForm: () => TForm
  dropConfirmMessage: (item: TItem) => string
  dropStatusMessage: (item: TItem) => string
  createStatusMessage: (form: TForm) => string
  canDrop?: (item: TItem) => string | null
}

export interface SchemaObjectsState<TItem, TForm> {
  items: TItem[]
  isLoading: boolean
  showCreate: boolean
  form: TForm
  isSubmitting: boolean
  load: () => void
  setForm: (patch: Partial<TForm>) => void
  openCreate: () => void
  closeCreate: () => void
  handleDrop: (item: TItem) => void
  handleCreate: (e: React.FormEvent) => void
}

export function useSchemaObjects<TItem, TForm>(
  opts: UseSchemaObjectsOptions<TItem, TForm>,
): SchemaObjectsState<TItem, TForm> {
  const { connectionID, schema, onStatus, onLoad, onDrop, onCreate, defaultForm,
          dropConfirmMessage, dropStatusMessage, createStatusMessage, canDrop } = opts

  const [items, setItems] = useState<TItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setFormState] = useState<TForm>(defaultForm)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = () => {
    setIsLoading(true)
    onLoad()
      .then(setItems)
      .catch((err) => onStatus(parseError(err)))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { load() }, [connectionID, schema])

  const setForm = (patch: Partial<TForm>) =>
    setFormState((prev) => ({ ...prev, ...patch }))

  const openCreate = () => {
    setFormState(defaultForm())
    setShowCreate(true)
  }

  const closeCreate = () => setShowCreate(false)

  const handleDrop = (item: TItem) => {
    if (canDrop) {
      const reason = canDrop(item)
      if (reason) { onStatus(reason); return }
    }
    if (!confirm(dropConfirmMessage(item))) return
    onDrop(item)
      .then(() => { onStatus(dropStatusMessage(item)); load() })
      .catch((err) => onStatus(parseError(err)))
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    onCreate(form)
      .then(() => { onStatus(createStatusMessage(form)); setShowCreate(false); load() })
      .catch((err) => onStatus(parseError(err)))
      .finally(() => setIsSubmitting(false))
  }

  return { items, isLoading, showCreate, form, isSubmitting,
           load, setForm, openCreate, closeCreate, handleDrop, handleCreate }
}
