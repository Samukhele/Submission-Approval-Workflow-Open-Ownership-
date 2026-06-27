import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { AuditTimeline } from '../components/AuditTimeline'
import { FileAttachment, AttachmentPanel } from '../components/FileAttachment'
import { EmptyState, Loading, Message } from '../components/Feedback'
import { StatusBadge } from '../components/StatusBadge'
import { StatusPipeline } from '../components/StatusPipeline'
import { CATEGORIES, getCategoryLabel, type ApplicationCategory } from '../types'

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState<ApplicationCategory>('it')
  const [editDescription, setEditDescription] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const appQuery = useQuery({
    queryKey: ['application', id],
    queryFn: () => api.getApplication(id!),
    enabled: !!id,
    refetchOnMount: 'always',
  })

  const auditQuery = useQuery({
    queryKey: ['audit', id],
    queryFn: () => api.getAuditLogs(id!),
    enabled: !!id,
    refetchOnMount: 'always',
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['application', id] })
    void queryClient.invalidateQueries({ queryKey: ['audit', id] })
    void queryClient.invalidateQueries({ queryKey: ['applications'] })
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateApplication(id!, {
        title: editTitle,
        category: editCategory,
        description: editDescription || null,
        amount: editAmount ? Number(editAmount) : null,
        requested_date: editDate || null,
      }),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Draft updated.' })
      invalidate()
    },
    onError: (err) => {
      setMessage({
        type: 'error',
        text:
          err && typeof err === 'object' && 'error' in err
            ? String((err as { error: string }).error)
            : 'Update failed',
      })
    },
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      await api.updateApplication(id!, {
        title: editTitle,
        category: editCategory,
        description: editDescription || null,
        amount: editAmount ? Number(editAmount) : null,
        requested_date: editDate || null,
      })
      return api.submitApplication(id!)
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Application submitted for review.' })
      invalidate()
    },
    onError: (err) => {
      setMessage({
        type: 'error',
        text:
          err && typeof err === 'object' && 'error' in err
            ? String((err as { error: string }).error)
            : 'Submit failed',
      })
    },
  })

  const transitionMutation = useMutation({
    mutationFn: ({ action, comment: c }: { action: string; comment?: string }) =>
      api.transitionApplication(id!, action, c),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Status updated.' })
      setComment('')
      invalidate()
    },
    onError: (err) => {
      setMessage({
        type: 'error',
        text:
          err && typeof err === 'object' && 'error' in err
            ? String((err as { error: string }).error)
            : 'Action failed',
      })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadFile(id!, file),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'File uploaded.' })
      invalidate()
    },
    onError: (err) => {
      setMessage({
        type: 'error',
        text:
          err && typeof err === 'object' && 'error' in err
            ? String((err as { error: string }).error)
            : 'Upload failed',
      })
    },
  })

  const app = appQuery.data

  useEffect(() => {
    if (!app) return
    setEditTitle(app.title)
    setEditCategory(app.category)
    setEditDescription(app.description ?? '')
    setEditAmount(app.amount ?? '')
    setEditDate(app.requested_date ?? '')
  }, [app])

  if (appQuery.isLoading) return <Loading />

  const loadError =
    appQuery.error && typeof appQuery.error === 'object' && 'error' in appQuery.error
      ? String((appQuery.error as { error: string }).error)
      : appQuery.error
        ? 'Failed to load application'
        : null

  if (loadError || !app) {
    return (
      <div>
        <Message type="error" message={loadError ?? 'Application not found'} />
        <div className="action-row">
          <button type="button" onClick={() => void appQuery.refetch()}>
            Retry
          </button>
          <Link to={user?.role === 'REVIEWER' ? '/review' : '/'}>Back to list</Link>
        </div>
      </div>
    )
  }

  const isOwner =
    !!user?.id &&
    !!app.owner_id &&
    user.id.toLowerCase() === app.owner_id.toLowerCase()
  const isDraft = app.status === 'DRAFT'
  const canEdit = user?.role === 'APPLICANT' && isOwner && isDraft
  const canSubmit =
    canEdit && !!(editAmount || editDate || app.amount || app.requested_date)
  const canReview =
    user?.role === 'REVIEWER' &&
    (app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW')
  const isApplicantOwner = user?.role === 'APPLICANT' && isOwner
  const auditLogs = auditQuery.data ?? []
  const latestReturnComment = [...auditLogs]
    .reverse()
    .find((log) => log.to_status === 'DRAFT' && log.from_status !== 'DRAFT')?.comment

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    updateMutation.mutate()
  }

  function runTransition(action: string, needsComment = false) {
    setMessage(null)
    if (needsComment && !comment.trim()) {
      setMessage({ type: 'error', text: 'A comment is required for this action.' })
      return
    }
    transitionMutation.mutate({ action, comment: comment || undefined })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link className="muted" to={user?.role === 'REVIEWER' ? '/review' : '/'}>
            ← Back
          </Link>
          <h1>{app.title}</h1>
          <StatusBadge status={app.status} />
        </div>
      </div>

      <Message type={message?.type ?? 'info'} message={message?.text ?? null} />

      <section className="card pipeline-card">
        <h2>Application pipeline</h2>
        <p className="muted">The highlighted step shows where this application is right now.</p>
        <StatusPipeline status={app.status} auditLogs={auditLogs} />
      </section>

      {!canEdit && <AttachmentPanel applicationId={app.id} fileName={app.file_name} />}

      {isApplicantOwner && !isDraft && (
        <section className="card status-summary">
          <h2>Your application status</h2>
          <p className="muted">
            Current status: <StatusBadge status={app.status} />
          </p>
          {app.status === 'SUBMITTED' && (
            <p>Your application has been submitted and is waiting for a reviewer.</p>
          )}
          {app.status === 'UNDER_REVIEW' && (
            <p>A reviewer is currently assessing your application.</p>
          )}
          {app.status === 'APPROVED' && (
            <p className="status-message-success">Your application has been approved.</p>
          )}
          {app.status === 'REJECTED' && (
            <p className="status-message-error">
              Your application was rejected. See the status history below for the
              reviewer&apos;s comment.
            </p>
          )}
        </section>
      )}

      {isApplicantOwner && isDraft && latestReturnComment && (
        <section className="card status-summary returned-notice">
          <h2>Returned for changes</h2>
          <p className="status-message-error">
            A reviewer returned this application. Please update it and submit again.
          </p>
          <p className="audit-comment">
            <strong>Reviewer comment:</strong> {latestReturnComment}
          </p>
        </section>
      )}

      {isApplicantOwner && !isDraft && (
        <section className="card">
          <h2>Status history</h2>
          <p className="muted">Track every update made to your application.</p>
          {auditQuery.isLoading ? (
            <Loading />
          ) : auditLogs.length ? (
            <AuditTimeline logs={auditLogs} />
          ) : (
            <EmptyState text="No status changes recorded yet." />
          )}
        </section>
      )}

      <section className="card detail-grid">
        <div>
          <h2>Details</h2>
          {canEdit ? (
            <form onSubmit={handleEditSubmit} className="form-card">
              <label htmlFor="edit-title">Title</label>
              <input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
              <label htmlFor="edit-category">Category</label>
              <select
                id="edit-category"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as ApplicationCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label htmlFor="edit-description">Description</label>
              <textarea
                id="edit-description"
                rows={4}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
              <label htmlFor="edit-amount">Amount</label>
              <input
                id="edit-amount"
                type="number"
                min="0"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
              <label htmlFor="edit-date">Requested date</label>
              <input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
              <label htmlFor="edit-file">Attachment</label>
              {app.file_name && (
                <div className="current-attachment">
                  <p className="muted">Current file:</p>
                  <FileAttachment applicationId={app.id} fileName={app.file_name} />
                </div>
              )}
              <input
                id="edit-file"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadMutation.mutate(f)
                }}
              />
              <p className="muted">Upload a PDF, DOC, DOCX, PNG, or JPG (max 10 MB).</p>
              <button type="submit" disabled={updateMutation.isPending}>
                Save changes
              </button>
              <p className="muted submit-hint">
                Add an amount or requested date before submitting for review.
              </p>
              <button
                type="button"
                className="button-primary"
                disabled={submitMutation.isPending || !canSubmit}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? 'Submitting…' : 'Submit for review'}
              </button>
            </form>
          ) : (
            <dl className="detail-list">
              <dt>Category</dt>
              <dd>{getCategoryLabel(app.category)}</dd>
              <dt>Description</dt>
              <dd>{app.description || '—'}</dd>
              <dt>Amount</dt>
              <dd>{app.amount ?? '—'}</dd>
              <dt>Requested date</dt>
              <dd>{app.requested_date ?? '—'}</dd>
              <dt>Owner</dt>
              <dd>{app.owner_email ?? app.owner_id}</dd>
            </dl>
          )}
        </div>

        {canReview && (
          <div className="reviewer-panel">
            <h2>Reviewer actions</h2>
            <p className="muted">
              Review this submission and put it on hold, reject it, or approve it.
            </p>
            <label htmlFor="review-comment">Comment (required for reject / return)</label>
            <textarea
              id="review-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="action-row">
              {(app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW') && (
                <>
                  {app.status === 'SUBMITTED' && (
                    <button
                      type="button"
                      onClick={() => runTransition('start_review')}
                      disabled={transitionMutation.isPending}
                    >
                      Put under review
                    </button>
                  )}
                  <button
                    type="button"
                    className="button-success"
                    onClick={() => runTransition('approve')}
                    disabled={transitionMutation.isPending}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => runTransition('reject', true)}
                    disabled={transitionMutation.isPending || !comment.trim()}
                  >
                    Reject
                  </button>
                  {app.status === 'UNDER_REVIEW' && (
                    <button
                      type="button"
                      onClick={() => runTransition('return', true)}
                      disabled={transitionMutation.isPending || !comment.trim()}
                    >
                      Return for changes
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {!(isApplicantOwner && !isDraft) && (
        <section className="card">
          <h2>{isApplicantOwner ? 'Status history' : 'Audit trail'}</h2>
          {isApplicantOwner && (
            <p className="muted">Track every update made to your application.</p>
          )}
          {auditQuery.isLoading ? (
            <Loading />
          ) : auditLogs.length ? (
            <AuditTimeline logs={auditLogs} />
          ) : (
            <EmptyState text="No audit entries yet." />
          )}
        </section>
      )}
    </div>
  )
}
