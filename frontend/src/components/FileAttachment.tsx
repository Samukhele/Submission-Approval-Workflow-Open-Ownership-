import { useState } from 'react'
import { api } from '../api/client'
import { formatApiError } from '../types'
import { Message } from './Feedback'

export function FileAttachment({
  applicationId,
  fileName,
}: {
  applicationId: string
  fileName: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<'view' | 'download' | null>(null)

  async function openFile(download: boolean) {
    setLoading(download ? 'download' : 'view')
    setError(null)
    try {
      const blob = await api.downloadFile(applicationId, download)
      const url = URL.createObjectURL(blob)
      if (download) {
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.click()
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="file-attachment">
      <p className="file-attachment-name" title={fileName}>
        {fileName}
      </p>
      <div className="action-row file-attachment-actions">
        <button
          type="button"
          className="button button-small button-primary"
          disabled={loading !== null}
          onClick={() => void openFile(false)}
        >
          {loading === 'view' ? 'Opening…' : 'View'}
        </button>
        <button
          type="button"
          className="button button-small"
          disabled={loading !== null}
          onClick={() => void openFile(true)}
        >
          {loading === 'download' ? 'Downloading…' : 'Download'}
        </button>
      </div>
      <Message type="error" message={error} />
    </div>
  )
}

export function AttachmentPanel({
  applicationId,
  fileName,
}: {
  applicationId: string
  fileName: string | null
}) {
  return (
    <section className="card attachment-card">
      <h2>Attachment</h2>
      {fileName ? (
        <>
          <p className="muted">File submitted by the applicant.</p>
          <FileAttachment applicationId={applicationId} fileName={fileName} />
        </>
      ) : (
        <p className="muted empty-attachment">No attachment was submitted with this application.</p>
      )}
    </section>
  )
}
