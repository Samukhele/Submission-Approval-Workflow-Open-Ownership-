import type { ApplicationStatus, AuditLog, DisplayStatus } from '../types'
import { isReturnAuditLog } from '../types'

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

function isReturnedApplication(
  displayStatus: DisplayStatus | undefined,
  status: ApplicationStatus,
  auditLogs: AuditLog[],
): boolean {
  if (displayStatus === 'RETURNED') return true
  if (status !== 'DRAFT' || !wasSubmitted(auditLogs)) return false
  return auditLogs.some(isReturnAuditLog)
}

export function getPipelineSteps(
  status: ApplicationStatus,
  auditLogs: AuditLog[],
  displayStatus?: DisplayStatus,
): PipelineStep[] | null {
  if (status === 'DRAFT' && !wasSubmitted(auditLogs)) {
    return null
  }

  const isReturned = isReturnedApplication(displayStatus, status, auditLogs)
  const visitedReview = wasUnderReview(auditLogs)
  const outcomeLabel =
    status === 'APPROVED'
      ? 'Approved'
      : status === 'REJECTED'
        ? 'Rejected'
        : 'Approved / Rejected'

  const submittedState = (): PipelineStep['state'] => {
    if (isReturned) return 'completed'
    if (status === 'SUBMITTED') return 'active'
    if (status === 'DRAFT') return wasSubmitted(auditLogs) ? 'completed' : 'pending'
    return 'completed'
  }

  const reviewState = (): PipelineStep['state'] => {
    if (isReturned) return 'completed'
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

  const steps: PipelineStep[] = [
    { key: 'submitted', label: 'Submitted', state: submittedState() },
  ]

  const showReviewStep =
    !isReturned || visitedReview || status === 'UNDER_REVIEW'

  if (showReviewStep) {
    steps.push({
      key: 'under_review',
      label: 'Under Review',
      state: reviewState(),
    })
  }

  if (isReturned) {
    steps.push({ key: 'returned', label: 'Returned', state: 'active' })
  }

  steps.push({ key: 'outcome', label: outcomeLabel, state: outcomeState() })

  return steps
}

function connectorIsDone(state: PipelineStep['state']): boolean {
  return (
    state === 'completed' ||
    state === 'active' ||
    state === 'approved' ||
    state === 'rejected'
  )
}

export function StatusPipeline({
  status,
  auditLogs,
  displayStatus,
}: {
  status: ApplicationStatus
  auditLogs: AuditLog[]
  displayStatus?: DisplayStatus
}) {
  const steps = getPipelineSteps(status, auditLogs, displayStatus)

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
                connectorIsDone(step.state) ? 'pipeline-connector-done' : ''
              }`}
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  )
}
