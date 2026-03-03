import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useSearchParams, useNavigate } from 'react-router';
import {
  Library,
  Search,
  ListOrdered,
  Trash2,
  Settings,
  Menu,
  X,
  BookOpen,
  LogOut,
  Link as LinkIcon,
  Archive,
  BarChart3,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2 as TrashIcon,
  Filter,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import sakeLogo from '../../imports/sake-logo.svg';
import { useShelves } from '../lib/shelves-context';
import { ShelfRulesModal } from './shelf-rules-modal';
import { countConditions } from '../lib/mock-data';

const EMOJI_OPTIONS = ['📚', '⭐', '🚀', '📌', '🔥', '💎', '🎯', '📖', '🌙', '🎨', '💡', '🏆', '❤️', '🌊', '⚡', '🦋'];

const navItems = [
  { to: '/search', label: 'Search', icon: Search },
  { to: '/queue', label: 'Queue', icon: ListOrdered },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/archived', label: 'Archived', icon: Archive },
  { to: '/trash', label: 'Trash', icon: Trash2 },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shelvesExpanded, setShelvesExpanded] = useState(true);
  const [showCreateShelf, setShowCreateShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [newShelfIcon, setNewShelfIcon] = useState('📚');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [shelfMenuId, setShelfMenuId] = useState<string | null>(null);
  const [shelfMenuPos, setShelfMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null);
  const [editShelfName, setEditShelfName] = useState('');
  const [editShelfIcon, setEditShelfIcon] = useState('');
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  const [rulesModalShelfId, setRulesModalShelfId] = useState<string | null>(null);
  const newShelfInputRef = useRef<HTMLInputElement>(null);
  const editShelfInputRef = useRef<HTMLInputElement>(null);

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { shelves, createShelf, renameShelf, deleteShelf, updateShelfRuleGroup } = useShelves();

  const activeShelfId = searchParams.get('shelf');
  const isLibraryActive = location.pathname === '/' || location.pathname === '';

  useEffect(() => {
    if (showCreateShelf && newShelfInputRef.current) {
      newShelfInputRef.current.focus();
    }
  }, [showCreateShelf]);

  useEffect(() => {
    if (editingShelfId && editShelfInputRef.current) {
      editShelfInputRef.current.focus();
    }
  }, [editingShelfId]);

  const handleCreateShelf = () => {
    const name = newShelfName.trim();
    if (!name) return;
    createShelf(name, newShelfIcon);
    setNewShelfName('');
    setNewShelfIcon('📚');
    setShowCreateShelf(false);
    toast.success(`Shelf "${name}" created`);
  };

  const handleRenameShelf = (shelfId: string) => {
    const name = editShelfName.trim();
    if (!name) return;
    renameShelf(shelfId, name, editShelfIcon);
    setEditingShelfId(null);
    toast.success(`Shelf renamed to "${name}"`);
  };

  const handleDeleteShelf = (shelfId: string) => {
    const shelf = shelves.find((s) => s.id === shelfId);
    deleteShelf(shelfId);
    if (activeShelfId === shelfId) {
      navigate('/');
    }
    setShelfMenuId(null);
    toast.success(`Shelf "${shelf?.name}" deleted`);
  };

  const navigateToShelf = (shelfId: string) => {
    setSidebarOpen(false);
    navigate(`/?shelf=${shelfId}`);
  };

  const navigateToLibrary = () => {
    setSidebarOpen(false);
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1a1d27',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e8e6e3',
          },
        }}
      />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src={sakeLogo} alt="Sake" className="w-8 h-8" />
            <span className="text-foreground tracking-tight">Sake</span>
          </div>
          <button
            className="lg:hidden ml-auto text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {/* Library with expandable shelves */}
          <div>
            <div className="flex items-center">
              <button
                onClick={navigateToLibrary}
                className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                  isLibraryActive && !activeShelfId
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`}
              >
                <Library className="w-4 h-4" />
                Library
              </button>
              <button
                onClick={() => setShelvesExpanded(!shelvesExpanded)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-all cursor-pointer mr-1"
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    shelvesExpanded ? 'rotate-90' : ''
                  }`}
                />
              </button>
            </div>

            {/* Shelves sub-items */}
            <div
              className={`transition-all duration-200 ${
                shelvesExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
              }`}
            >
              <div className="ml-4 pl-3 border-l border-sidebar-border/50 mt-1 space-y-0.5">
                {shelves.map((shelf) => {
                  const isActive = isLibraryActive && activeShelfId === shelf.id;
                  const isEditing = editingShelfId === shelf.id;

                  if (isEditing) {
                    return (
                      <div key={shelf.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-sidebar-accent/30">
                        <div className="relative">
                          <button
                            onClick={() => setShowEditEmojiPicker(!showEditEmojiPicker)}
                            className="text-xs cursor-pointer hover:scale-110 transition-transform"
                          >
                            {editShelfIcon}
                          </button>
                          {showEditEmojiPicker && (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setShowEditEmojiPicker(false)} />
                              <div className="absolute left-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-2 z-[65] grid grid-cols-8 gap-1 min-w-[200px]">
                                {EMOJI_OPTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => { setEditShelfIcon(emoji); setShowEditEmojiPicker(false); }}
                                    className={`w-7 h-7 flex items-center justify-center rounded hover:bg-secondary/80 cursor-pointer text-sm transition-colors ${editShelfIcon === emoji ? 'bg-primary/20' : ''}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                        <input
                          ref={editShelfInputRef}
                          value={editShelfName}
                          onChange={(e) => setEditShelfName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameShelf(shelf.id);
                            if (e.key === 'Escape') setEditingShelfId(null);
                          }}
                          className="bg-transparent border-none outline-none text-xs text-foreground w-full min-w-0"
                        />
                        <button
                          onClick={() => handleRenameShelf(shelf.id)}
                          className="text-[10px] text-primary hover:text-primary/80 cursor-pointer shrink-0"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingShelfId(null)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div key={shelf.id} className="relative group flex items-center">
                      <button
                        onClick={() => navigateToShelf(shelf.id)}
                        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer truncate ${
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-accent-foreground'
                        }`}
                      >
                        <span className="text-xs shrink-0">{shelf.icon}</span>
                        <span className="truncate">{shelf.name}</span>
                        {countConditions(shelf.ruleGroup) > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                        )}
                      </button>
                      {/* Context menu trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setShelfMenuPos({ top: rect.top, left: rect.right + 4 });
                          setShelfMenuId(shelfMenuId === shelf.id ? null : shelf.id);
                        }}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-all cursor-pointer shrink-0"
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}

                {/* Create shelf inline */}
              </div>
            </div>
          </div>

          {/* Rest of nav */}
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <NavLink
            to="/connect"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <LinkIcon className="w-4 h-4" />
            Z-Library
          </NavLink>
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground w-full transition-all cursor-pointer">
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>

        {/* User */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">
                john@example.com
              </p>
            </div>
            <button className="text-muted-foreground hover:text-foreground cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 flex items-center px-4 lg:px-6 border-b border-border shrink-0">
          <button
            className="lg:hidden mr-3 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-foreground capitalize">
              {location.pathname === '/'
                ? activeShelfId
                  ? (() => {
                      const shelf = shelves.find(s => s.id === activeShelfId);
                      return shelf ? `${shelf.icon} ${shelf.name}` : 'Library';
                    })()
                  : 'Library'
                : location.pathname.slice(1).replace(/-/g, ' ')}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Shelf Context Menu (rendered at root level to escape overflow clipping) */}
      {shelfMenuId && shelfMenuPos && (() => {
        const menuShelf = shelves.find(s => s.id === shelfMenuId);
        if (!menuShelf) return null;
        return (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setShelfMenuId(null)} />
            <div
              className="fixed bg-popover border border-border rounded-lg shadow-lg py-1 z-[65] min-w-[130px]"
              style={{ top: shelfMenuPos.top, left: shelfMenuPos.left }}
            >
              <button
                onClick={() => {
                  setEditingShelfId(menuShelf.id);
                  setEditShelfName(menuShelf.name);
                  setEditShelfIcon(menuShelf.icon);
                  setShelfMenuId(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                Rename
              </button>
              <button
                onClick={() => { setRulesModalShelfId(menuShelf.id); setShelfMenuId(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
              >
                <Filter className="w-3 h-3" />
                Rules
                {countConditions(menuShelf.ruleGroup) > 0 && (
                  <span className="ml-auto text-[10px] text-primary">{countConditions(menuShelf.ruleGroup)}</span>
                )}
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => handleDeleteShelf(menuShelf.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                <TrashIcon className="w-3 h-3" />
                Delete
              </button>
            </div>
          </>
        );
      })()}

      {/* Shelf Rules Modal */}
      {rulesModalShelfId && (() => {
        const rulesShelf = shelves.find(s => s.id === rulesModalShelfId);
        if (!rulesShelf) return null;
        return (
          <ShelfRulesModal
            shelf={rulesShelf}
            onClose={() => setRulesModalShelfId(null)}
            onSave={(ruleGroup) => {
              updateShelfRuleGroup(rulesModalShelfId, ruleGroup);
              toast.success(`Rules updated for "${rulesShelf.name}"`);
            }}
          />
        );
      })()}
    </div>
  );
}