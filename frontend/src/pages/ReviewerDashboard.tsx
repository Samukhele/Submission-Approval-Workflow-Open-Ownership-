import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Loading, Message } from '../components/Feedback'
import { REVIEWER_STAT_CARDS, StatCard } from '../components/StatCard'
import { formatApiError, getDisplayStatus, type Application, type DisplayStatus } from '../types'

function countByDisplayStatus(apps: Application[], status: DisplayStatus): number {
  return apps.filter((app) => getDisplayStatus(app) === status).length
}

export function ReviewerDashboard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['applications', 'review', 'dashboard'],
    queryFn: () => api.listApplications(),
    refetchOnMount: 'always',
  })

  if (isLoading) return <Loading />

  if (isError) {
    return (
      <div>
        <h1>Reviewer Dashboard</h1>
        <Message type="error" message={formatApiError(error)} />
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    )
  }

  const apps = data ?? []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reviewer Dashboard</h1>
          <p className="muted">Application status overview</p>
        </div>
        <Link to="/review/queue" className="btn-primary">
          Open review queue
        </Link>
      </div>

      <p className="section-title font-geist-mono dashboard-section-label">
        Application pipeline
      </p>

      <div className="grid-stats">
        {REVIEWER_STAT_CARDS.map((card) => (
          <StatCard
            key={card.status}
            {...card}
            value={countByDisplayStatus(apps, card.status)}
          />
        ))}
      </div>
    </div>
  )
}
