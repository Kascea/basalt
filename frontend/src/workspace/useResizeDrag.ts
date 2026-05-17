import { useState, useRef, useCallback } from 'react'

export function useResizeDrag(initial: number, min: number, max: number) {
  const [size, setSize] = useState(initial)
  const sizeRef = useRef(initial)
  sizeRef.current = size

  const startDrag = useCallback(
    (e: React.MouseEvent, axis: 'x' | 'y', invert = false) => {
      e.preventDefault()
      const startPos = axis === 'x' ? e.clientX : e.clientY
      const startSize = sizeRef.current

      const onMove = (me: MouseEvent) => {
        const pos = axis === 'x' ? me.clientX : me.clientY
        const delta = invert ? startPos - pos : pos - startPos
        setSize(Math.min(max, Math.max(min, startSize + delta)))
      }

      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [min, max],
  )

  return [size, startDrag] as const
}
