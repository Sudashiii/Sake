export interface ProgressEntry {
  date: string;
  progress: number;
  pagesRead?: string; // e.g. "pp. 1–52"
  note?: string;
}

export interface DeviceDownload {
  id: string;
  deviceName: string;
  deviceType: 'phone' | 'tablet' | 'desktop' | 'ereader';
  downloadedAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  format: string;
  language: string;
  size: string;
  year: number;
  pages: number;
  isbn: string;
  publisher: string;
  description: string;
  rating: number;
  readingProgress: number;
  status: 'unread' | 'reading' | 'read';
  archived: boolean;
  excludeFromNew: boolean;
  addedAt: string;
  progressHistory: ProgressEntry[];
  // Extended metadata
  series?: string;
  volume?: string;
  edition?: string;
  identifier?: string;
  googleBooksId?: string;
  openLibraryKey?: string;
  amazonAsin?: string;
  externalRating?: number;
  externalRatingCount?: number;
  // Trash
  trashedAt?: string;
  deletesAt?: string;
  // Devices
  devices: DeviceDownload[];
  shelfIds?: string[];
}

export interface QueueItem {
  id: string;
  bookTitle: string;
  author: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  retries: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  progress?: number;
  error?: string;
  // Legacy aliases
  addedAt: string;
  completedAt?: string;
}

export type RuleField = 'title' | 'author' | 'format' | 'language' | 'status' | 'rating' | 'readingProgress' | 'year' | 'pages';
export type RuleOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'gt' | 'lt' | 'gte' | 'lte';
export type RuleConnector = 'AND' | 'OR';

export interface ShelfCondition {
  id: string;
  type: 'condition';
  field: RuleField;
  operator: RuleOperator;
  value: string;
}

export interface RuleGroup {
  id: string;
  type: 'group';
  connector: RuleConnector;
  children: RuleNode[];
}

export type RuleNode = ShelfCondition | RuleGroup;

/** @deprecated kept for backward compat references — use ShelfCondition */
export type ShelfRule = ShelfCondition;

export interface Shelf {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
  ruleGroup: RuleGroup;
}

/** Helper: create an empty rule group */
export function createEmptyRuleGroup(connector: RuleConnector = 'AND'): RuleGroup {
  return { id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'group', connector, children: [] };
}

/** Helper: recursively count conditions in a rule tree */
export function countConditions(node: RuleNode): number {
  if (node.type === 'condition') return 1;
  return node.children.reduce((sum, child) => sum + countConditions(child), 0);
}

export const defaultShelves: Shelf[] = [
  { id: 'shelf-1', name: 'Favorites', icon: '⭐', createdAt: '2025-12-01', ruleGroup: { id: 'grp-fav', type: 'group', connector: 'AND', children: [] } },
  { id: 'shelf-2', name: 'Sci-Fi Classics', icon: '🚀', createdAt: '2026-01-05', ruleGroup: { id: 'grp-sci', type: 'group', connector: 'AND', children: [] } },
  { id: 'shelf-3', name: 'To Read Next', icon: '📌', createdAt: '2026-02-01', ruleGroup: {
    id: 'grp-toread', type: 'group', connector: 'OR', children: [
      { id: 'r1', type: 'condition', field: 'status', operator: 'equals', value: 'unread' },
      { id: 'grp-quality', type: 'group', connector: 'AND', children: [
        { id: 'r2', type: 'condition', field: 'rating', operator: 'gte', value: '4' },
        { id: 'r3', type: 'condition', field: 'pages', operator: 'lte', value: '500' },
      ]},
    ],
  }},
];

