import type { DisplayStatus } from '../types'

const STATUS_LABELS: Record<DisplayStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  RETURNED: 'Returned for changes',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const cssClass =
    status === 'RETURNED' ? 'returned' : status.toLowerCase()
  return <span className={`badge badge-${cssClass}`}>{STATUS_LABELS[status]}</span>
}
