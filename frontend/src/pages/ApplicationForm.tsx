import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api/client'
import { Message } from '../components/Feedback'
import { CATEGORIES, type ApplicationCategory } from '../types'

export function ApplicationForm() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ApplicationCategory>('it')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [requestedDate, setRequestedDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title,
        category,
        description: description || null,
      }
      if (amount) payload.amount = Number(amount)
      if (requestedDate) payload.requested_date = requestedDate

      const app = await api.createApplication(payload)
      if (file) {
        await api.uploadFile(app.id, file)
      }
      return app
    },
    onSuccess: (app) => {
      setSuccess('Draft created successfully.')
      navigate(`/applications/${app.id}`)
    },
    onError: (err) => {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error: string }).error)
          : 'Failed to create application'
      setError(message)
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    createMutation.mutate()
  }

  return (
    <div>
      <h1>New Application</h1>
      <form className="card form-card" onSubmit={handleSubmit}>
        <Message type="error" message={error} />
        <Message type="success" message={success} />

        <label htmlFor="title">Title *</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <label htmlFor="category">Category *</label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ApplicationCategory)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label htmlFor="amount">Amount</label>
        <input
          id="amount"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <label htmlFor="requested_date">Requested date</label>
        <input
          id="requested_date"
          type="date"
          value={requestedDate}
          onChange={(e) => setRequestedDate(e.target.value)}
        />

        <label htmlFor="file">Attachment (PDF, DOC, DOCX, PNG, JPG)</label>
        <input
          id="file"
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <p className="muted">
            Selected: <strong>{file.name}</strong> — will be uploaded when you save the draft.
          </p>
        )}

        <p className="muted">Provide at least an amount or a date before submitting.</p>

        <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Saving…' : 'Save draft'}
        </button>
      </form>
    </div>
  )
}
