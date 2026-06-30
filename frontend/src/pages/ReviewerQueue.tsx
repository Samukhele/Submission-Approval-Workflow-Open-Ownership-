import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { EmptyState, Loading } from '../components/Feedback'
import { StatusBadge } from '../components/StatusBadge'
import {
  CATEGORIES,
  formatApiError,
  formatCategoryDisplay,
  getDisplayStatus,
  REVIEWER_STATUSES,
  type ApplicationCategory,
  type DisplayStatus,
} from '../types'

const STATUS_LABELS: Record<DisplayStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  RETURNED: 'Returned',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

function getEmptyMessage(status: DisplayStatus | ''): string {
  if (status === 'SUBMITTED') return 'No applications newly submitted.'
  if (status === 'RETURNED') return 'No applications returned for changes.'
  return 'No applications match this filter.'
}

export function ReviewerQueue() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = (searchParams.get('status') as DisplayStatus | null) ?? 'SUBMITTED'
  const categoryFilter = searchParams.get('category') as ApplicationCategory | null

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['applications', 'review', statusFilter, categoryFilter],
    queryFn: () =>
      api.listApplications({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      }),
    refetchOnMount: 'always',
  })

  function updateFilters(updates: { status?: DisplayStatus | ''; category?: ApplicationCategory | '' }) {
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

  if (isLoading) return <Loading />

  return (
    <div>
      <div className="page-header">
        <div>
          <Link className="muted" to="/review">
            ← Dashboard
          </Link>
          <h1>{statusFilter ? STATUS_LABELS[statusFilter] : 'Review queue'}</h1>
        </div>
        <div className="page-header-filters">
          <div className="filter-group">
            <label className="filter-label" htmlFor="status-filter">
              Filter by status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) =>
                updateFilters({ status: e.target.value as DisplayStatus | '' })
              }
            >
              <option value="">All submitted</option>
              {REVIEWER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label" htmlFor="category-filter">
              Filter by category
            </label>
            <select
              id="category-filter"
              value={categoryFilter ?? ''}
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
        </div>
      </div>

      {isError ? (
        <div className="message message-error" role="alert">
          <p>{formatApiError(error)}</p>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : !data?.length ? (
        <EmptyState text={getEmptyMessage(statusFilter)} />
      ) : (
        <ul className="app-list">
          {data.map((app) => (
            <li key={app.id}>
              <div className="app-list-item">
                <Link to={`/applications/${app.id}`} className="app-list-link">
                  <div>
                    <strong>{app.title}</strong>
                    <p className="muted">
                      {app.owner_email ?? 'Unknown'} · {formatCategoryDisplay(app.category)}
                    </p>
                  </div>
                  <StatusBadge status={getDisplayStatus(app)} />
                </Link>
                <Link to={`/applications/${app.id}`} className="btn-secondary btn-sm">
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
