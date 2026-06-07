'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

type ToastTone = 'success' | 'error' | 'info'

type ToastInput = {
  title?: string
  message: string
  tone?: ToastTone
}

type ToastItem = ToastInput & {
  id: number
  tone: ToastTone
}

type ToastContextValue = {
  showToast: (input: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return context
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((input: ToastInput) => {
    const id = nextId.current++
    const toast: ToastItem = {
      id,
      tone: input.tone || 'info',
      title: input.title,
      message: input.message,
    }

    setToasts((current) => [...current, toast])
    window.setTimeout(() => dismissToast(id), 3400)
  }, [dismissToast])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <div className="toast-copy">
              {toast.title ? <div className="toast-title">{toast.title}</div> : null}
              <div className="toast-message">{toast.message}</div>
            </div>
            <button type="button" className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
