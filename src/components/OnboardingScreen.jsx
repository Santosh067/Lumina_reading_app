import React from 'react';
import { Mic, Zap, Heart } from 'lucide-react';

const features = [
  {
    Icon: Mic,
    title: 'Natural voices',
    description: 'Realistic, human-like speech that sounds amazing.',
  },
  {
    Icon: Zap,
    title: 'Instant conversion',
    description: 'Turn any text into speech in seconds.',
  },
  {
    Icon: Heart,
    title: 'Yours, anywhere',
    description: 'Listen offline, export audio, and stay in sync.',
  },
];

function OnboardingScreen({ onComplete }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white dark:bg-[#111111] overflow-y-auto">
      {/* Inline keyframes */}
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: var(--ring-opacity); }
          50% { transform: scale(1.25); opacity: calc(var(--ring-opacity) * 0.5); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out both;
        }
      `}</style>

      <div className="w-full max-w-md mx-auto px-6 py-12 flex flex-col items-center text-center gap-8">
        {/* Animated SVG Waveform */}
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: '0ms' }}
        >
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle
              cx="60"
              cy="60"
              r="20"
              className="fill-indigo-500"
              style={{
                '--ring-opacity': '0.6',
                animation: 'pulse-ring 2.4s ease-in-out infinite',
                transformOrigin: 'center',
              }}
            />
            <circle
              cx="60"
              cy="60"
              r="35"
              className="fill-indigo-500"
              style={{
                '--ring-opacity': '0.3',
                animation: 'pulse-ring 2.4s ease-in-out infinite 0.4s',
                transformOrigin: 'center',
              }}
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              className="fill-indigo-500"
              style={{
                '--ring-opacity': '0.12',
                animation: 'pulse-ring 2.4s ease-in-out infinite 0.8s',
                transformOrigin: 'center',
              }}
            />
          </svg>
        </div>

        {/* Logo */}
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: '100ms' }}
        >
          <img
            src="/brand/lumina-logo-black-text.png"
            alt="Lumina"
            className="h-20 w-auto block dark:hidden"
          />
          <img
            src="/brand/lumina-logo-white-text.png"
            alt="Lumina"
            className="h-20 w-auto hidden dark:block"
          />
        </div>

        {/* Tagline */}
        <p
          className="text-lg text-stone-500 animate-fade-in-up"
          style={{ animationDelay: '200ms' }}
        >
          Text to speech, beautifully simple.
        </p>

        {/* Feature List */}
        <div className="w-full flex flex-col gap-4">
          {features.map(({ Icon, title, description }, index) => (
            <div
              key={title}
              className="flex items-start gap-4 text-left animate-fade-in-up"
              style={{ animationDelay: `${300 + index * 100}ms` }}
            >
              <div className="shrink-0 rounded-2xl bg-stone-100 dark:bg-stone-800 p-3">
                <Icon size={22} className="text-indigo-500" />
              </div>
              <div>
                <p className="font-semibold text-stone-900 dark:text-stone-100">
                  {title}
                </p>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onComplete}
          className="w-full h-14 rounded-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-semibold text-base motion-safe:transition-transform active:scale-[0.98] animate-fade-in-up"
          style={{ animationDelay: '600ms' }}
        >
          Get Started
        </button>

        {/* Secondary link */}
        <button
          type="button"
          onClick={onComplete}
          className="text-sm text-stone-400 hover:underline animate-fade-in-up"
          style={{ animationDelay: '700ms' }}
        >
          Use Lumina
        </button>
      </div>
    </div>
  );
}

export default OnboardingScreen;
