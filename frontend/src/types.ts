export type UserRole = 'APPLICANT' | 'REVIEWER'

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

/** UI-facing status; may differ from stored status for returned applications. */
export type DisplayStatus = ApplicationStatus | 'RETURNED'

export type ApplicationCategory = 'operations' | 'marketing' | 'it' | 'hr' | 'finance'

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
}

export interface Application {
  id: string
  owner_id: string
  title: string
  category: ApplicationCategory
  description: string | null
  amount: string | null
  requested_date: string | null
  file_name: string | null
  status: ApplicationStatus
  display_status: DisplayStatus
  created_at: string
  updated_at: string
  owner_email?: string | null
}

export interface AuditLog {
  id: string
  application_id: string
  actor_id: string
  actor_email?: string | null
  from_status: ApplicationStatus
  to_status: ApplicationStatus
  display_to_status?: DisplayStatus
  comment: string | null
  created_at: string
}

export function getAuditLogToDisplayStatus(log: AuditLog): DisplayStatus {
  if (log.display_to_status) {
    return log.display_to_status
  }
  if (
    log.to_status === 'DRAFT' &&
    (log.from_status === 'SUBMITTED' || log.from_status === 'UNDER_REVIEW') &&
    log.comment
  ) {
    return 'RETURNED'
  }
  return log.to_status
}

export function isReturnAuditLog(log: AuditLog): boolean {
  return getAuditLogToDisplayStatus(log) === 'RETURNED'
}

export interface ApiError {
  error: string
  code: string
  details?: unknown
}

export function formatApiError(error: unknown): string {
  if (error && typeof error === 'object' && 'error' in error) {
    return String((error as ApiError).error)
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Something went wrong'
}

export const CATEGORIES: { value: ApplicationCategory; label: string }[] = [
  { value: 'it', label: 'IT' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'operations', label: 'Operations' },
]

export function getCategoryLabel(category: ApplicationCategory): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category
}

export function formatCategoryDisplay(category: ApplicationCategory): string {
  return `Category: ${getCategoryLabel(category)}`
}

export function getDisplayStatus(app: Application): DisplayStatus {
  return app.display_status ?? app.status
}

export function isFreshDraft(app: Application): boolean {
  return app.status === 'DRAFT' && getDisplayStatus(app) === 'DRAFT'
}

export const STATUSES: ApplicationStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
]

export const REVIEWER_STATUSES: DisplayStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'RETURNED',
  'APPROVED',
  'REJECTED',
]

export const APPLICANT_STATUSES: DisplayStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'RETURNED',
  'APPROVED',
  'REJECTED',
]
