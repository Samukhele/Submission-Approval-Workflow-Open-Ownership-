import type { ApplicationStatus, AuditLog } from '../types'

interface PipelineStep {
  key: string
  label: string
  state: 'pending' | 'active' | 'completed' | 'rejected' | 'approved' | 'skipped'
}

function wasUnderReview(auditLogs: AuditLog[]): boolean {
  return auditLogs.some(
    (log) => log.to_status === 'UNDER_REVIEW' || log.from_status === 'UNDER_REVIEW',
  )
}

function wasSubmitted(auditLogs: AuditLog[]): boolean {
  return auditLogs.some((log) => log.to_status === 'SUBMITTED')
}

export function getPipelineSteps(
  status: ApplicationStatus,
  auditLogs: AuditLog[],
): PipelineStep[] | null {
  if (status === 'DRAFT' && !wasSubmitted(auditLogs)) {
    return null
  }

  const visitedReview = wasUnderReview(auditLogs)
  const outcomeLabel =
    status === 'APPROVED'
      ? 'Approved'
      : status === 'REJECTED'
        ? 'Rejected'
        : 'Approved / Rejected'

  const submittedState = (): PipelineStep['state'] => {
    if (status === 'SUBMITTED') return 'active'
    if (status === 'DRAFT') return wasSubmitted(auditLogs) ? 'completed' : 'pending'
    return 'completed'
  }

  const reviewState = (): PipelineStep['state'] => {
    if (status === 'UNDER_REVIEW') return 'active'
    if (status === 'SUBMITTED') return 'pending'
    if (status === 'DRAFT') return visitedReview ? 'completed' : 'pending'
    if ((status === 'APPROVED' || status === 'REJECTED') && !visitedReview) {
      return 'skipped'
    }
    return 'completed'
  }

  const outcomeState = (): PipelineStep['state'] => {
    if (status === 'APPROVED') return 'approved'
    if (status === 'REJECTED') return 'rejected'
    return 'pending'
  }

  return [
    { key: 'submitted', label: 'Submitted', state: submittedState() },
    { key: 'under_review', label: 'Under Review', state: reviewState() },
    { key: 'outcome', label: outcomeLabel, state: outcomeState() },
  ]
}

export function StatusPipeline({
  status,
  auditLogs,
}: {
  status: ApplicationStatus
  auditLogs: AuditLog[]
}) {
  const steps = getPipelineSteps(status, auditLogs)

  if (!steps) {
    return (
      <div className="status-pipeline" aria-label="Application status pipeline">
        <div className="pipeline-step active">
          <span className="pipeline-dot" />
          <span className="pipeline-label">Draft</span>
        </div>
      </div>
    )
  }

  return (
    <div className="status-pipeline" aria-label="Application status pipeline">
      {steps.map((step, index) => (
        <div key={step.key} className="pipeline-segment">
          <div className={`pipeline-step ${step.state}`}>
            <span className="pipeline-dot" />
            <span className="pipeline-label">{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`pipeline-connector ${
                step.state === 'completed' ||
                step.state === 'active' ||
                step.state === 'approved' ||
                step.state === 'rejected'
                  ? 'pipeline-connector-done'
                  : ''
              }`}
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  )
}
