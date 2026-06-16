'use client'

import { useEffect, useRef } from 'react'

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement>

// A textarea that grows with its content so long text never gets clipped or
// scrolled out of view. Starts at one row and expands as you type.
export default function AutoGrowTextarea({ value, className, onInput, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Resize whenever the value changes (typing, paste, or external reset).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onInput={(e) => {
        const el = e.currentTarget
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
        onInput?.(e)
      }}
      className={`resize-none overflow-hidden ${className ?? ''}`}
      {...rest}
    />
  )
}
