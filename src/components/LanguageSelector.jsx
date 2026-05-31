import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';

const languages = [
  { code: 'auto', label: 'Auto-Detect', note: 'recommended' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', label: 'Telugu', native: 'తెలుగు' },
  { code: 'bn-IN', label: 'Bengali', native: 'বাংলা' },
  { code: 'gu-IN', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn-IN', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa-IN', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or-IN', label: 'Odia', native: 'ଓଡ଼ିଆ' },
];

function getDisplayLabel(code) {
  const lang = languages.find((l) => l.code === code);
  if (!lang) return code;
  if (lang.native) return `${lang.label} (${lang.native})`;
  return lang.label;
}

function getPillLabel(code) {
  const lang = languages.find((l) => l.code === code);
  if (!lang) return code;
  return lang.label;
}

function LanguageSelector({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  const handleClickOutside = useCallback(
    (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open, handleClickOutside]);

  const handleSelect = (code) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Pill trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm font-medium text-stone-700 dark:text-stone-200 motion-safe:transition-colors hover:border-stone-300 dark:hover:border-stone-600 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe size={16} className="text-stone-400 dark:text-stone-500" />
        <span className="truncate max-w-[140px]">{getPillLabel(value)}</span>
        <ChevronDown
          size={14}
          className={`text-stone-400 dark:text-stone-500 motion-safe:transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute left-0 mt-2 w-64 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 max-h-64 overflow-y-auto z-[100] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
        >
          {languages.map(({ code, label, native, note }) => {
            const isSelected = value === code;

            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(code)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-700 motion-safe:transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                <span className="flex items-center gap-2">
                  <span className="text-stone-900 dark:text-stone-100">
                    {label}
                  </span>
                  {native && (
                    <span className="text-stone-400 dark:text-stone-500">
                      {native}
                    </span>
                  )}
                  {note && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                      {note}
                    </span>
                  )}
                </span>

                {isSelected && (
                  <Check
                    size={16}
                    className="text-indigo-600 dark:text-indigo-400 shrink-0"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
