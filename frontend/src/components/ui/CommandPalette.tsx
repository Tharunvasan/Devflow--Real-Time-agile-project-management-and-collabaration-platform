import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchService, type SearchResults } from '../../services/searchService';
import { StatusBadge } from './StatusBadge';
import { Avatar } from './Avatar';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateProject?: () => void;
  onOpenCreateTask?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenCreateProject,
  onOpenCreateTask,
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchService.search(query.trim());
        setResults(data);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Static navigation commands
  const defaultActions = [
    {
      id: 'nav-dashboard',
      category: 'Navigation',
      label: 'Go to Dashboard',
      shortcut: 'G D',
      icon: (
        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      action: () => { navigate('/dashboard'); onClose(); },
    },
    {
      id: 'nav-projects',
      category: 'Navigation',
      label: 'Browse All Projects',
      shortcut: 'G P',
      icon: (
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      action: () => { navigate('/projects'); onClose(); },
    },
    {
      id: 'action-create-task',
      category: 'Actions',
      label: 'Create New Task',
      shortcut: 'C T',
      icon: (
        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      action: () => {
        onClose();
        if (onOpenCreateTask) onOpenCreateTask();
        else navigate('/projects');
      },
    },
    {
      id: 'action-create-project',
      category: 'Actions',
      label: 'Create New Project',
      shortcut: 'C P',
      icon: (
        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      action: () => {
        onClose();
        if (onOpenCreateProject) onOpenCreateProject();
        else navigate('/projects');
      },
    },
    {
      id: 'nav-notifications',
      category: 'Navigation',
      label: 'View Notifications',
      shortcut: 'G N',
      icon: (
        <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      action: () => { navigate('/notifications'); onClose(); },
    },
    {
      id: 'nav-profile',
      category: 'Navigation',
      label: 'My Account Settings',
      shortcut: 'G S',
      icon: (
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      action: () => { navigate('/profile'); onClose(); },
    },
  ];

  // Build flattened selectable items list
  const selectableItems: { id: string; action: () => void }[] = [];

  if (!query.trim()) {
    defaultActions.forEach((item) => selectableItems.push({ id: item.id, action: item.action }));
  } else if (results) {
    results.projects.forEach((p) =>
      selectableItems.push({
        id: `proj-${p._id}`,
        action: () => { navigate(`/projects/${p._id}`); onClose(); },
      })
    );
    results.tasks.forEach((t) =>
      selectableItems.push({
        id: `task-${t._id}`,
        action: () => { navigate(`/tasks/${t._id}`); onClose(); },
      })
    );
    results.issues.forEach((i) =>
      selectableItems.push({
        id: `issue-${i._id}`,
        action: () => { navigate(`/issues/${i._id}`); onClose(); },
      })
    );
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < selectableItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : selectableItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectableItems[selectedIndex]) {
        selectableItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  let currentItemCounter = 0;

  return (
    <div
      className="command-palette-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="command-palette">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-[#0e1628]">
          <svg className="w-5 h-5 text-slate-400 shrink-0 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-base focus:outline-none"
            placeholder="Type a command or search tasks, projects, issues..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {loading && (
            <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full shrink-0 ml-2" />
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded ml-2">
            ESC
          </kbd>
        </div>

        {/* Content Box */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
          {/* Default Actions when no query */}
          {!query.trim() && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Quick Navigation & Actions
              </div>
              <div className="space-y-1">
                {defaultActions.map((item, index) => {
                  const isSelected = selectedIndex === index;
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                        isSelected ? 'bg-primary-600/20 text-white' : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="p-1 rounded bg-slate-800/80 border border-slate-700/50">{item.icon}</span>
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <kbd className="text-[11px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                        {item.shortcut}
                      </kbd>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Results */}
          {query.trim().length >= 2 && results && (
            <div className="space-y-4">
              {/* Projects */}
              {results.projects.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Projects ({results.projects.length})
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.projects.map((p) => {
                      const itemIdx = currentItemCounter++;
                      const isSelected = selectedIndex === itemIdx;
                      return (
                        <button
                          key={p._id}
                          onClick={() => { navigate(`/projects/${p._id}`); onClose(); }}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                            isSelected ? 'bg-primary-600/20 text-white' : 'text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded bg-primary-600/30 text-primary-400 font-bold flex items-center justify-center text-xs shrink-0">
                              {p.name.charAt(0)}
                            </span>
                            <span className="font-medium truncate">{p.name}</span>
                            {p.key && <span className="text-xs font-mono text-slate-500">[{p.key}]</span>}
                          </div>
                          <StatusBadge status={p.status} size="sm" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tasks */}
              {results.tasks.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Tasks ({results.tasks.length})
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.tasks.map((t) => {
                      const itemIdx = currentItemCounter++;
                      const isSelected = selectedIndex === itemIdx;
                      return (
                        <button
                          key={t._id}
                          onClick={() => { navigate(`/tasks/${t._id}`); onClose(); }}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                            isSelected ? 'bg-primary-600/20 text-white' : 'text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            {t.taskKey && (
                              <span className="font-mono text-xs text-primary-400 font-semibold shrink-0">
                                {t.taskKey}
                              </span>
                            )}
                            <span className="font-medium truncate">{t.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={t.status} size="sm" />
                            {t.assignedTo && <Avatar user={t.assignedTo} size="xs" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Issues */}
              {results.issues.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Issues ({results.issues.length})
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.issues.map((i) => {
                      const itemIdx = currentItemCounter++;
                      const isSelected = selectedIndex === itemIdx;
                      return (
                        <button
                          key={i._id}
                          onClick={() => { navigate(`/issues/${i._id}`); onClose(); }}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                            isSelected ? 'bg-primary-600/20 text-white' : 'text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            {i.issueKey && (
                              <span className="font-mono text-xs text-rose-400 font-semibold shrink-0">
                                {i.issueKey}
                              </span>
                            )}
                            <span className="font-medium truncate">{i.title}</span>
                          </div>
                          <StatusBadge status={i.severity} size="sm" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Members */}
              {results.members.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Team Members ({results.members.length})
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {results.members.map((m) => (
                      <div
                        key={m._id}
                        className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800"
                      >
                        <Avatar user={m} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{m.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{m.role.replace('_', ' ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty search results */}
              {results.projects.length === 0 &&
                results.tasks.length === 0 &&
                results.issues.length === 0 &&
                results.members.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No results found for &ldquo;{query}&rdquo;
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 bg-[#0a0f1d] border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>Use <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 border border-slate-700">↑</kbd> <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 border border-slate-700">↓</kbd> to navigate</span>
            <span><kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 border border-slate-700">↵</kbd> to select</span>
          </div>
          <span>DevFlow Command Menu</span>
        </div>
      </div>
    </div>
  );
};
