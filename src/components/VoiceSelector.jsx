import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Activity, Check, Search, Play, Pause } from 'lucide-react';

const PREMIUM_VOICES = [
  { id: 'shubh', name: 'Shubh', quality: 'Natural', tags: ['Male', 'Hindi'], desc: 'Warm, natural Hindi and multi-lingual' },
  { id: 'shruti', name: 'Shruti', quality: 'Clear', tags: ['Female', 'Hindi'], desc: 'Clear, expressive multi-lingual' },
  { id: 'gokul', name: 'Gokul', quality: 'Deep', tags: ['Male', 'Tamil'], desc: 'Deep, South Indian languages' },
  { id: 'kavya', name: 'Kavya', quality: 'Bright', tags: ['Female', 'Telugu'], desc: 'Bright, South Indian languages' },
];

const PREVIEW_TEXT = 'Lumina makes it easy to turn your text into natural, high-quality speech.';
const PREVIEW_DURATION = 5;

function VoiceSelector({
  isOpen,
  voices,
  selectedVoice,
  sarvamVoice,
  ttsEngine,
  onVoiceChange,
  onSarvamVoiceChange,
  onEngineChange,
  onClose,
}) {
  const [search, setSearch] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const synthRef = useRef(null);

  // Reset search when panel opens
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setIsPlaying(false);
      setElapsed(0);
    }
    return () => {
      clearInterval(timerRef.current);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen]);

  const handlePreview = useCallback(() => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      clearInterval(timerRef.current);
      setIsPlaying(false);
      setElapsed(0);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(PREVIEW_TEXT);
    const browserVoices = window.speechSynthesis.getVoices();

    if (ttsEngine === 'native' && selectedVoice) {
      const match = browserVoices.find((v) => v.name === selectedVoice);
      if (match) utterance.voice = match;
    }

    synthRef.current = utterance;
    setIsPlaying(true);
    setElapsed(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(Math.min(secs, PREVIEW_DURATION));
    }, 250);

    utterance.onend = () => {
      clearInterval(timerRef.current);
      setIsPlaying(false);
      setElapsed(0);
    };

    utterance.onerror = () => {
      clearInterval(timerRef.current);
      setIsPlaying(false);
      setElapsed(0);
    };

    window.speechSynthesis.speak(utterance);
  }, [isPlaying, ttsEngine, selectedVoice]);

  const formatTime = (s) => `0:${String(s).padStart(2, '0')}`;

  const filteredVoices = voices.filter((v) => {
    const term = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(term) ||
      v.lang.toLowerCase().includes(term)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 motion-safe:transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative w-full md:max-w-md md:mx-auto bg-white dark:bg-stone-900
          rounded-t-3xl md:rounded-3xl max-h-[85vh] overflow-y-auto
          motion-safe:transition-transform motion-safe:duration-300
          motion-safe:animate-[slideUp_0.3s_ease-out]
          md:motion-safe:animate-none"
        style={{ willChange: 'transform' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm z-10 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                aria-label="Close"
              >
                <ArrowLeft size={20} className="text-stone-700 dark:text-stone-300" />
              </button>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white">Voice</h2>
            </div>
          </div>
          <p className="text-sm text-stone-500 mt-1 ml-10">
            Choose the perfect voice for your content.
          </p>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Premium Voices */}
          <h3 className="text-xs uppercase tracking-widest text-amber-600 font-bold mb-3">
            Premium ✨
          </h3>
          <div className="space-y-3">
            {PREMIUM_VOICES.map((voice) => {
              const isSelected =
                ttsEngine === 'sarvam' && sarvamVoice === voice.id;
              return (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => {
                    onEngineChange('sarvam');
                    onSarvamVoiceChange(voice.id);
                  }}
                  className={`w-full p-4 rounded-2xl border flex items-start gap-4 text-left cursor-pointer transition-colors
                    ${
                      isSelected
                        ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                >
                  {/* Icon */}
                  <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/30 p-2.5 flex-shrink-0">
                    <Activity size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-900 dark:text-white">
                        {voice.name}
                      </span>
                      <span className="text-xs text-stone-500">({voice.quality})</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {voice.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-[10px] font-semibold text-stone-600 dark:text-stone-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-stone-500 mt-1">{voice.desc}</p>
                  </div>

                  {/* Check */}
                  {isSelected && (
                    <div className="flex-shrink-0 mt-1">
                      <Check size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Device Voices */}
          <h3 className="text-xs uppercase tracking-widest text-stone-400 font-bold mt-6 mb-3">
            Device Voices
          </h3>

          {/* Search */}
          <div className="relative mb-3">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voices..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700
                bg-white dark:bg-stone-800 text-sm text-stone-900 dark:text-white
                placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30
                focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Voice List */}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {filteredVoices.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">No voices found.</p>
            ) : (
              filteredVoices.map((voice) => {
                const isSelected =
                  ttsEngine === 'native' && selectedVoice === voice.name;
                return (
                  <button
                    key={voice.name}
                    type="button"
                    onClick={() => {
                      onEngineChange('native');
                      onVoiceChange(voice.name);
                    }}
                    className={`w-full px-4 py-3 rounded-xl flex items-center justify-between text-left cursor-pointer transition-colors
                      ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/20'
                          : 'hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                  >
                    <span className="text-sm text-stone-900 dark:text-white">
                      {voice.name}{' '}
                      <span className="text-stone-400">({voice.lang})</span>
                    </span>
                    {isSelected && (
                      <Check size={16} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Preview Section */}
          <div className="mt-6 p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
            <p className="text-xs text-stone-500 mb-3">Preview voice</p>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-3">
              {PREVIEW_TEXT}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePreview}
                className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors flex-shrink-0"
                aria-label={isPlaying ? 'Stop preview' : 'Play preview'}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>
              <span className="text-xs text-stone-400 tabular-nums">
                {formatTime(elapsed)} / {formatTime(PREVIEW_DURATION)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-up keyframes injected inline */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default VoiceSelector;
