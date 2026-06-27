import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { EmptyState, Loading, Message } from '../components/Feedback'
import { StatusBadge } from '../components/StatusBadge'
import { formatCategoryDisplay, type Application } from '../types'

export function ApplicantDashboard() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['applications', 'mine'],
    queryFn: () => api.listApplications(),
  })

  const submitMutation = useMutation({
    mutationFn: (appId: string) => api.submitApplication(appId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
  })

  async function handleQuickSubmit(app: Application) {
    if (!app.amount && !app.requested_date) {
      window.alert('Add an amount or requested date on the draft before submitting.')
      return
    }
    submitMutation.mutate(app.id)
  }

  if (isLoading) return <Loading />

  const errorMessage =
    error && typeof error === 'object' && 'error' in error
      ? String((error as { error: string }).error)
      : error
        ? 'Failed to load applications'
        : null

  return (
    <div>
      <div className="page-header">
        <h1>My Applications</h1>
        <Link className="button" to="/applications/new">
          New application
        </Link>
      </div>

      <Message type="error" message={errorMessage} />

      <p className="muted dashboard-hint">
        Open any submitted application with <strong>Track status</strong> to follow
        reviewer updates and comments.
      </p>

      {!data?.length ? (
        <EmptyState text="You have no applications yet. Create your first draft." />
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
                  <StatusBadge status={app.status} />
                </Link>
                <Link
                  to={`/applications/${app.id}`}
                  className="button button-small"
                >
                  {app.status === 'DRAFT' ? 'View' : 'Track status'}
                </Link>
                {app.status === 'DRAFT' && (
                  <button
                    type="button"
                    className="button button-small button-primary"
                    disabled={submitMutation.isPending}
                    onClick={() => void handleQuickSubmit(app)}
                  >
                    Submit
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
