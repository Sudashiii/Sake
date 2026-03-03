import React, { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Clock } from 'lucide-react';
import { mockTrashedBooks, type Book } from '../lib/mock-data';
import { FormatBadge, EmptyState } from '../components/ui-primitives';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { toast } from 'sonner';

export function TrashPage() {
  const [trashedBooks, setTrashedBooks] = useState(mockTrashedBooks);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmptyAll, setConfirmEmptyAll] = useState(false);

  const handleRestore = (book: (typeof trashedBooks)[0]) => {
    setTrashedBooks(trashedBooks.filter((b) => b.id !== book.id));
    toast.success(`"${book.title}" restored to library`);
  };

  const handlePermanentDelete = (book: (typeof trashedBooks)[0]) => {
    setTrashedBooks(trashedBooks.filter((b) => b.id !== book.id));
    setConfirmDeleteId(null);
    toast.success(`"${book.title}" permanently deleted`);
  };

  const handleEmptyTrash = () => {
    setTrashedBooks([]);
    setConfirmEmptyAll(false);
    toast.success('Trash emptied');
  };

  const getDaysUntilDeletion = (deletesAt: string) => {
    const now = new Date('2026-02-28');
    const deleteDate = new Date(deletesAt);
    const diffMs = deleteDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground">Trash</h2>
          <p className="text-sm text-muted-foreground">
            {trashedBooks.length} item{trashedBooks.length !== 1 ? 's' : ''} in trash.
            Items are permanently deleted after 30 days.
          </p>
        </div>
        {trashedBooks.length > 0 && (
          <button
            onClick={() => setConfirmEmptyAll(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 text-destructive rounded-lg text-sm hover:bg-destructive/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Empty Trash
          </button>
        )}
      </div>

      {/* Empty all confirmation */}
      {confirmEmptyAll && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-foreground">
              Permanently delete all {trashedBooks.length} items?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This action cannot be undone.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEmptyTrash}
                className="px-3 py-1.5 bg-destructive text-white rounded-lg text-sm hover:opacity-90 transition-opacity cursor-pointer"
              >
                Delete All
              </button>
              <button
                onClick={() => setConfirmEmptyAll(false)}
                className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trashed items */}
      {trashedBooks.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          description="Items you delete will appear here before being permanently removed."
        />
      ) : (
        <div className="space-y-2">
          {trashedBooks.map((book) => {
            const daysLeft = getDaysUntilDeletion(book.deletesAt);
            const isUrgent = daysLeft <= 7;
            return (
              <div
                key={book.id}
                className="bg-card border border-border rounded-xl p-4 hover:border-border/80 transition-all"
              >
                <div className="flex items-center gap-4">
                  <ImageWithFallback
                    src={book.cover}
                    alt={book.title}
                    className="w-12 h-16 object-cover rounded-lg shrink-0 opacity-60"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{book.title}</p>
                    <p className="text-xs text-muted-foreground">{book.author}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <FormatBadge format={book.format} />
                      <span className="text-xs text-muted-foreground">{book.size}</span>
                    </div>
                    {/* Trash date info */}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">
                        Trashed {new Date(book.trashedAt).toLocaleDateString()}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs ${isUrgent ? 'text-[#f87171]' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3" />
                        {daysLeft > 0
                          ? `Deletes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
                          : 'Scheduled for deletion'}
                        <span className="text-muted-foreground/60">
                          ({new Date(book.deletesAt).toLocaleDateString()})
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRestore(book)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Restore</span>
                    </button>
                    {confirmDeleteId === book.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePermanentDelete(book)}
                          className="px-3 py-2 bg-destructive text-white rounded-lg text-sm hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(book.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
