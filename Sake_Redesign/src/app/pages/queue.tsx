import React, { useState } from 'react';
import {
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ListOrdered,
  RotateCcw,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { mockQueue, type QueueItem } from '../lib/mock-data';
import { StatusPill, ProgressBar, EmptyState } from '../components/ui-primitives';
import { toast } from 'sonner';

type TabType = 'all' | 'queued' | 'processing' | 'completed' | 'failed';

const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All', icon: ListOrdered },
  { key: 'queued', label: 'Queued', icon: Clock },
  { key: 'processing', label: 'Processing', icon: Loader2 },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'failed', label: 'Failed', icon: AlertCircle },
];

export function QueuePage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [queue, setQueue] = useState(mockQueue);

  const filtered =
    activeTab === 'all'
      ? queue
      : queue.filter((item) => item.status === activeTab);

  const counts = {
    all: queue.length,
    queued: queue.filter((i) => i.status === 'queued').length,
    processing: queue.filter((i) => i.status === 'processing').length,
    completed: queue.filter((i) => i.status === 'completed').length,
    failed: queue.filter((i) => i.status === 'failed').length,
  };

  const handleRetry = (item: QueueItem) => {
    setQueue(
      queue.map((q) =>
        q.id === item.id
          ? { ...q, status: 'queued' as const, retries: q.retries + 1, error: undefined, updatedAt: new Date().toISOString() }
          : q
      )
    );
    toast.success(`Retrying "${item.bookTitle}"`);
  };

  const handleRemove = (item: QueueItem) => {
    setQueue(queue.filter((q) => q.id !== item.id));
    toast.success(`Removed "${item.bookTitle}" from queue`);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-4 h-4 text-[#a0aec0]" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-[#60a5fa] animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-[#f87171]" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'In Queue', value: counts.queued, color: 'text-[#a0aec0]' },
          { label: 'Processing', value: counts.processing, color: 'text-[#60a5fa]' },
          { label: 'Completed', value: counts.completed, color: 'text-[#4ade80]' },
          { label: 'Failed', value: counts.failed, color: 'text-[#f87171]' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-2xl ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? 'bg-primary/10 text-primary'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Queue items */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="Queue is empty"
          description="Search for books and add them to your download queue."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`bg-card border rounded-xl p-4 transition-all ${
                item.status === 'failed' ? 'border-destructive/20' : 'border-border'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{statusIcon(item.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-foreground truncate">{item.bookTitle}</p>
                    <StatusPill status={item.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{item.author}</p>

                  {item.status === 'processing' && item.progress !== undefined && (
                    <div className="mt-2">
                      <ProgressBar value={item.progress} showLabel />
                    </div>
                  )}

                  {item.error && (
                    <p className="mt-2 text-xs text-destructive bg-destructive/5 px-2 py-1.5 rounded-lg">
                      {item.error}
                    </p>
                  )}

                  {/* Timestamp details */}
                  <div className="mt-2 bg-secondary/20 rounded-lg px-3 py-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Created</span>
                        <p className="text-xs text-secondary-foreground">{formatDateTime(item.createdAt)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Updated</span>
                        <p className="text-xs text-secondary-foreground">{formatDateTime(item.updatedAt)}</p>
                      </div>
                      {item.finishedAt && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Finished</span>
                          <p className="text-xs text-secondary-foreground">{formatDateTime(item.finishedAt)}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Retries</span>
                        <p className="text-xs text-secondary-foreground">
                          {item.retries}/{item.maxRetries}
                          {item.retries >= item.maxRetries && item.status === 'failed' && (
                            <span className="text-destructive ml-1">(max reached)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(item)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                      title="Retry"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(item)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
