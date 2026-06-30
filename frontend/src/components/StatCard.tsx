import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DisplayStatus } from '../types'

interface StatCardProps {
  label: string
  subtitle: string
  value: number
  status: DisplayStatus
  icon: LucideIcon
  accent?: 'default' | 'success' | 'warning' | 'error' | 'purple'
}

const ACCENT_COLOR: Record<NonNullable<StatCardProps['accent']>, string> = {
  default: 'var(--ds-primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  purple: 'var(--status-purple)',
}

export const REVIEWER_STAT_CARDS: Omit<StatCardProps, 'value'>[] = [
  {
    label: 'Submitted',
    subtitle: 'Awaiting review',
    status: 'SUBMITTED',
    icon: Send,
    accent: 'warning',
  },
  {
    label: 'Under review',
    subtitle: 'In progress',
    status: 'UNDER_REVIEW',
    icon: Clock,
    accent: 'purple',
  },
  {
    label: 'Returned',
    subtitle: 'Sent back for changes',
    status: 'RETURNED',
    icon: RotateCcw,
    accent: 'warning',
  },
  {
    label: 'Approved',
    subtitle: 'Completed',
    status: 'APPROVED',
    icon: CheckCircle2,
    accent: 'success',
  },
  {
    label: 'Rejected',
    subtitle: 'Declined',
    status: 'REJECTED',
    icon: XCircle,
    accent: 'error',
  },
]

export function StatCard({
  label,
  subtitle,
  value,
  status,
  icon: Icon,
  accent = 'default',
}: StatCardProps) {
  const accentColor = ACCENT_COLOR[accent]

  return (
    <Link
      to={`/review/queue?status=${status}`}
      className="stat-card card card-clickable"
      style={{ '--stat-accent': accentColor } as React.CSSProperties}
    >
      <div className="stat-card-header">
        <div className="stat-card-icon" aria-hidden>
          <Icon size={16} />
        </div>
        <div>
          <p className="stat-card-label font-geist-mono">{label}</p>
          <p className="stat-card-subtitle font-geist-mono">{subtitle}</p>
        </div>
      </div>
      <p className="stat-card-value">{value}</p>
      <p className="stat-card-hint font-geist-mono">
        {value === 0 ? 'No applications' : 'View in queue →'}
      </p>
    </Link>
  )
}