export const mockBooks: Book[] = [
  {
    id: '1',
    title: 'Dune',
    author: 'Frank Herbert',
    cover: 'https://images.unsplash.com/photo-1513680592398-887abb03c760?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aW50YWdlJTIwYm9vayUyMHN0YWNrJTIwcmVhZGluZ3xlbnwxfHx8fDE3NzIyODIyOTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'EPUB',
    language: 'English',
    size: '2.4 MB',
    year: 1965,
    pages: 412,
    isbn: '978-0-441-17271-9',
    publisher: 'Chilton Books',
    description: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the "spice" melange.',
    rating: 5,
    readingProgress: 78,
    status: 'reading',
    archived: false,
    excludeFromNew: false,
    addedAt: '2026-01-15',
    series: 'Dune Chronicles',
    volume: '1',
    edition: '1st Edition',
    identifier: 'dune-herbert-1965',
    googleBooksId: 'B1hSG45JCX4C',
    openLibraryKey: 'OL7517013M',
    amazonAsin: 'B00B7NPRY8',
    externalRating: 4.25,
    externalRatingCount: 982341,
    devices: [
      { id: 'd1', deviceName: 'iPhone 15 Pro', deviceType: 'phone', downloadedAt: '2026-01-15T14:30:00' },
      { id: 'd2', deviceName: 'iPad Air', deviceType: 'tablet', downloadedAt: '2026-01-16T09:00:00' },
      { id: 'd3', deviceName: 'Kindle Paperwhite', deviceType: 'ereader', downloadedAt: '2026-01-20T11:15:00' },
    ],
    shelfIds: ['shelf-1', 'shelf-2'],
    progressHistory: [
      { date: '2026-01-15', progress: 0, pagesRead: 'pp. 1–1', note: 'Started reading' },
      { date: '2026-01-18', progress: 8, pagesRead: 'pp. 1–33', note: 'Introduction chapters' },
      { date: '2026-01-20', progress: 15, pagesRead: 'pp. 33–62', note: 'Paul arrives on Arrakis' },
      { date: '2026-01-23', progress: 22, pagesRead: 'pp. 62–91' },
      { date: '2026-01-26', progress: 28, pagesRead: 'pp. 91–115', note: 'Desert scenes begin' },
      { date: '2026-01-28', progress: 34, pagesRead: 'pp. 115–140' },
      { date: '2026-01-31', progress: 40, pagesRead: 'pp. 140–165' },
      { date: '2026-02-02', progress: 46, pagesRead: 'pp. 165–190', note: 'Fremen encounters' },
      { date: '2026-02-05', progress: 52, pagesRead: 'pp. 190–214' },
      { date: '2026-02-08', progress: 60, pagesRead: 'pp. 214–247' },
      { date: '2026-02-11', progress: 68, pagesRead: 'pp. 247–280', note: 'Sandworm riding' },
      { date: '2026-02-14', progress: 78, pagesRead: 'pp. 280–321', note: 'Battle preparations' },
    ],
  },
  {
    id: '2',
    title: 'Neuromancer',
    author: 'William Gibson',
    cover: 'https://images.unsplash.com/photo-1694187061187-853639949eb4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcGVuJTIwYm9vayUyMHBhZ2VzJTIwbGl0ZXJhdHVyZXxlbnwxfHx8fDE3NzIyMjMxNTN8MA&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'PDF',
    language: 'English',
    size: '3.1 MB',
    year: 1984,
    pages: 271,
    isbn: '978-0-441-56959-5',
    publisher: 'Ace Books',
    description: 'The sky above the port was the color of television, tuned to a dead channel. Case was the sharpest data-thief in the matrix.',
    rating: 4,
    readingProgress: 100,
    status: 'read',
    archived: false,
    excludeFromNew: true,
    addedAt: '2025-11-20',
    series: 'Sprawl Trilogy',
    volume: '1',
    edition: 'Reprint',
    identifier: 'neuromancer-gibson-1984',
    googleBooksId: 'IDn_1bOoiPAC',
    openLibraryKey: 'OL24227734M',
    amazonAsin: 'B000O76ON6',
    externalRating: 3.89,
    externalRatingCount: 312087,
    devices: [
      { id: 'd4', deviceName: 'MacBook Pro', deviceType: 'desktop', downloadedAt: '2025-11-20T16:00:00' },
    ],
    shelfIds: ['shelf-2'],
    progressHistory: [
      { date: '2025-11-20', progress: 0, pagesRead: 'pp. 1–1', note: 'Started' },
      { date: '2025-11-25', progress: 20, pagesRead: 'pp. 1–54' },
      { date: '2025-12-01', progress: 45, pagesRead: 'pp. 54–122', note: 'Matrix sequences' },
      { date: '2025-12-08', progress: 65, pagesRead: 'pp. 122–176' },
      { date: '2025-12-15', progress: 80, pagesRead: 'pp. 176–217' },
      { date: '2025-12-22', progress: 92, pagesRead: 'pp. 217–249' },
      { date: '2025-12-28', progress: 100, pagesRead: 'pp. 249–271', note: 'Finished' },
    ],
  },
  {
    id: '3',
    title: 'The Left Hand of Darkness',
    author: 'Ursula K. Le Guin',
    cover: 'https://images.unsplash.com/photo-1578649538497-c7f1d842923c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsZWF0aGVyJTIwYm91bmQlMjBib29rJTIwYW50aXF1ZXxlbnwxfHx8fDE3NzIyODIyOTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'EPUB',
    language: 'English',
    size: '1.8 MB',
    year: 1969,
    pages: 304,
    isbn: '978-0-441-47812-5',
    publisher: 'Ace Books',
    description: 'A lone human ambassador is sent to the planet of Winter, a world without sexual prejudice, where the inhabitants can change their gender.',
    rating: 4,
    readingProgress: 0,
    status: 'unread',
    archived: false,
    excludeFromNew: false,
    addedAt: '2026-02-10',
    googleBooksId: 'LGNYAAAAQBAJ',
    openLibraryKey: 'OL24190624M',
    externalRating: 4.06,
    externalRatingCount: 198432,
    devices: [
      { id: 'd5', deviceName: 'Kindle Paperwhite', deviceType: 'ereader', downloadedAt: '2026-02-10T20:00:00' },
    ],
    shelfIds: ['shelf-3'],
    progressHistory: [],
  },
  {
    id: '4',
    title: 'Foundation',
    author: 'Isaac Asimov',
    cover: 'https://images.unsplash.com/photo-1763768861268-cb6b54173dbf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbGFzc2ljJTIwbm92ZWwlMjBib29rJTIwY292ZXJ8ZW58MXx8fHwxNzcyMTgzNzU3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'MOBI',
    language: 'English',
    size: '1.5 MB',
    year: 1951,
    pages: 244,
    isbn: '978-0-553-29335-7',
    publisher: 'Gnome Press',
    description: 'For twelve thousand years the Galactic Empire has ruled supreme. Now it is dying. Hari Seldon has created a plan to preserve knowledge and shorten the dark ages.',
    rating: 5,
    readingProgress: 45,
    status: 'reading',
    archived: false,
    excludeFromNew: false,
    addedAt: '2026-02-01',
    series: 'Foundation',
    volume: '1',
    edition: '50th Anniversary Edition',
    identifier: 'foundation-asimov-1951',
    googleBooksId: 'LyOyQgAACAAJ',
    openLibraryKey: 'OL7826699M',
    amazonAsin: 'B000FC1PWA',
    externalRating: 4.17,
    externalRatingCount: 567891,
    devices: [
      { id: 'd6', deviceName: 'iPhone 15 Pro', deviceType: 'phone', downloadedAt: '2026-02-01T12:00:00' },
      { id: 'd7', deviceName: 'MacBook Pro', deviceType: 'desktop', downloadedAt: '2026-02-02T08:30:00' },
    ],
    shelfIds: ['shelf-1', 'shelf-2', 'shelf-3'],
    progressHistory: [
      { date: '2026-02-01', progress: 0, pagesRead: 'pp. 1–1', note: 'Started reading' },
      { date: '2026-02-05', progress: 12, pagesRead: 'pp. 1–29' },
      { date: '2026-02-10', progress: 20, pagesRead: 'pp. 29–49', note: 'Hari Seldon intro' },
      { date: '2026-02-15', progress: 33, pagesRead: 'pp. 49–81' },
      { date: '2026-02-20', progress: 45, pagesRead: 'pp. 81–110', note: 'The Encyclopedists' },
    ],
  },
  {
    id: '5',
    title: 'Snow Crash',
    author: 'Neal Stephenson',
    cover: 'https://images.unsplash.com/photo-1765371513765-d2b624850162?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBib29rc2hlbGYlMjBtaW5pbWFsfGVufDF8fHx8MTc3MjI4MjI5MXww&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'EPUB',
    language: 'English',
    size: '2.8 MB',
    year: 1992,
    pages: 480,
    isbn: '978-0-553-38095-8',
    publisher: 'Bantam Books',
    description: 'In reality, Hiro Protagonist delivers pizza for Uncle Enzo\'s. In the Metaverse, he\'s a warrior prince.',
    rating: 3,
    readingProgress: 12,
    status: 'reading',
    archived: false,
    excludeFromNew: false,
    addedAt: '2026-02-25',
    amazonAsin: 'B000FBJCJE',
    externalRating: 4.02,
    externalRatingCount: 245678,
    devices: [
      { id: 'd8', deviceName: 'iPad Air', deviceType: 'tablet', downloadedAt: '2026-02-25T18:00:00' },
    ],
    shelfIds: ['shelf-2'],
    progressHistory: [
      { date: '2026-02-25', progress: 0, pagesRead: 'pp. 1–1', note: 'Started reading' },
      { date: '2026-02-27', progress: 12, pagesRead: 'pp. 1–58', note: 'Pizza delivery chapter' },
    ],
  },
  {
    id: '6',
    title: 'Brave New World',
    author: 'Aldous Huxley',
    cover: 'https://images.unsplash.com/photo-1708548172199-72f7796d4206?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbGlicmFyeSUyMGJvb2tzaGVsZiUyMG1vb2R5fGVufDF8fHx8MTc3MjI4MjI4OXww&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'PDF',
    language: 'English',
    size: '1.2 MB',
    year: 1932,
    pages: 311,
    isbn: '978-0-06-085052-4',
    publisher: 'Chatto & Windus',
    description: 'A dystopian novel set in a futuristic World State, whose citizens are environmentally engineered into an intelligence-based social hierarchy.',
    rating: 4,
    readingProgress: 100,
    status: 'read',
    archived: true,
    excludeFromNew: true,
    addedAt: '2025-10-05',
    edition: 'Harper Perennial Modern Classics',
    googleBooksId: 'VO0HHwAACAAJ',
    openLibraryKey: 'OL24942514M',
    externalRating: 3.99,
    externalRatingCount: 1456789,
    devices: [],
    progressHistory: [
      { date: '2025-10-05', progress: 0, pagesRead: 'pp. 1–1' },
      { date: '2025-10-12', progress: 30, pagesRead: 'pp. 1–93' },
      { date: '2025-10-20', progress: 60, pagesRead: 'pp. 93–187', note: 'Savage reservation' },
      { date: '2025-10-28', progress: 85, pagesRead: 'pp. 187–264' },
      { date: '2025-11-01', progress: 100, pagesRead: 'pp. 264–311', note: 'Finished' },
    ],
  },
  {
    id: '7',
    title: 'Do Androids Dream of Electric Sheep?',
    author: 'Philip K. Dick',
    cover: 'https://images.unsplash.com/photo-1694187061187-853639949eb4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcGVuJTIwYm9vayUyMHBhZ2VzJTIwbGl0ZXJhdHVyZXxlbnwxfHx8fDE3NzIyMjMxNTN8MA&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'EPUB',
    language: 'English',
    size: '1.6 MB',
    year: 1968,
    pages: 210,
    isbn: '978-0-345-40447-3',
    publisher: 'Doubleday',
    description: 'A bounty hunter must pursue and retire six escaped Nexus-6 androids, while questioning what it means to be human.',
    rating: 4,
    readingProgress: 100,
    status: 'read',
    archived: true,
    excludeFromNew: true,
    addedAt: '2025-08-20',
    googleBooksId: 'oMl6BgAAQBAJ',
    amazonAsin: 'B000SEGTI0',
    externalRating: 4.09,
    externalRatingCount: 423567,
    devices: [],
    progressHistory: [
      { date: '2025-08-20', progress: 0, pagesRead: 'pp. 1–1' },
      { date: '2025-09-01', progress: 50, pagesRead: 'pp. 1–105' },
      { date: '2025-09-10', progress: 100, pagesRead: 'pp. 105–210', note: 'Finished' },
    ],
  },
];

