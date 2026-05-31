import { Clock, Play, Trash2 } from 'lucide-react';

function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function HistoryTab({ sessions, onReplay, onDelete, onClearAll }) {
  return (
    <div className="h-full px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-white">History</h2>
          <p className="text-sm text-stone-500 mt-1">Your recent listening sessions</p>
        </div>
        {sessions.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-red-500 hover:text-red-600 transition-colors mt-1 flex-shrink-0"
          >
            Clear All
          </button>
        )}
      </div>

      {sessions.length > 0 ? (
        /* Session List */
        <div className="flex flex-col gap-2 mt-6">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="p-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/50 flex items-center gap-4"
            >
              {/* Play Button */}
              <button
                onClick={() => onReplay(session)}
                className="w-10 h-10 rounded-full border-2 border-stone-300 dark:border-stone-600 flex items-center justify-center flex-shrink-0 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors"
                aria-label="Replay session"
              >
                <Play size={16} className="text-stone-600 dark:text-stone-400 ml-0.5" />
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-900 dark:text-white truncate">
                  {session.textSnippet}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {session.voiceName} · {formatDuration(session.duration)}
                  {session.engine === 'sarvam' && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">
                      Premium
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">{formatDate(session.date)}</p>
              </div>

              {/* Delete */}
              <button
                onClick={() => onDelete(session.id)}
                className="flex-shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                aria-label="Delete session"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Clock size={48} className="text-stone-300 dark:text-stone-600" />
          <h3 className="text-lg font-semibold text-stone-400">No listening history yet</h3>
          <p className="text-sm text-stone-400 text-center max-w-xs">
            Start reading to see your sessions here.
          </p>
        </div>
      )}
    </div>
  );
}

export default HistoryTab;
