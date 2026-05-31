import React from 'react';
import { Home, BookMarked, Clock, Settings } from 'lucide-react';

const tabs = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'library', label: 'Library', Icon: BookMarked },
  { id: 'history', label: 'History', Icon: Clock },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl border-t border-stone-200 dark:border-stone-800"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      role="tablist"
      aria-label="Main navigation"
    >
      <div className="flex">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 motion-safe:transition-transform active:scale-95 ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-stone-400 dark:text-stone-500'
              }`}
            >
              {/* Active indicator pill */}
              <span
                className={`w-5 h-0.5 rounded-full mx-auto mb-0.5 ${
                  isActive
                    ? 'bg-indigo-600 dark:bg-indigo-400'
                    : 'bg-transparent'
                }`}
                aria-hidden="true"
              />

              <Icon size={20} />

              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