export const mockQueue: QueueItem[] = [
  {
    id: 'q1',
    bookTitle: 'Hyperion',
    author: 'Dan Simmons',
    status: 'queued',
    retries: 0,
    maxRetries: 3,
    createdAt: '2026-02-28T10:30:00',
    updatedAt: '2026-02-28T10:30:00',
    addedAt: '2026-02-28T10:30:00',
  },
  {
    id: 'q2',
    bookTitle: 'The Dispossessed',
    author: 'Ursula K. Le Guin',
    status: 'processing',
    retries: 0,
    maxRetries: 3,
    createdAt: '2026-02-28T10:25:00',
    updatedAt: '2026-02-28T10:26:30',
    addedAt: '2026-02-28T10:25:00',
    progress: 67,
  },
  {
    id: 'q3',
    bookTitle: 'Ringworld',
    author: 'Larry Niven',
    status: 'completed',
    retries: 0,
    maxRetries: 3,
    createdAt: '2026-02-28T09:15:00',
    updatedAt: '2026-02-28T09:18:00',
    finishedAt: '2026-02-28T09:18:00',
    addedAt: '2026-02-28T09:15:00',
    completedAt: '2026-02-28T09:18:00',
  },
  {
    id: 'q4',
    bookTitle: 'Childhood\'s End',
    author: 'Arthur C. Clarke',
    status: 'completed',
    retries: 0,
    maxRetries: 3,
    createdAt: '2026-02-28T08:45:00',
    updatedAt: '2026-02-28T08:47:00',
    finishedAt: '2026-02-28T08:47:00',
    addedAt: '2026-02-28T08:45:00',
    completedAt: '2026-02-28T08:47:00',
  },
  {
    id: 'q5',
    bookTitle: 'Gateway',
    author: 'Frederik Pohl',
    status: 'failed',
    retries: 3,
    maxRetries: 3,
    createdAt: '2026-02-28T08:00:00',
    updatedAt: '2026-02-28T08:12:45',
    addedAt: '2026-02-28T08:00:00',
    error: 'Connection timeout. Server not responding after 3 attempts.',
  },
  {
    id: 'q6',
    bookTitle: 'Solaris',
    author: 'Stanislaw Lem',
    status: 'queued',
    retries: 0,
    maxRetries: 3,
    createdAt: '2026-02-28T10:35:00',
    updatedAt: '2026-02-28T10:35:00',
    addedAt: '2026-02-28T10:35:00',
  },
];

