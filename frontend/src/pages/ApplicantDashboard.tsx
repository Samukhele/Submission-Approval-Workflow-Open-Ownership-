import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { EmptyState, Loading, Message } from '../components/Feedback'
import { StatusBadge } from '../components/StatusBadge'
import {
  APPLICANT_STATUSES,
  CATEGORIES,
  formatCategoryDisplay,
  getDisplayStatus,
  isFreshDraft,
  type Application,
  type ApplicationCategory,
  type DisplayStatus,
} from '../types'

const STATUS_LABELS: Record<DisplayStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  RETURNED: 'Returned for changes',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

function getEmptyMessage(
  statusFilter: DisplayStatus | '',
  categoryFilter: ApplicationCategory | '',
): string {
  if (statusFilter || categoryFilter) {
    return 'No applications match this filter.'
  }
  return 'You have no applications yet. Create your first draft.'
}

export function ApplicantDashboard() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = (searchParams.get('status') as DisplayStatus | null) ?? ''
  const categoryFilter = (searchParams.get('category') as ApplicationCategory | null) ?? ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['applications', 'mine', statusFilter, categoryFilter],
    queryFn: () =>
      api.listApplications({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      }),
  })

  const submitMutation = useMutation({
    mutationFn: (appId: string) => api.submitApplication(appId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
  })

  function updateFilters(updates: {
    status?: DisplayStatus | ''
    category?: ApplicationCategory | ''
  }) {
    const next = new URLSearchParams(searchParams)

    if (updates.status !== undefined) {
      if (updates.status) next.set('status', updates.status)
      else next.delete('status')
    }

    if (updates.category !== undefined) {
      if (updates.category) next.set('category', updates.category)
      else next.delete('category')
    }

    setSearchParams(next)
  }

  async function handleQuickSubmit(app: Application) {
    if (!app.amount && !app.requested_date) {
      window.alert('Add an amount or requested date on the draft before submitting.')
      return
    }
    submitMutation.mutate(app.id)
  }

  function renderActions(app: Application) {
    const display = getDisplayStatus(app)

    if (display === 'RETURNED') {
      return (
        <Link to={`/applications/${app.id}`} className="btn-primary btn-sm">
          Revise &amp; Submit
        </Link>
      )
    }

    if (isFreshDraft(app)) {
      return (
        <>
          <Link to={`/applications/${app.id}`} className="btn-secondary btn-sm">
            View
          </Link>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={submitMutation.isPending}
            onClick={() => void handleQuickSubmit(app)}
          >
            Submit
          </button>
        </>
      )
    }

    return (
      <Link to={`/applications/${app.id}`} className="btn-secondary btn-sm">
        Track status
      </Link>
    )
  }

  if (isLoading) return <Loading />

  const errorMessage =
    error && typeof error === 'object' && 'error' in error
      ? String((error as { error: string }).error)
      : error
        ? 'Failed to load applications'
        : null

  const hasFilters = Boolean(statusFilter || categoryFilter)

  return (
    <div>
      <div className="page-header">
        <h1>My Applications</h1>
        <Link className="btn-primary" to="/applications/new">
          New application
        </Link>
      </div>

      <Message type="error" message={errorMessage} />

      <p className="muted dashboard-hint">
        Open submitted applications with <strong>Track status</strong> to follow reviewer
        updates. Returned applications offer <strong>Revise &amp; Submit</strong> to read
        feedback, update, and resubmit.
      </p>

      <div className="dashboard-filters">
        <div className="filter-group">
          <label className="filter-label" htmlFor="applicant-status-filter">
            Filter by status
          </label>
          <select
            id="applicant-status-filter"
            value={statusFilter}
            onChange={(e) =>
              updateFilters({ status: e.target.value as DisplayStatus | '' })
            }
          >
            <option value="">All statuses</option>
            {APPLICANT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="applicant-category-filter">
            Filter by category
          </label>
          <select
            id="applicant-category-filter"
            value={categoryFilter}
            onChange={(e) =>
              updateFilters({ category: e.target.value as ApplicationCategory | '' })
            }
          >
            <option value="">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        {hasFilters && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => updateFilters({ status: '', category: '' })}
          >
            Clear filters
          </button>
        )}
      </div>

      {!data?.length ? (
        <EmptyState text={getEmptyMessage(statusFilter, categoryFilter)} />
      ) : (
        <ul className="app-list">
          {data.map((app) => (
            <li key={app.id}>
              <div className="app-list-item">
                <Link to={`/applications/${app.id}`} className="app-list-link">
                  <div>
                    <strong>{app.title}</strong>
                    <p className="muted">{formatCategoryDisplay(app.category)}</p>
                  </div>
                  <StatusBadge status={getDisplayStatus(app)} />
                </Link>
                {renderActions(app)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
