import React, { useState } from 'react';
import {
  X,
  Edit3,
  Save,
  Archive,
  ArchiveRestore,
  EyeOff,
  Eye,
  Trash2,
  Download,
  Calendar,
  FileText,
  Globe,
  Hash,
  Building,
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookMarked,
  Layers,
  Tag,
  Star,
  Users,
  Loader2,
  BookmarkPlus,
} from 'lucide-react';
import type { Book, DeviceDownload } from '../lib/mock-data';
import type { Shelf } from '../lib/mock-data';
import {
  RatingStars,
  ProgressBar,
  StatusPill,
  FormatBadge,
} from './ui-primitives';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner';

interface BookDetailModalProps {
  book: Book;
  onClose: () => void;
  onUpdate?: (book: Book) => void;
  shelves?: Shelf[];
  onToggleShelf?: (bookId: string, shelfId: string) => void;
}

type DetailTab = 'overview' | 'progress' | 'metadata' | 'devices';

const deviceIcons: Record<string, React.ElementType> = {
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  ereader: BookOpen,
};

export function BookDetailModal({
  book,
  onClose,
  onUpdate,
  shelves = [],
  onToggleShelf,
}: BookDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(book);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [showAllProgress, setShowAllProgress] = useState(false);
  const [refetching, setRefetching] = useState(false);

  const handleSave = () => {
    onUpdate?.(editData);
    setEditing(false);
  };

  const handleRefetchMetadata = () => {
    setRefetching(true);
    setTimeout(() => {
      setRefetching(false);
      toast.success('Metadata refreshed', {
        description: `Updated metadata for "${book.title}" from external sources.`,
      });
    }, 1500);
  };

  const handleRemoveDevice = (device: DeviceDownload) => {
    const updated = {
      ...editData,
      devices: editData.devices.filter((d) => d.id !== device.id),
    };
    setEditData(updated);
    onUpdate?.(updated);
    toast.success(`Removed download from ${device.deviceName}`);
  };

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'progress', label: 'Progress' },
    { key: 'metadata', label: 'Metadata' },
    { key: 'devices', label: `Devices (${editData.devices.length})` },
  ];

  // Quick metadata for overview
  const quickMeta = [
    { icon: Calendar, label: 'Year', value: editData.year },
    { icon: FileText, label: 'Pages', value: editData.pages },
    { icon: Globe, label: 'Language', value: editData.language },
  ];

  // Full metadata fields
  const allMetaFields = [
    { icon: Building, label: 'Publisher', key: 'publisher', value: editData.publisher },
    { icon: BookMarked, label: 'Series', key: 'series', value: editData.series || '—' },
    { icon: Layers, label: 'Volume', key: 'volume', value: editData.volume || '—' },
    { icon: Tag, label: 'Edition', key: 'edition', value: editData.edition || '—' },
    { icon: Hash, label: 'ISBN', key: 'isbn', value: editData.isbn },
    { icon: Hash, label: 'Identifier', key: 'identifier', value: editData.identifier || '—' },
    { icon: Calendar, label: 'Year', key: 'year', value: String(editData.year) },
    { icon: FileText, label: 'Pages', key: 'pages', value: String(editData.pages) },
    { icon: Globe, label: 'Language', key: 'language', value: editData.language },
    { icon: ExternalLink, label: 'Google Books ID', key: 'googleBooksId', value: editData.googleBooksId || '—' },
    { icon: ExternalLink, label: 'Open Library Key', key: 'openLibraryKey', value: editData.openLibraryKey || '—' },
    { icon: ExternalLink, label: 'Amazon ASIN', key: 'amazonAsin', value: editData.amazonAsin || '—' },
    { icon: Star, label: 'External Rating', key: 'externalRating', value: editData.externalRating ? `${editData.externalRating}/5` : '—' },
    { icon: Users, label: 'Rating Count', key: 'externalRatingCount', value: editData.externalRatingCount ? editData.externalRatingCount.toLocaleString() : '—' },
  ];

  const PREVIEW_PROGRESS_COUNT = 5;
  const progressEntries = book.progressHistory;
  const visibleProgress = showAllProgress
    ? progressEntries
    : progressEntries.slice(-PREVIEW_PROGRESS_COUNT);
  const hasMoreProgress = progressEntries.length > PREVIEW_PROGRESS_COUNT;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="truncate pr-4">Book Details</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefetchMetadata}
              disabled={refetching}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh metadata from external sources"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refetch</span>
            </button>
            {editing ? (
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border px-6 flex gap-1 shrink-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ─── OVERVIEW TAB ────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Cover */}
                <div className="shrink-0">
                  <ImageWithFallback
                    src={book.cover}
                    alt={book.title}
                    className="w-40 h-56 object-cover rounded-xl shadow-lg"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-4">
                  {editing ? (
                    <input
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-foreground"
                    />
                  ) : (
                    <h1>{book.title}</h1>
                  )}
                  {editing ? (
                    <input
                      value={editData.author}
                      onChange={(e) => setEditData({ ...editData, author: e.target.value })}
                      className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-muted-foreground"
                    />
                  ) : (
                    <p className="text-muted-foreground">{book.author}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <FormatBadge format={book.format} />
                    <StatusPill status={book.status} />
                    <span className="text-xs text-muted-foreground">{book.size}</span>
                    {book.series && (
                      <span className="text-xs text-muted-foreground">
                        {book.series}{book.volume ? ` #${book.volume}` : ''}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Rating</label>
                    <RatingStars
                      rating={editData.rating}
                      onChange={(r) => setEditData({ ...editData, rating: r })}
                      size={20}
                      readonly={!editing}
                      clearable={editing}
                    />
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted-foreground">Reading Progress</label>
                      <span className="text-xs text-foreground">{book.readingProgress}%</span>
                    </div>
                    <ProgressBar value={book.readingProgress} />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Description</label>
                {editing ? (
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={3}
                    className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
                  />
                ) : (
                  <p className="text-sm text-secondary-foreground leading-relaxed">{book.description}</p>
                )}
              </div>

              {/* Shelves */}
              {shelves.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-2">Shelves</label>
                  <div className="flex flex-wrap gap-2">
                    {shelves.map((shelf) => {
                      const isOnShelf = book.shelfIds?.includes(shelf.id);
                      return (
                        <button
                          key={shelf.id}
                          onClick={() => onToggleShelf?.(book.id, shelf.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
                            isOnShelf
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-secondary/30 border-border text-muted-foreground hover:text-foreground hover:border-border'
                          }`}
                        >
                          <span>{shelf.icon}</span>
                          {shelf.name}
                          {isOnShelf && <span className="text-[10px]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick metadata */}
              <div className="grid grid-cols-3 gap-3">
                {quickMeta.map((field) => (
                  <div key={field.label} className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <field.icon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{field.label}</span>
                    </div>
                    <p className="text-sm text-foreground">{String(field.value)}</p>
                  </div>
                ))}
              </div>

              {/* External rating */}
              {book.externalRating && (
                <div className="bg-secondary/30 rounded-lg p-3 flex items-center gap-3">
                  <Star className="w-4 h-4 text-[#c9a962]" />
                  <div>
                    <span className="text-sm text-foreground">{book.externalRating}/5</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({book.externalRatingCount?.toLocaleString()} ratings)
                    </span>
                  </div>
                </div>
              )}

              {/* State Controls */}
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer">
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button
                  onClick={() => {
                    const updated = { ...editData, archived: !editData.archived };
                    setEditData(updated);
                    onUpdate?.(updated);
                    toast.success(updated.archived ? 'Archived' : 'Unarchived');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
                >
                  {book.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  {book.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  onClick={() => {
                    const updated = { ...editData, excludeFromNew: !editData.excludeFromNew };
                    setEditData(updated);
                    onUpdate?.(updated);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
                >
                  {book.excludeFromNew ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {book.excludeFromNew ? 'Include in New' : 'Exclude from New'}
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 text-destructive rounded-lg text-sm hover:bg-destructive/20 transition-colors cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                  Move to Trash
                </button>
              </div>
            </div>
          )}

          {/* ─── PROGRESS TAB ────────────────────────────── */}
          {activeTab === 'progress' && (
            <div className="space-y-6">
              {/* Current progress */}
              <div className="bg-secondary/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3>Current Progress</h3>
                  <span className="text-2xl text-primary">{book.readingProgress}%</span>
                </div>
                <ProgressBar value={book.readingProgress} />
                {book.pages > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ~{Math.round(book.pages * book.readingProgress / 100)} of {book.pages} pages read
                  </p>
                )}
              </div>

              {/* Timeline */}
              {progressEntries.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs text-muted-foreground">
                      Progress History ({progressEntries.length} entries)
                    </label>
                    {hasMoreProgress && (
                      <button
                        onClick={() => setShowAllProgress(!showAllProgress)}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
                      >
                        {showAllProgress ? (
                          <>Show Less <ChevronUp className="w-3 h-3" /></>
                        ) : (
                          <>Show All ({progressEntries.length}) <ChevronDown className="w-3 h-3" /></>
                        )}
                      </button>
                    )}
                  </div>

                  {!showAllProgress && hasMoreProgress && (
                    <p className="text-xs text-muted-foreground mb-3 bg-secondary/30 rounded-lg px-3 py-2">
                      Showing last {PREVIEW_PROGRESS_COUNT} of {progressEntries.length} entries.
                    </p>
                  )}

                  <div className="relative pl-6 space-y-0">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                    {visibleProgress.map((entry, i) => {
                      const isLast = showAllProgress
                        ? i === progressEntries.length - 1
                        : i === visibleProgress.length - 1;
                      return (
                        <div key={`${entry.date}-${i}`} className="relative pb-4 last:pb-0">
                          <div
                            className={`absolute -left-[17px] w-2.5 h-2.5 rounded-full mt-1 border-2 ${
                              isLast
                                ? 'bg-primary border-primary'
                                : 'bg-card border-muted-foreground/30'
                            }`}
                          />
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">{entry.date}</span>
                              <span className="text-xs text-foreground">{entry.progress}%</span>
                            </div>
                            <ProgressBar value={entry.progress} className="mb-1.5" />
                            <div className="flex items-center gap-3">
                              {entry.pagesRead && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {entry.pagesRead}
                                </span>
                              )}
                              {entry.note && (
                                <span className="text-xs text-secondary-foreground italic">
                                  {entry.note}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No progress history yet.</p>
                </div>
              )}
            </div>
          )}

          {/* ─── METADATA TAB ────────────────────────────── */}
          {activeTab === 'metadata' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3>All Metadata</h3>
                <button
                  onClick={handleRefetchMetadata}
                  disabled={refetching}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {refetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Enrich from Sources
                </button>
              </div>

              {/* Cover */}
              <div className="bg-secondary/30 rounded-lg p-3">
                <label className="text-xs text-muted-foreground block mb-2">Cover</label>
                <div className="flex items-center gap-3">
                  <ImageWithFallback
                    src={book.cover}
                    alt={book.title}
                    className="w-12 h-16 object-cover rounded-lg"
                  />
                  <span className="text-xs text-muted-foreground break-all line-clamp-2">{book.cover}</span>
                </div>
              </div>

              {/* Description */}
              <div className="bg-secondary/30 rounded-lg p-3">
                <label className="text-xs text-muted-foreground block mb-2">Description</label>
                {editing ? (
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={4}
                    className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
                  />
                ) : (
                  <p className="text-sm text-secondary-foreground leading-relaxed">{book.description}</p>
                )}
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allMetaFields.map((field) => (
                  <div key={field.label} className="bg-secondary/30 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <field.icon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{field.label}</span>
                    </div>
                    {editing && field.key && !['externalRating', 'externalRatingCount'].includes(field.key) ? (
                      <input
                        value={(editData as any)[field.key] ?? ''}
                        onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                        className="w-full bg-input-background border border-border rounded px-2 py-1 text-sm text-foreground"
                      />
                    ) : (
                      <p className="text-sm text-foreground truncate" title={field.value}>
                        {field.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── DEVICES TAB ─────────────────────────────── */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3>Downloaded Devices</h3>
                <span className="text-xs text-muted-foreground">
                  {editData.devices.length} device{editData.devices.length !== 1 ? 's' : ''}
                </span>
              </div>

              {editData.devices.length === 0 ? (
                <div className="text-center py-8">
                  <Smartphone className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No device downloads tracked.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {editData.devices.map((device) => {
                    const DeviceIcon = deviceIcons[device.deviceType] || Smartphone;
                    return (
                      <div
                        key={device.id}
                        className="bg-secondary/30 rounded-lg p-3 flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <DeviceIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{device.deviceName}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {device.deviceType} &middot; Downloaded {new Date(device.downloadedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveDevice(device)}
                          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                          title="Remove device download"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}