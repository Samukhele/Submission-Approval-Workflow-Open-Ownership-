import type { ApplicationStatus } from '../types'

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>
}
