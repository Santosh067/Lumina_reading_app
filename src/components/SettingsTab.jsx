import { Sun, Moon, Monitor, ExternalLink } from 'lucide-react';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const ENGINE_OPTIONS = [
  {
    value: 'native',
    title: 'Native TTS',
    desc: "Uses your device's built-in voices. Free and offline.",
  },
  {
    value: 'sarvam',
    title: 'Premium (Sarvam AI)',
    desc: 'High-quality neural voices. Requires internet.',
  },
];

function SettingsTab({
  theme,
  onThemeChange,
  rate,
  onRateChange,
  ttsEngine,
  onEngineChange,
  onClearHistory,
  onResetSettings,
}) {
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all listening history?')) {
      onClearHistory();
    }
  };

  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      onResetSettings();
    }
  };

  return (
    <div className="h-full px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Settings</h2>
        <p className="text-sm text-stone-500 mt-1">Customize your experience</p>
      </div>

      {/* Section 1: Appearance */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6 mb-6">
        <h3 className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-4">
          Appearance
        </h3>
        <div className="inline-flex rounded-full border border-stone-200 dark:border-stone-700 p-1 gap-0">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const isActive = theme === value;
            return (
              <button
                key={value}
                onClick={() => onThemeChange(value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors
                  ${
                    isActive
                      ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900'
                      : 'bg-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                  }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Playback */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6 mb-6">
        <h3 className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-4">
          Playback
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="speed-slider"
              className="text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              Speed
            </label>
            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {rate.toFixed(2)}×
            </span>
          </div>
          <input
            id="speed-slider"
            type="range"
            min={0.5}
            max={2}
            step={0.25}
            value={rate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-stone-200 dark:bg-stone-700 accent-indigo-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-stone-400">
            <span>0.5×</span>
            <span>1.0×</span>
            <span>1.5×</span>
            <span>2.0×</span>
          </div>
        </div>
      </div>

      {/* Section 3: Voice Engine */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6 mb-6">
        <h3 className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-4">
          Voice Engine
        </h3>
        <div className="space-y-3">
          {ENGINE_OPTIONS.map(({ value, title, desc }) => {
            const isSelected = ttsEngine === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onEngineChange(value)}
                className={`w-full p-4 rounded-2xl border cursor-pointer flex items-center gap-3 text-left transition-colors
                  ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
              >
                {/* Radio indicator */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                    ${
                      isSelected
                        ? 'border-indigo-600 dark:border-indigo-400'
                        : 'border-stone-300 dark:border-stone-600'
                    }`}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-stone-900 dark:text-white">{title}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 4: About */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6 mb-6">
        <h3 className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-4">About</h3>
        <p className="text-xs text-stone-400 mb-2">Lumina v1.0.0</p>
        <div className="flex flex-col gap-1.5">
          <a
            href="https://github.com/Santosh067/Lumina_reading_app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            GitHub
            <ExternalLink size={10} />
          </a>
          <span className="text-xs text-stone-400">Deployed on Vercel</span>
        </div>
      </div>

      {/* Section 5: Danger Zone */}
      <div className="pb-6">
        <h3 className="text-xs uppercase tracking-widest text-red-400 font-bold mb-4">
          Danger Zone
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleClearHistory}
            className="text-sm px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors font-medium"
          >
            Clear History
          </button>
          <button
            onClick={handleResetSettings}
            className="text-sm px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors font-medium"
          >
            Reset All Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsTab;
