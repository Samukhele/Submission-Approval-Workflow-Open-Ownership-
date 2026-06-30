import type { AuditLog } from '../types'
import { getAuditLogToDisplayStatus } from '../types'
import { StatusBadge } from './StatusBadge'

export function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return <p className="muted">No status changes recorded yet.</p>
  }

  return (
    <ol className="audit-timeline" aria-label="Audit trail">
      {logs.map((log) => (
        <li key={log.id}>
          <div className="audit-header">
            <strong>{log.actor_email ?? 'Unknown user'}</strong>
            <time dateTime={log.created_at}>
              {new Date(log.created_at).toLocaleString()}
            </time>
          </div>
          <div className="audit-transition">
            <StatusBadge status={log.from_status} />
            <span aria-hidden="true">→</span>
            <StatusBadge status={getAuditLogToDisplayStatus(log)} />
          </div>
          {log.comment && <p className="audit-comment">{log.comment}</p>}
        </li>
      ))}
    </ol>
  )
}
