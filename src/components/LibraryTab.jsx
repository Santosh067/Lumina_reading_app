import { BookMarked } from 'lucide-react';

function LibraryTab({ items, onLoad, onDelete, onSave }) {
  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-full px-4 sm:px-6 py-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Library</h2>
        <p className="text-sm text-stone-500 mt-1">Save and organize your texts</p>
      </div>

      {items.length > 0 ? (
        /* Card Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/50"
            >
              {/* Title */}
              <h3 className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                {item.title}
              </h3>

              {/* Preview */}
              <p className="text-xs text-stone-500 mt-1 line-clamp-2">{item.text}</p>

              {/* Date */}
              <p className="text-[10px] text-stone-400 mt-2">{formatDate(item.createdAt)}</p>

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onLoad({ id: item.id, title: item.title, text: item.text })}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
                >
                  Open
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <BookMarked size={48} className="text-stone-300 dark:text-stone-600" />
          <h3 className="text-lg font-semibold text-stone-400">No saved texts</h3>
          <p className="text-sm text-stone-400 text-center max-w-xs">
            Save texts from the editor to build your personal library.
          </p>
          <button
            onClick={onSave}
            className="px-6 py-3 rounded-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Save Current Text
          </button>
        </div>
      )}
    </div>
  );
}

export default LibraryTab;
