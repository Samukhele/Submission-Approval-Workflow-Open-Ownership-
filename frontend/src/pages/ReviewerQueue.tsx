import { useState } from 'react'

import { Link } from 'react-router-dom'

import { useQuery } from '@tanstack/react-query'

import { api } from '../api/client'

import { EmptyState, Loading } from '../components/Feedback'

import { StatusBadge } from '../components/StatusBadge'

import {

  formatApiError,

  formatCategoryDisplay,

  REVIEWER_STATUSES,

  type ApplicationStatus,

} from '../types'



export function ReviewerQueue() {

  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('SUBMITTED')



  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({

    queryKey: ['applications', 'review', statusFilter],

    queryFn: () => api.listApplications(statusFilter || undefined),

    refetchOnMount: 'always',

  })



  if (isLoading) return <Loading />



  return (

    <div>

      <div className="page-header">

        <h1>Reviewer Queue</h1>

        <label className="filter-label" htmlFor="status-filter">

          Filter by status

        </label>

        <select

          id="status-filter"

          value={statusFilter}

          onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | '')}

        >

          <option value="">All submitted</option>

          {REVIEWER_STATUSES.map((s) => (

            <option key={s} value={s}>

              {s.replace('_', ' ')}

            </option>

          ))}

        </select>

      </div>



      {isError ? (

        <div className="message message-error" role="alert">

          <p>{formatApiError(error)}</p>

          <button

            type="button"

            className="button button-small"

            disabled={isFetching}

            onClick={() => void refetch()}

          >

            {isFetching ? 'Retrying…' : 'Retry'}

          </button>

        </div>

      ) : !data?.length ? (

        <EmptyState text="No applications match this filter." />

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

                  <StatusBadge status={app.status} />

                </Link>

                <Link

                  to={`/applications/${app.id}`}

                  className="button button-small"

                >

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


