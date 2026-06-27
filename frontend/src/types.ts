export type UserRole = 'APPLICANT' | 'REVIEWER'

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export type ApplicationCategory = 'operations' | 'marketing' | 'it' | 'hr'

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
  comment: string | null
  created_at: string
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
  { value: 'operations', label: 'Operations' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'it', label: 'IT' },
  { value: 'hr', label: 'HR' },
]

export function getCategoryLabel(category: ApplicationCategory): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category
}

export function formatCategoryDisplay(category: ApplicationCategory): string {
  return `Category: ${getCategoryLabel(category)}`
}

export const STATUSES: ApplicationStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
]

export const REVIEWER_STATUSES: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
]
