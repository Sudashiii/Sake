import React, { useState, useRef } from 'react';
import { useSearchParams } from 'react-router';
import {
  Grid3X3,
  List,
  Search,
  SlidersHorizontal,
  BookOpen,
  ChevronDown,
  ArrowUpDown,
  Upload,
  X,
  FileUp,
  Loader2,
  BookmarkPlus,
} from 'lucide-react';
import { mockBooks, type Book } from '../lib/mock-data';
import type { RuleGroup, RuleNode, ShelfCondition } from '../lib/mock-data';
import { countConditions } from '../lib/mock-data';
import { useShelves } from '../lib/shelves-context';
import {
  RatingStars,
  ProgressBar,
  StatusPill,
  FormatBadge,
  EmptyState,
} from '../components/ui-primitives';
import { BookDetailModal } from '../components/book-detail-modal';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { toast } from 'sonner';

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'unread' | 'reading' | 'read';
type SortOption = 'date-added' | 'title-az' | 'recent-progress';

const sortLabels: Record<SortOption, string> = {
  'date-added': 'Date Added',
  'title-az': 'Title A–Z',
  'recent-progress': 'Recent Progress',
};

// ─── Rule evaluation engine ─────────────────────────────────────
function evaluateCondition(book: Book, cond: ShelfCondition): boolean {
  const raw = book[cond.field as keyof Book];
  if (raw === undefined || raw === null) return false;

  const bookStr = String(raw).toLowerCase();
  const ruleStr = cond.value.toLowerCase();
  const bookNum = Number(raw);
  const ruleNum = Number(cond.value);
  const isNumeric = !isNaN(bookNum) && !isNaN(ruleNum);

  switch (cond.operator) {
    case 'equals':
      return bookStr === ruleStr;
    case 'not_equals':
      return bookStr !== ruleStr;
    case 'contains':
      return bookStr.includes(ruleStr);
    case 'not_contains':
      return !bookStr.includes(ruleStr);
    case 'gt':
      return isNumeric && bookNum > ruleNum;
    case 'lt':
      return isNumeric && bookNum < ruleNum;
    case 'gte':
      return isNumeric && bookNum >= ruleNum;
    case 'lte':
      return isNumeric && bookNum <= ruleNum;
    default:
      return false;
  }
}

function evaluateRuleNode(book: Book, node: RuleNode): boolean {
  if (node.type === 'condition') {
    return evaluateCondition(book, node);
  }
  // It's a group
  if (node.children.length === 0) return false;
  return node.connector === 'AND'
    ? node.children.every((child) => evaluateRuleNode(book, child))
    : node.children.some((child) => evaluateRuleNode(book, child));
}

function evaluateRuleGroup(book: Book, group: RuleGroup): boolean {
  if (group.children.length === 0) return false;
  return evaluateRuleNode(book, group);
}

