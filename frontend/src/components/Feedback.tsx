interface MessageProps {
  type?: 'error' | 'success' | 'info'
  message: string | null
}

export function Message({ type = 'info', message }: MessageProps) {
  if (!message) return null
  return (
    <div className={`message message-${type}`} role="alert" aria-live="polite">
      {message}
    </div>
  )
}

export function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      Loading…
    </div>
  )
}

export function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>
}