export const mockSearchResults: Book[] = [
  {
    id: 's1',
    title: 'The Three-Body Problem',
    author: 'Liu Cixin',
    cover: 'https://images.unsplash.com/photo-1513680592398-887abb03c760?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aW50YWdlJTIwYm9vayUyMHN0YWNrJTIwcmVhZGluZ3xlbnwxfHx8fDE3NzIyODIyOTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'EPUB',
    language: 'English',
    size: '3.2 MB',
    year: 2008,
    pages: 400,
    isbn: '978-0-7653-8267-1',
    publisher: 'Tor Books',
    description: 'Set against the backdrop of China\'s Cultural Revolution, a secret military project sends signals into space.',
    rating: 0, readingProgress: 0, status: 'unread', archived: false, excludeFromNew: false,
    addedAt: '', progressHistory: [], devices: [],
    series: 'Remembrance of Earth\'s Past',
    volume: '1',
    externalRating: 4.06,
    externalRatingCount: 345678,
  },
  {
    id: 's2',
    title: 'Blindsight',
    author: 'Peter Watts',
    cover: 'https://images.unsplash.com/photo-1694187061187-853639949eb4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcGVuJTIwYm9vayUyMHBhZ2VzJTIwbGl0ZXJhdHVyZXxlbnwxfHx8fDE3NzIyMjMxNTN8MA&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'PDF',
    language: 'English',
    size: '4.1 MB',
    year: 2006,
    pages: 384,
    isbn: '978-0-7653-1964-7',
    publisher: 'Tor Books',
    description: 'A crew of astronauts heads to the edge of the solar system to investigate a mysterious signal.',
    rating: 0, readingProgress: 0, status: 'unread', archived: false, excludeFromNew: false,
    addedAt: '', progressHistory: [], devices: [],
    externalRating: 3.98,
    externalRatingCount: 89012,
  },
  {
    id: 's3',
    title: 'Annihilation',
    author: 'Jeff VanderMeer',
    cover: 'https://images.unsplash.com/photo-1578649538497-c7f1d842923c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsZWF0aGVyJTIwYm91bmQlMjBib29rJTIwYW50aXF1ZXxlbnwxfHx8fDE3NzIyODIyOTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'EPUB',
    language: 'English',
    size: '1.9 MB',
    year: 2014,
    pages: 195,
    isbn: '978-0-374-10409-2',
    publisher: 'FSG Originals',
    description: 'Area X has been cut off from the rest of the civilization for decades. The twelfth expedition enters.',
    rating: 0, readingProgress: 0, status: 'unread', archived: false, excludeFromNew: false,
    addedAt: '', progressHistory: [], devices: [],
    series: 'Southern Reach Trilogy',
    volume: '1',
    externalRating: 3.60,
    externalRatingCount: 178234,
  },
  {
    id: 's4',
    title: 'Rendezvous with Rama',
    author: 'Arthur C. Clarke',
    cover: 'https://images.unsplash.com/photo-1763768861268-cb6b54173dbf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbGFzc2ljJTIwbm92ZWwlMjBib29rJTIwY292ZXJ8ZW58MXx8fHwxNzcyMTgzNzU3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'MOBI',
    language: 'English',
    size: '2.0 MB',
    year: 1973,
    pages: 243,
    isbn: '978-0-553-28789-9',
    publisher: 'Gollancz',
    description: 'A vast cylindrical object enters the Solar System from interstellar space, and a crew is sent to explore.',
    rating: 0, readingProgress: 0, status: 'unread', archived: false, excludeFromNew: false,
    addedAt: '', progressHistory: [], devices: [],
    series: 'Rama',
    volume: '1',
    externalRating: 4.11,
    externalRatingCount: 234567,
  },
];