export function LibraryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('date-added');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [books, setBooks] = useState(mockBooks.filter((b) => !b.archived));
  const [showUpload, setShowUpload] = useState(false);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showShelfAssign, setShowShelfAssign] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [searchParams] = useSearchParams();
  const { shelves } = useShelves();
  const activeShelfId = searchParams.get('shelf');
  const activeShelfData = activeShelfId ? shelves.find((s) => s.id === activeShelfId) : null;

  const sorted = [...books].sort((a, b) => {
    switch (sortBy) {
      case 'title-az':
        return a.title.localeCompare(b.title);
      case 'recent-progress': {
        const aLast = a.progressHistory.length > 0 ? a.progressHistory[a.progressHistory.length - 1].date : '0';
        const bLast = b.progressHistory.length > 0 ? b.progressHistory[b.progressHistory.length - 1].date : '0';
        return bLast.localeCompare(aLast);
      }
      case 'date-added':
      default:
        return (b.addedAt || '').localeCompare(a.addedAt || '');
    }
  });

  const filtered = sorted.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || b.status === filterStatus;

    let matchesShelf = true;
    if (activeShelfId && activeShelfData) {
      const manualMatch = b.shelfIds && b.shelfIds.includes(activeShelfId);
      const rulesMatch = activeShelfData.ruleGroup.children.length > 0
        ? evaluateRuleGroup(b, activeShelfData.ruleGroup)
        : false;
      matchesShelf = !!(manualMatch || rulesMatch);
    }

    return matchesSearch && matchesStatus && matchesShelf;
  });

  const stats = {
    total: books.length,
    reading: books.filter((b) => b.status === 'reading').length,
    unread: books.filter((b) => b.status === 'unread').length,
    read: books.filter((b) => b.status === 'read').length,
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const fileNames = Array.from(files).map(f => f.name);
    setTimeout(() => {
      setUploading(false);
      setShowUpload(false);
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} imported`, {
        description: fileNames.join(', '),
      });
    }, 1500);
  };

  const handleToggleBookShelf = (bookId: string, shelfId: string) => {
    setBooks(books.map(b => {
      if (b.id !== bookId) return b;
      const currentShelves = b.shelfIds || [];
      const isOnShelf = currentShelves.includes(shelfId);
      return {
        ...b,
        shelfIds: isOnShelf
          ? currentShelves.filter(id => id !== shelfId)
          : [...currentShelves, shelfId],
      };
    }));
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Books', value: stats.total, color: 'text-foreground' },
          { label: 'Reading', value: stats.reading, color: 'text-[#c9a962]' },
          { label: 'Unread', value: stats.unread, color: 'text-[#60a5fa]' },
          { label: 'Completed', value: stats.read, color: 'text-[#4ade80]' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-2xl ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Active shelf indicator */}
      {activeShelfData && (
        <div className="flex items-center gap-2 text-sm bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <span>{activeShelfData.icon}</span>
          <span className="text-foreground">{activeShelfData.name}</span>
          <span className="text-xs text-muted-foreground">({filtered.length} book{filtered.length !== 1 ? 's' : ''})</span>
          {countConditions(activeShelfData.ruleGroup) > 0 && (
            <span className="text-[10px] text-muted-foreground/60 ml-1">
              {countConditions(activeShelfData.ruleGroup)} rule{countConditions(activeShelfData.ruleGroup) !== 1 ? 's' : ''} active
            </span>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your library..."
            className="w-full bg-input-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all outline-none"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Upload button */}
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowSortMenu(!showSortMenu); setShowFilters(false); }}
              className="flex items-center gap-2 px-3 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-50 min-w-[170px]">
                  {(Object.keys(sortLabels) as SortOption[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSortBy(s); setShowSortMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                        sortBy === s ? 'text-primary bg-primary/5' : 'text-popover-foreground hover:bg-secondary/50'
                      }`}
                    >
                      {sortLabels[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowFilters(!showFilters); setShowSortMenu(false); }}
              className="flex items-center gap-2 px-3 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">{filterStatus === 'all' ? 'All' : filterStatus}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFilters && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                  {(['all', 'unread', 'reading', 'read'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setFilterStatus(s); setShowFilters(false); }}
                      className={`w-full text-left px-3 py-2 text-sm capitalize transition-colors cursor-pointer ${
                        filterStatus === s ? 'text-primary bg-primary/5' : 'text-popover-foreground hover:bg-secondary/50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-secondary rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !uploading && setShowUpload(false)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2>Import Books</h2>
              <button onClick={() => !uploading && setShowUpload(false)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Upload EPUB, PDF, or MOBI files to add them directly to your library.
            </p>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                uploadDragging ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragOver={(e) => { e.preventDefault(); setUploadDragging(true); }}
              onDragLeave={() => setUploadDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setUploadDragging(false);
                handleFileUpload(e.dataTransfer.files);
              }}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm text-foreground">Importing files...</p>
                </div>
              ) : (
                <>
                  <FileUp className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-foreground mb-1">Drag & drop files here</p>
                  <p className="text-xs text-muted-foreground mb-3">EPUB, PDF, MOBI supported</p>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
                  >
                    Browse Files
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".epub,.pdf,.mobi"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Books */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No books found"
          description={
            searchQuery
              ? 'Try adjusting your search terms.'
              : activeShelfId
                ? 'No books on this shelf yet. Add books using the bookmark icon on each book.'
                : 'Your library is empty. Search and add books to get started.'
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((book) => (
            <div key={book.id} className="relative group">
              <button
                onClick={() => setSelectedBook(book)}
                className="w-full bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-all text-left cursor-pointer"
              >
                <div className="aspect-[3/4] relative overflow-hidden">
                  <ImageWithFallback
                    src={book.cover}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2 right-2">
                    <FormatBadge format={book.format} />
                  </div>
                  {book.readingProgress > 0 && book.readingProgress < 100 && (
                    <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
                      <ProgressBar value={book.readingProgress} />
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm text-foreground truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                  <div className="flex items-center justify-between">
                    <RatingStars rating={book.rating} size={12} readonly />
                    {book.shelfIds && book.shelfIds.length > 0 && (
                      <div className="flex items-center gap-0.5 text-[10px]">
                        {book.shelfIds.slice(0, 2).map(sid => {
                          const s = shelves.find(sh => sh.id === sid);
                          return s ? <span key={sid} title={s.name}>{s.icon}</span> : null;
                        })}
                        {book.shelfIds.length > 2 && (
                          <span className="text-muted-foreground">+{book.shelfIds.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
              {/* Shelf assign button (grid) */}
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowShelfAssign(showShelfAssign === book.id ? null : book.id); }}
                    className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-colors cursor-pointer"
                    title="Add to shelf"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  </button>
                  {showShelfAssign === book.id && (
                    <>
                      <div className="fixed inset-0 z-[90]" onClick={(e) => { e.stopPropagation(); setShowShelfAssign(null); }} />
                      <div className="absolute left-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-[95] min-w-[180px]">
                        <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border">Add to Shelf</div>
                        {shelves.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No shelves yet</div>
                        ) : (
                          shelves.map((shelf) => {
                            const isOnShelf = book.shelfIds?.includes(shelf.id);
                            return (
                              <button
                                key={shelf.id}
                                onClick={(e) => { e.stopPropagation(); handleToggleBookShelf(book.id, shelf.id); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${
                                  isOnShelf ? 'text-primary bg-primary/5' : 'text-popover-foreground hover:bg-secondary/50'
                                }`}
                              >
                                <span>{shelf.icon}</span>
                                <span className="flex-1 text-left">{shelf.name}</span>
                                {isOnShelf && <span className="text-xs text-primary">✓</span>}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((book) => (
            <div key={book.id} className="relative group">
              <button
                onClick={() => setSelectedBook(book)}
                className="w-full flex items-center gap-4 bg-card border border-border rounded-xl p-3 hover:border-primary/30 transition-all text-left cursor-pointer"
              >
                <ImageWithFallback
                  src={book.cover}
                  alt={book.title}
                  className="w-12 h-16 object-cover rounded-lg shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground">{book.author}</p>
                  {book.shelfIds && book.shelfIds.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {book.shelfIds.slice(0, 3).map(sid => {
                        const s = shelves.find(sh => sh.id === sid);
                        return s ? (
                          <span key={sid} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary/50 text-[10px] text-muted-foreground">
                            {s.icon} {s.name}
                          </span>
                        ) : null;
                      })}
                      {book.shelfIds.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{book.shelfIds.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <RatingStars rating={book.rating} size={12} readonly />
                  <FormatBadge format={book.format} />
                  <StatusPill status={book.status} />
                </div>
                <div className="hidden md:block w-32">
                  <ProgressBar value={book.readingProgress} showLabel />
                </div>
              </button>
              {/* Shelf assign button (list) */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowShelfAssign(showShelfAssign === book.id ? null : book.id); }}
                    className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                    title="Add to shelf"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  </button>
                  {showShelfAssign === book.id && (
                    <>
                      <div className="fixed inset-0 z-[90]" onClick={(e) => { e.stopPropagation(); setShowShelfAssign(null); }} />
                      <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-[95] min-w-[180px]">
                        <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border">Add to Shelf</div>
                        {shelves.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No shelves yet</div>
                        ) : (
                          shelves.map((shelf) => {
                            const isOnShelf = book.shelfIds?.includes(shelf.id);
                            return (
                              <button
                                key={shelf.id}
                                onClick={(e) => { e.stopPropagation(); handleToggleBookShelf(book.id, shelf.id); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${
                                  isOnShelf ? 'text-primary bg-primary/5' : 'text-popover-foreground hover:bg-secondary/50'
                                }`}
                              >
                                <span>{shelf.icon}</span>
                                <span className="flex-1 text-left">{shelf.name}</span>
                                {isOnShelf && <span className="text-xs text-primary">✓</span>}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Book Detail Modal */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onUpdate={(updated) => {
            setBooks(books.map((b) => (b.id === updated.id ? updated : b)));
            setSelectedBook(null);
          }}
          shelves={shelves}
          onToggleShelf={(bookId, shelfId) => handleToggleBookShelf(bookId, shelfId)}
        />
      )}
    </div>
  );
}