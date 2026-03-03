import React, { useState } from 'react';
import { Archive, ArchiveRestore } from 'lucide-react';
import { mockBooks, type Book } from '../lib/mock-data';
import {
  RatingStars,
  FormatBadge,
  StatusPill,
  ProgressBar,
  EmptyState,
} from '../components/ui-primitives';
import { BookDetailModal } from '../components/book-detail-modal';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { toast } from 'sonner';

export function ArchivedPage() {
  const [archivedBooks, setArchivedBooks] = useState(
    mockBooks.filter((b) => b.archived)
  );
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const handleUnarchive = (book: Book, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchivedBooks(archivedBooks.filter((b) => b.id !== book.id));
    toast.success(`"${book.title}" restored to library`);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-foreground">Archived</h2>
        <p className="text-sm text-muted-foreground">
          {archivedBooks.length} archived book{archivedBooks.length !== 1 ? 's' : ''}.
          These books are hidden from your main library view.
        </p>
      </div>

      {/* Archived items */}
      {archivedBooks.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="No archived books"
          description="Books you archive will appear here. Archive books to hide them from your main library without deleting them."
        />
      ) : (
        <div className="space-y-2">
          {archivedBooks.map((book) => (
            <button
              key={book.id}
              onClick={() => setSelectedBook(book)}
              className="w-full bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-all text-left cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <ImageWithFallback
                  src={book.cover}
                  alt={book.title}
                  className="w-12 h-16 object-cover rounded-lg shrink-0 opacity-70"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground">{book.author}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <FormatBadge format={book.format} />
                    <StatusPill status={book.status} />
                    <span className="text-xs text-muted-foreground">{book.size}</span>
                    <RatingStars rating={book.rating} size={11} readonly />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      Added {new Date(book.addedAt).toLocaleDateString()}
                    </span>
                    {book.readingProgress > 0 && (
                      <div className="w-24">
                        <ProgressBar value={book.readingProgress} showLabel />
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => handleUnarchive(book, e)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Unarchive</span>
                  </button>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Book Detail Modal */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onUpdate={(updated) => {
            if (!updated.archived) {
              setArchivedBooks(archivedBooks.filter((b) => b.id !== updated.id));
              toast.success(`"${updated.title}" restored to library`);
            } else {
              setArchivedBooks(archivedBooks.map((b) => (b.id === updated.id ? updated : b)));
            }
            setSelectedBook(null);
          }}
        />
      )}
    </div>
  );
}