export const mockTrashedBooks: (Book & { trashedAt: string; deletesAt: string })[] = [
  {
    id: 't1',
    title: 'The Road',
    author: 'Cormac McCarthy',
    cover: 'https://images.unsplash.com/photo-1765371513765-d2b624850162?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBib29rc2hlbGYlMjBtaW5pbWFsfGVufDF8fHx8MTc3MjI4MjI5MXww&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'EPUB',
    language: 'English',
    size: '1.1 MB',
    year: 2006,
    pages: 287,
    isbn: '978-0-307-38789-9',
    publisher: 'Knopf',
    description: 'A father and his young son walk alone through burned America, heading toward the coast.',
    rating: 3,
    readingProgress: 100,
    status: 'read',
    archived: false,
    excludeFromNew: false,
    addedAt: '2025-09-15',
    trashedAt: '2026-02-20',
    deletesAt: '2026-03-22',
    progressHistory: [],
    devices: [],
  },
  {
    id: 't2',
    title: '1984',
    author: 'George Orwell',
    cover: 'https://images.unsplash.com/photo-1708548172199-72f7796d4206?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbGlicmFyeSUyMGJvb2tzaGVsZiUyMG1vb2R5fGVufDF8fHx8MTc3MjI4MjI4OXww&ixlib=rb-4.1.0&q=80&w=1080',
    format: 'PDF',
    language: 'English',
    size: '2.3 MB',
    year: 1949,
    pages: 328,
    isbn: '978-0-451-52493-5',
    publisher: 'Secker & Warburg',
    description: 'Among the seminal texts of the 20th century, Nineteen Eighty-Four is a rare work that grows more haunting as its prophecies are fulfilled.',
    rating: 5,
    readingProgress: 60,
    status: 'reading',
    archived: false,
    excludeFromNew: false,
    addedAt: '2025-08-10',
    trashedAt: '2026-02-25',
    deletesAt: '2026-03-27',
    progressHistory: [],
    devices: [],
  },
];