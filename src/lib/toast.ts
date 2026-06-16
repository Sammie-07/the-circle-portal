// Lightweight global toast. Any client component can call toast('Saved') to
// show a confirmation without prop-drilling or context — it dispatches a window
// event that the <Toaster/> mounted in the root layout renders.
export type ToastType = 'success' | 'error'

export interface ToastDetail {
  id: string
  message: string
  type: ToastType
}

export function toast(message: string, type: ToastType = 'success') {
  if (typeof window === 'undefined') return
  const detail: ToastDetail = {
    id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    message,
    type,
  }
  window.dispatchEvent(new CustomEvent('circle-toast', { detail }))
}
