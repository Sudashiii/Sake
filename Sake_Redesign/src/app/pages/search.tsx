import React, { useState } from 'react';
import {
  Search as SearchIcon,
  Download,
  Plus,
  ChevronDown,
  BookOpen,
  Filter,
  X,
  Edit3,
} from 'lucide-react';
import { mockSearchResults, type Book } from '../lib/mock-data';
import { FormatBadge, EmptyState } from '../components/ui-primitives';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { toast } from 'sonner';

const languages = ['All Languages', 'English', 'Spanish', 'French', 'German', 'Russian', 'Chinese', 'Japanese'];
const formats = ['All Formats', 'EPUB', 'PDF', 'MOBI', 'AZW3', 'FB2'];

interface TitleAdjustState {
  book: Book;
  action: 'download' | 'queue';
  adjustedTitle: string;
  adjustedAuthor: string;
}

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('All Languages');
  const [format, setFormat] = useState('All Formats');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [titleAdjust, setTitleAdjust] = useState<TitleAdjustState | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setTimeout(() => {
      setResults(mockSearchResults);
      setLoading(false);
    }, 800);
  };

  const openTitleAdjust = (book: Book, action: 'download' | 'queue') => {
    setTitleAdjust({
      book,
      action,
      adjustedTitle: book.title,
      adjustedAuthor: book.author,
    });
  };

  const confirmAction = () => {
    if (!titleAdjust) return;
    const { book, action, adjustedTitle, adjustedAuthor } = titleAdjust;
    if (action === 'download') {
      toast.success(`Downloading "${adjustedTitle}"`, {
        description: `${adjustedAuthor} · ${book.format} · ${book.size}`,
      });
    } else {
      toast.success(`Added to queue`, {
        description: `"${adjustedTitle}" by ${adjustedAuthor} will be downloaded shortly.`,
      });
    }
    setTitleAdjust(null);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books by title, author, or ISBN..."
            className="w-full bg-card border border-border rounded-xl pl-12 pr-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all outline-none"
          />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Language dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowLangDropdown(!showLangDropdown); setShowFormatDropdown(false); }}
              className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              {language}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showLangDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangDropdown(false)} />
                <div className="absolute left-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-50 min-w-[160px] max-h-60 overflow-y-auto">
                  {languages.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => { setLanguage(l); setShowLangDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${language === l ? 'text-primary bg-primary/5' : 'text-popover-foreground hover:bg-secondary/50'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Format dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowFormatDropdown(!showFormatDropdown); setShowLangDropdown(false); }}
              className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              {format}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFormatDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFormatDropdown(false)} />
                <div className="absolute left-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                  {formats.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => { setFormat(f); setShowFormatDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${format === f ? 'text-primary bg-primary/5' : 'text-popover-foreground hover:bg-secondary/50'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-all disabled:opacity-40 cursor-pointer"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Results */}
      {!hasSearched ? (
        <EmptyState
          icon={SearchIcon}
          title="Search Z-Library"
          description="Enter a title, author, or ISBN to find books across Z-Library's collection."
        />
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-16 h-22 bg-secondary rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded w-1/3" />
                  <div className="h-3 bg-secondary rounded w-1/4" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No results found"
          description="Try different search terms or adjust your filters."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{results.length} results found</p>
          {results.map((book) => (
            <div key={book.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-all">
              <div className="flex gap-4">
                <ImageWithFallback
                  src={book.cover}
                  alt={book.title}
                  className="w-16 h-22 object-cover rounded-lg shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <h3 className="text-foreground truncate">{book.title}</h3>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FormatBadge format={book.format} />
                    <span className="text-xs text-muted-foreground">{book.size}</span>
                    <span className="text-xs text-muted-foreground">{book.year}</span>
                    <span className="text-xs text-muted-foreground">{book.pages} pages</span>
                    <span className="text-xs text-muted-foreground">{book.language}</span>
                    {book.series && (
                      <span className="text-xs text-primary/70">{book.series}{book.volume ? ` #${book.volume}` : ''}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{book.description}</p>
                  {book.externalRating && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-[#c9a962]">&#9733; {book.externalRating}</span>
                      <span className="text-xs text-muted-foreground">({book.externalRatingCount?.toLocaleString()})</span>
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-2 items-end">
                  <button
                    onClick={() => openTitleAdjust(book, 'download')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                  <button
                    onClick={() => openTitleAdjust(book, 'queue')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Add to Queue</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Title Adjust Modal */}
      {titleAdjust && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setTitleAdjust(null)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary" />
                <h3>Adjust Before {titleAdjust.action === 'download' ? 'Download' : 'Queuing'}</h3>
              </div>
              <button onClick={() => setTitleAdjust(null)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Adjust the title and author used for the filename and reader metadata.
            </p>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Title</label>
                <input
                  value={titleAdjust.adjustedTitle}
                  onChange={(e) => setTitleAdjust({ ...titleAdjust, adjustedTitle: e.target.value })}
                  className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Author</label>
                <input
                  value={titleAdjust.adjustedAuthor}
                  onChange={(e) => setTitleAdjust({ ...titleAdjust, adjustedAuthor: e.target.value })}
                  className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all outline-none"
                />
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <label className="text-xs text-muted-foreground block mb-1">Generated Filename</label>
                <p className="text-xs text-foreground font-mono">
                  {titleAdjust.adjustedAuthor.replace(/\s+/g, '_')}_{titleAdjust.adjustedTitle.replace(/\s+/g, '_')}.{titleAdjust.book.format.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmAction}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
              >
                {titleAdjust.action === 'download' ? <Download className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {titleAdjust.action === 'download' ? 'Download' : 'Add to Queue'}
              </button>
              <button
                onClick={() => setTitleAdjust(null)}
                className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
