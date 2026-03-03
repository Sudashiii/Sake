import React, { useState } from 'react';
import { Star, Loader2, AlertCircle, Inbox } from 'lucide-react';

// ─── Status Pill ────────────────────────────────────────────────
const statusStyles: Record<string, string> = {
  queued: 'bg-[#2a2d3a] text-[#a0aec0]',
  processing: 'bg-[#1a2a3a] text-[#60a5fa]',
  completed: 'bg-[#1a2a1a] text-[#4ade80]',
  failed: 'bg-[#2a1a1a] text-[#f87171]',
  unread: 'bg-[#2a2d3a] text-[#a0aec0]',
  reading: 'bg-[#2a2518] text-[#c9a962]',
  read: 'bg-[#1a2a1a] text-[#4ade80]',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs tracking-wide capitalize ${statusStyles[status] || 'bg-secondary text-secondary-foreground'}`}
    >
      {status === 'processing' && (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      )}
      {status}
    </span>
  );
}

// ─── Rating Stars ───────────────────────────────────────────────
export function RatingStars({
  rating,
  onChange,
  size = 16,
  readonly = false,
  clearable = false,
}: {
  rating: number;
  onChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
  clearable?: boolean;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'} transition-colors`}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => {
            if (clearable && star === rating) {
              onChange?.(0);
            } else {
              onChange?.(star);
            }
          }}
        >
          <Star
            size={size}
            className={`transition-colors ${
              star <= (hover || rating)
                ? 'fill-[#c9a962] text-[#c9a962]'
                : 'fill-transparent text-[#3a3d4a]'
            }`}
          />
        </button>
      ))}
      {clearable && rating > 0 && !readonly && (
        <button
          type="button"
          onClick={() => onChange?.(0)}
          className="ml-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────
export function ProgressBar({
  value,
  className = '',
  showLabel = false,
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-[#1e2230] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            background:
              value === 100
                ? '#4ade80'
                : 'linear-gradient(90deg, #c9a962, #e0c878)',
          }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground min-w-[32px] text-right">
          {value}%
        </span>
      )}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#1e2230] flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

// ─── Loading Spinner ───────────────────────────────────────────
export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={size} className="animate-spin text-primary" />
    </div>
  );
}

// ─── Error State ────────────────────────────────────────────────
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#2a1a1a] flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-destructive" />
      </div>
      <h3 className="text-foreground mb-1">Something went wrong</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity cursor-pointer"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

// ─── Format Badge ───────────────────────────────────────────────
const formatColors: Record<string, string> = {
  EPUB: 'bg-[#1a2a3a] text-[#60a5fa]',
  PDF: 'bg-[#2a1a2a] text-[#c084fc]',
  MOBI: 'bg-[#2a2518] text-[#c9a962]',
};

export function FormatBadge({ format }: { format: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] tracking-wider uppercase ${formatColors[format] || 'bg-secondary text-secondary-foreground'}`}
    >
      {format}
    </span>
  );
}