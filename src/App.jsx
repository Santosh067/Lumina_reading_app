// Personal Reading Assistant — Refactored
// Fixes: import ordering, playbackState enum, stale closure, keyboard listener,
//        scrollIntoView thrashing, wordRefs cleanup, tokenizer stability,
//        accessibility, mobile safe-area, reduced-motion, progress indicator.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Square, Upload, Sun, Moon, Trash2, BookOpen, Edit3 } from "lucide-react";

const safeLocalStorage = {
  getItem: (key, defaultValue = "") => {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // silently absorb browser security blocks
    }
  }
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_KEYWORDS = ["Natural", "Neural", "Google", "Microsoft", "Enhanced", "Premium"];

// Weight map for special characters based on how long the speech synthesizer
// takes to speak them. Normal letters = 1.0. Each special character is weighted
// by the approximate spoken-word length relative to a single letter.
// Example: '=' is spoken as "equals" (~6 letters), so weight = 6.
const SPOKEN_CHAR_WEIGHT = {
  // Operators & math
  '=': 6,    // "equals"
  '+': 4,    // "plus"
  '-': 5,    // "minus" / "hyphen" / "dash"
  '*': 7,    // "asterisk"
  '/': 5,    // "slash"
  '\\': 8,  // "backslash"
  '%': 7,    // "percent"
  '^': 5,    // "caret"
  '~': 5,    // "tilde"
  '|': 4,    // "pipe"
  '&': 4,    // "and" / "ampersand"
  '<': 7,    // "less than"
  '>': 9,    // "greater than"

  // Brackets & grouping
  '(': 10,   // "open parenthesis"
  ')': 11,   // "close parenthesis"
  '[': 8,    // "open bracket"
  ']': 9,    // "close bracket"
  '{': 8,    // "open brace"
  '}': 9,    // "close brace"

  // Punctuation (speech pauses + spoken names)
  '.': 3,    // sentence-ending pause, or "dot" / "period"
  ',': 2,    // comma pause
  ';': 2,    // semicolon pause
  ':': 4,    // "colon" or punctuation pause
  '!': 3,    // exclamation pause
  '?': 3,    // question pause
  '"': 5,   // "quote"
  "'": 1.5, // usually silent in contractions, sometimes "apostrophe"
  '`': 6,    // "backtick"
  '—': 2,   // em dash pause
  '–': 2,   // en dash pause
  '\n': 2.5, // paragraph break pause

  // Common symbols
  '@': 3,    // "at"
  '#': 4,    // "hash"
  '$': 6,    // "dollar"
  '_': 8,    // "underscore"

  // Digits (each spoken as a word)
  '0': 4,    // "zero"
  '1': 3,    // "one"
  '2': 3,    // "two"
  '3': 4,    // "three"
  '4': 3,    // "four"
  '5': 4,    // "five"
  '6': 3,    // "six"
  '7': 5,    // "seven"
  '8': 3,    // "eight"
  '9': 4,    // "nine"
};

// Moved outside component: pure function, never changes, no closure needed.
function tokenizeText(input) {
  const regex = /(\S+)(\s*)/g;
  const tokens = [];
  let match;
  while ((match = regex.exec(input)) !== null) {
    const charIndex = match.index;
    tokens.push({
      word: match[1],
      whitespace: match[2],
      charIndex,
      charEnd: charIndex + match[1].length,
    });
  }
  return tokens;
}

// Strips emojis, special symbols, and non-readable characters.
// Keeps: letters (any script), numbers, basic punctuation, whitespace.
function sanitizeText(input) {
  // Remove emoji and symbol Unicode blocks, keep letters/numbers/punctuation/whitespace
  return input
    .replace(/[\u{1F600}-\u{1F9FF}\u{1FA00}-\u{1FA9F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1FA70}-\u{1FAFF}\u{2300}-\u{23FF}\u{2B50}\u{2934}-\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}\u{200B}-\u{200F}\u{2028}-\u{202F}\u{2060}-\u{206F}\u{FEFF}]/gu, '')
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}\s]/gu, '')
    .replace(/[ \t]+/g, ' ');
}

function rankVoice(voice) {
  return PRIORITY_KEYWORDS.some((k) => voice.name.includes(k)) ? 0 : 1;
}

function detectLanguageCode(inputText) {
  if (/[\u0900-\u097F]/.test(inputText)) return "hi-IN"; // Devnagari (Hindi, Marathi)
  if (/[\u0980-\u09FF]/.test(inputText)) return "bn-IN"; // Bengali
  if (/[\u0A00-\u0A7F]/.test(inputText)) return "pa-IN"; // Punjabi (Gurmukhi)
  if (/[\u0A80-\u0AFF]/.test(inputText)) return "gu-IN"; // Gujarati
  if (/[\u0B00-\u0B7F]/.test(inputText)) return "or-IN"; // Odia
  if (/[\u0B80-\u0BFF]/.test(inputText)) return "ta-IN"; // Tamil
  if (/[\u0C00-\u0C7F]/.test(inputText)) return "te-IN"; // Telugu
  if (/[\u0C80-\u0CFF]/.test(inputText)) return "kn-IN"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(inputText)) return "ml-IN"; // Malayalam
  return "en-IN"; // Default to Indian English
}

// Binary search: find the word index whose charStart <= charIndex < charEnd
function findWordByCharIndex(charIndex, wordTokens) {
  let low = 0, high = wordTokens.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (wordTokens[mid].charIndex <= charIndex && charIndex < wordTokens[mid].charEnd) {
      return mid;
    } else if (wordTokens[mid].charIndex < charIndex) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return Math.min(Math.max(low - 1, 0), wordTokens.length - 1);
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Build a weighted position array where each character's weight reflects
// how long the speech synthesizer actually takes to speak it.
// Normal letters = 1.0. Special chars use SPOKEN_CHAR_WEIGHT lookup.
// Moved outside component: pure function using only module-level constants.
function buildWeightedPositions(fullText) {
  const weights = new Array(fullText.length);
  for (let i = 0; i < fullText.length; i++) {
    weights[i] = SPOKEN_CHAR_WEIGHT[fullText[i]] || 1.0;
  }

  // Build cumulative weight array — maps each char index to a "weighted position"
  const cumulative = new Array(fullText.length);
  cumulative[0] = weights[0];
  for (let i = 1; i < fullText.length; i++) {
    cumulative[i] = cumulative[i - 1] + weights[i];
  }
  const totalWeight = cumulative[fullText.length - 1];
  return { cumulative, totalWeight };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Memoized word span — only re-renders when its own active state changes.
const WordSpan = React.memo(function WordSpan({ word, isActive, spanRef }) {
  return (
    <span
      ref={spanRef}
      className={
        isActive
          ? "rounded px-[3px] py-[1px] bg-amber-300 text-stone-900 dark:bg-amber-600 dark:text-amber-50 motion-safe:transition-colors motion-safe:duration-75"
          : undefined
      }
    >
      {word}
    </span>
  );
});

// ─── Main App ─────────────────────────────────────────────────────────────────

function ReadingAssistantApp() {
  // ── Persisted state ──────────────────────────────────────────────────────
  const [selectedVoice, setSelectedVoice] = useState(
    () => safeLocalStorage.getItem("pra-voice") || ""
  );
  const [rate, setRate] = useState(
    () => Number(safeLocalStorage.getItem("pra-rate") || 1)
  );
  const [theme, setTheme] = useState(() => {
    const saved = safeLocalStorage.getItem("pra-theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // ── Core state ───────────────────────────────────────────────────────────
  const [text, setText] = useState("");
  const [words, setWords] = useState([]);
  const [voices, setVoices] = useState([]);
  const [languageFilter, setLanguageFilter] = useState("all");
  // Single enum replaces two booleans (eliminated invalid isPlaying+isPaused=true state)
  const [playbackState, setPlaybackState] = useState("idle"); // 'idle' | 'playing' | 'paused'
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Edit/Read tab — collapses editor during reading for more reading area
  const [activeTab, setActiveTab] = useState("edit"); // 'edit' | 'read'

  // Scrubbing states
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubIndex, setScrubIndex] = useState(-1);
  const scrubIndexRef = useRef(-1);

  // Sarvam AI States
  const [ttsEngine, setTtsEngine] = useState(() => safeLocalStorage.getItem("pra-engine") || "native");
  const [sarvamVoice, setSarvamVoice] = useState(() => safeLocalStorage.getItem("pra-sarvam-voice") || "shubh");
  const [showSettings, setShowSettings] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // ── Refs ─────────────────────────────────────────────────────────────────
  const wordRefs = useRef([]);
  const dockRef = useRef(null);
  const sarvamAudioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const lastRequestTime = useRef(0);
  const RATE_LIMIT_MS = 2500; // 2.5s cooldown between API calls
  // voicesRef: always holds latest voices — fixes stale closure in handlePlay
  const voicesRef = useRef(voices);
  // playbackRef: bridges playback state into the stable keyboard handler
  const playbackRef = useRef(playbackState);
  // rAFRef: requestAnimationFrame ID for the time-based highlight fallback
  const rAFRef = useRef(null);
  // playStartTimeRef: adjusted start timestamp — shifted on resume to account for pause duration
  const playStartTimeRef = useRef(0);
  // pausedAtRef: records when we paused, so we can adjust playStartTimeRef on resume
  const pausedAtRef = useRef(0);
  // currentWordIndexRef: single source of truth for current word position (for jump/rewind)
  const currentWordIndexRef = useRef(-1);
  // utteranceIdRef: incremented for each new utterance, so stale handlers are ignored
  const utteranceIdRef = useRef(0);

  // Derived
  const isPlaying = playbackState === "playing";
  const isPaused = playbackState === "paused";
  const isActive = isPlaying || isPaused;
  const currentIndex = isScrubbing ? scrubIndex : activeIndex;

  // ── Keep refs in sync ────────────────────────────────────────────────────
  useEffect(() => { voicesRef.current = voices; }, [voices]);
  useEffect(() => { playbackRef.current = playbackState; }, [playbackState]);

  // ── Theme ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
      document.body.style.backgroundColor = "#020617";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
      document.body.style.backgroundColor = "#f5f5f4";
    }
    safeLocalStorage.setItem("pra-theme", theme);
  }, [theme]);

  // ── Persist settings ─────────────────────────────────────────────────────
  useEffect(() => { safeLocalStorage.setItem("pra-rate", String(rate)); }, [rate]);
  useEffect(() => {
    if (selectedVoice) safeLocalStorage.setItem("pra-voice", selectedVoice);
  }, [selectedVoice]);

  useEffect(() => { safeLocalStorage.setItem("pra-engine", ttsEngine); }, [ttsEngine]);
  useEffect(() => { safeLocalStorage.setItem("pra-sarvam-voice", sarvamVoice); }, [sarvamVoice]);

  // ── Sarvam AI Synthesis Client (via Vercel Serverless Backend) ──────────
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  }, []);

  const synthesizeSarvamSpeech = useCallback(async (targetText, pace) => {
    if (targetText.length > 2500) {
      throw new Error("Premium voices support up to 2,500 characters. Please shorten your text or use Native TTS.");
    }

    // Rate Limit Cooldown Check
    const now = Date.now();
    if (now - lastRequestTime.current < RATE_LIMIT_MS) {
      const remainingTime = Math.ceil((RATE_LIMIT_MS - (now - lastRequestTime.current)) / 1000);
      showToast(`Please wait ${remainingTime}s before generating again.`);
      return;
    }
    lastRequestTime.current = now;

    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: targetText,
        voice: sarvamVoice,
        pace: pace,
        languageCode: detectLanguageCode(targetText)
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error (${response.status})`);
    }

    const data = await response.json();
    if (!data.audios || data.audios.length === 0) {
      throw new Error("No audio was returned by the server.");
    }

    const base64Audio = data.audios[0];
    
    // Decode base64 to binary ArrayBuffer
    const binaryString = window.atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const audioBlob = new Blob([bytes.buffer], { type: "audio/mp3" });
    
    // Clean up previous blob URL if any
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    
    const url = URL.createObjectURL(audioBlob);
    audioUrlRef.current = url;
    return url;
  }, [sarvamVoice, showToast]);

  // ── Sarvam AI Audio Sync Loops ──────────────────────────────────────────
  const sarvamAnimationFrameRef = useRef(null);

  const syncSarvamHighlight = useCallback(() => {
    const audio = sarvamAudioRef.current;
    if (!audio || !audio.duration || words.length === 0) return;

    const { cumulative, totalWeight } = buildWeightedPositions(text);
    const progressFraction = audio.currentTime / audio.duration;
    const targetWeight = progressFraction * totalWeight;

    // Binary search for target character index
    let lo = 0, hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cumulative[mid] < targetWeight) lo = mid + 1;
      else hi = mid;
    }
    const estimatedCharPos = lo;

    // Find the word index by character position
    let idx = 0;
    for (let i = 0; i < words.length; i++) {
      if (words[i].charIndex <= estimatedCharPos) {
        idx = i;
      } else {
        break;
      }
    }

    setActiveIndex(idx);
    currentWordIndexRef.current = idx;
  }, [words, text]);

  const startSarvamSyncLoop = useCallback(() => {
    if (sarvamAnimationFrameRef.current) {
      cancelAnimationFrame(sarvamAnimationFrameRef.current);
    }
    const tick = () => {
      syncSarvamHighlight();
      sarvamAnimationFrameRef.current = requestAnimationFrame(tick);
    };
    sarvamAnimationFrameRef.current = requestAnimationFrame(tick);
  }, [syncSarvamHighlight]);

  const stopSarvamSyncLoop = useCallback(() => {
    if (sarvamAnimationFrameRef.current) {
      cancelAnimationFrame(sarvamAnimationFrameRef.current);
      sarvamAnimationFrameRef.current = null;
    }
  }, []);

  // ── Voice loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setError("Your browser does not support text-to-speech. Use Chrome or Edge.");
      return;
    }
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      const sorted = [...available].sort(
        (a, b) => rankVoice(a) - rankVoice(b) || a.name.localeCompare(b.name)
      );
      setVoices(sorted);
      // Auto-select best English voice only if nothing is saved
      if (!localStorage.getItem("pra-voice")) {
        const best =
          sorted.find((v) => v.lang.toLowerCase().startsWith("en") && rankVoice(v) === 0) ||
          sorted.find((v) => v.lang.toLowerCase().startsWith("en"));
        if (best) setSelectedVoice(best.name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  // ── Tokenize text ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Reset word refs array to avoid stale refs from previous text
    wordRefs.current = [];
    setWords(tokenizeText(text));
    // If text changes during playback, stop cleanly
    if (playbackState !== "idle") {
      window.speechSynthesis.cancel();
      setPlaybackState("idle");
      setActiveIndex(-1);
    }
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dynamic dock height for safe bottom padding ───────────────────────────
  // Replaces fragile pb-[22rem] magic number
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        "--dock-height",
        `${entry.contentRect.height + 16}px`
      );
    });
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

  // ── Viewport-aware scroll — stops layout thrashing ────────────────────────
  // Previous: scrollIntoView smooth on every word = 2-3 reflows/sec = jank
  // Now: only scrolls if the active word is outside the visible viewport
  useEffect(() => {
    if (currentIndex < 0) return;
    const el = wordRefs.current[currentIndex];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inView = rect.top >= 80 && rect.bottom <= window.innerHeight - 80;
    if (!inView) {
      el.scrollIntoView({ behavior: "instant", block: "center" });
    }
  }, [currentIndex]);

  // ── Filtered voices ───────────────────────────────────────────────────────
  const filteredVoices = useMemo(() => {
    if (languageFilter === "english")
      return voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
    if (languageFilter === "hindi") {
      return voices.filter((v) => {
        const lang = v.lang.toLowerCase();
        const name = v.name.toLowerCase();
        return (
          lang.includes("hi") ||
          lang.includes("india") ||
          name.includes("hindi") ||
          name.includes("india")
        );
      });
    }
    return voices;
  }, [voices, languageFilter]);

  // ── Boundary map ──────────────────────────────────────────────────────────
  const boundaryMap = useMemo(() => words.map((w) => w.charIndex), [words]);

  // ── Playback handlers ─────────────────────────────────────────────────────

  // Cancels the rAF-based fallback — called on stop, pause, and end.
  const clearFallbackTimer = useCallback(() => {
    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
      rAFRef.current = null;
    }
  }, []);

  // ── Self-calibrating speech speed memory ────────────────────────────────
  // After the first complete playback with a voice, we measure the actual
  // duration and compute real chars/sec. Subsequent plays with the same
  // voice + rate use the measured value instead of guessing.
  const voiceSpeedMapRef = useRef(new Map()); // key: "voiceName|rate" → charsPerMs

  // Startup delay: onstart fires ~300-500ms before audio actually begins.
  // We offset the timer start so highlighting doesn't run ahead at the beginning.
  const STARTUP_DELAY_MS = 350;

  // Default fallback: ~12 chars/sec at rate=1 (conservative — better to lag than lead).
  const DEFAULT_CHARS_PER_SEC = 12;

  // buildWeightedPositions is now a module-level pure utility function
  // (defined above the component). No useCallback needed.

  // Self-calibrating, punctuation-aware fallback highlight loop (rAF).
  //
  // How it works:
  //  1. On onstart, we delay by STARTUP_DELAY_MS, then begin the rAF loop
  //  2. Each frame: elapsed time → progress fraction → weighted char position → word index
  //  3. Punctuation causes the position to linger (weighted chars are "wider")
  //  4. If we have a measured speed for this voice (from a previous play), use it
  //  5. On onend, measure actual duration and save it for next time
  //
  // Killed instantly if a native onboundary event fires (Edge/Natural voices).
  const startFallbackTimer = useCallback((adjustedStartTime, fullText, bMap, speechRate, voiceKey, wordOffset = 0) => {
    if (rAFRef.current) cancelAnimationFrame(rAFRef.current);

    const { cumulative, totalWeight } = buildWeightedPositions(fullText);

    const measuredCharsPerMs = voiceSpeedMapRef.current.get(voiceKey);
    const charsPerMs = measuredCharsPerMs || (DEFAULT_CHARS_PER_SEC * speechRate) / 1000;
    const totalMs = fullText.length / charsPerMs;
    let prevIdx = -1;

    const tick = () => {
      const elapsed = Date.now() - adjustedStartTime;
      if (elapsed < 0) {
        rAFRef.current = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(elapsed / totalMs, 1);
      const targetWeight = progress * totalWeight;

      let lo = 0, hi = cumulative.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (cumulative[mid] < targetWeight) lo = mid + 1;
        else hi = mid;
      }
      const estimatedCharPos = lo;

      let idx = 0;
      for (let i = 0; i < bMap.length; i++) {
        if (bMap[i] <= estimatedCharPos) idx = i;
        else break;
      }

      const globalIdx = wordOffset + idx;
      if (globalIdx !== prevIdx) {
        prevIdx = globalIdx;
        setActiveIndex(globalIdx);
        currentWordIndexRef.current = globalIdx;
      }

      if (progress < 1) {
        rAFRef.current = requestAnimationFrame(tick);
      } else {
        rAFRef.current = null;
      }
    };

    rAFRef.current = requestAnimationFrame(tick);
  }, []);

  const resetPlayback = useCallback(() => {
    clearFallbackTimer();
    stopSarvamSyncLoop();
    if (sarvamAudioRef.current) {
      sarvamAudioRef.current.pause();
      sarvamAudioRef.current = null;
    }
    setPlaybackState("idle");
    setActiveIndex(-1);
    currentWordIndexRef.current = -1;
  }, [clearFallbackTimer, stopSarvamSyncLoop]);

  const handleStop = useCallback(() => {
    utteranceIdRef.current++;
    window.speechSynthesis.cancel();
    resetPlayback();
  }, [resetPlayback]);

  const handlePause = useCallback(() => {
    if (ttsEngine === "sarvam") {
      if (sarvamAudioRef.current) {
        sarvamAudioRef.current.pause();
      }
      stopSarvamSyncLoop();
    } else {
      window.speechSynthesis.pause();
      clearFallbackTimer();
    }
    pausedAtRef.current = Date.now();
    setPlaybackState("paused");
  }, [ttsEngine, clearFallbackTimer, stopSarvamSyncLoop]);

  // Attaches onstart/onboundary/onend/onerror to an utterance.
  // startOffset = global word index offset (>0 when jumping mid-text).
  // spokenText = the text this utterance will speak (may be a substring).
  // fullWords = the full words array for binary search mapping.
  const attachUtteranceHandlers = useCallback((utterance, startOffset, spokenText, fullWords, voiceKey, uttId) => {
    let nativeBoundaryWorking = false;
    let consecutiveZeroCharIndex = 0;
    let actualStartTime = 0;
    let fallbackStartedFromZeroGuard = false;

    // Build local boundary map for the spoken substring
    const baseCharOffset = startOffset > 0 ? fullWords[startOffset].charIndex : 0;
    const localWords = fullWords.slice(startOffset).map(w => ({
      ...w,
      charIndex: w.charIndex - baseCharOffset,
      charEnd: w.charEnd - baseCharOffset,
    }));
    const localBMap = localWords.map(w => w.charIndex);

    utterance.onstart = () => {
      if (utteranceIdRef.current !== uttId) return;
      setPlaybackState("playing");
      actualStartTime = Date.now();
      playStartTimeRef.current = Date.now() + STARTUP_DELAY_MS;
      startFallbackTimer(playStartTimeRef.current, spokenText, localBMap, utterance.rate, voiceKey, startOffset);

      // 500ms detection: if no onboundary fires, fallback is already running — good.
      // If onboundary DOES fire, it will kill the fallback.
    };

    utterance.onboundary = (event) => {
      if (utteranceIdRef.current !== uttId) return;
      if (event.name !== "word") return;

      // Guard: charIndex stuck at 0 for 3+ events → broken voice, use fallback
      if (event.charIndex === 0 && currentWordIndexRef.current > startOffset) {
        consecutiveZeroCharIndex++;
        if (consecutiveZeroCharIndex >= 3 && !fallbackStartedFromZeroGuard) {
          fallbackStartedFromZeroGuard = true;
          // Don't kill fallback — let it run. Just stop processing native events.
          return;
        }
      } else {
        consecutiveZeroCharIndex = 0;
      }

      if (fallbackStartedFromZeroGuard) return;

      // Native boundary works — kill fallback timer
      if (!nativeBoundaryWorking) {
        nativeBoundaryWorking = true;
        clearFallbackTimer();
      }

      // Binary search for word index using local word map
      const idx = findWordByCharIndex(event.charIndex, localWords);
      const globalIdx = startOffset + idx;
      setActiveIndex(globalIdx);
      currentWordIndexRef.current = globalIdx;
    };

    utterance.onend = () => {
      if (utteranceIdRef.current !== uttId) return;
      // Self-calibrate (only for full-text plays, not jumps)
      if (!nativeBoundaryWorking && actualStartTime > 0 && startOffset === 0) {
        const actualDuration = Date.now() - actualStartTime;
        if (actualDuration > 500 && spokenText.length > 10) {
          const measuredCharsPerMs = spokenText.length / actualDuration;
          voiceSpeedMapRef.current.set(voiceKey, measuredCharsPerMs);
        }
      }
      resetPlayback();
    };

    utterance.onerror = (e) => {
      if (utteranceIdRef.current !== uttId) return;
      if (e.error !== "interrupted") setError("Playback was interrupted.");
      resetPlayback();
    };
  }, [clearFallbackTimer, resetPlayback, startFallbackTimer]);

  const handlePlay = useCallback(async () => {
    setError("");
    if (!text.trim()) {
      setError("Add some text before pressing play.");
      return;
    }

    if (ttsEngine === "sarvam") {
      // Resume custom audio from pause
      if (playbackRef.current === "paused") {
        if (sarvamAudioRef.current) {
          sarvamAudioRef.current.play();
          startSarvamSyncLoop();
          setPlaybackState("playing");
        }
        return;
      }

      setIsFetching(true);
      setError("");
      try {
        const url = await synthesizeSarvamSpeech(text, rate);
        if (!url) {
          setIsFetching(false);
          return;
        }
        const audio = new Audio(url);
        sarvamAudioRef.current = audio;
        
        // Hook audio lifecycle events
        audio.onplay = () => {
          setPlaybackState("playing");
          startSarvamSyncLoop();
        };
        audio.onended = () => {
          resetPlayback();
        };
        audio.onerror = (e) => {
          setError("Audio playback failed.");
          resetPlayback();
        };

        currentWordIndexRef.current = 0;
        setActiveIndex(0);
        setActiveTab("read");

        await audio.play();
      } catch (err) {
        setError(err.message || "Failed to synthesize premium speech.");
        resetPlayback();
      } finally {
        setIsFetching(false);
      }
      return;
    }

    // Native Speech Engine
    const voiceKey = `${selectedVoice}|${rate}`;

    // Resume from pause
    if (playbackRef.current === "paused") {
      const pauseDuration = Date.now() - pausedAtRef.current;
      playStartTimeRef.current += pauseDuration;
      window.speechSynthesis.resume();
      setPlaybackState("playing");
      startFallbackTimer(playStartTimeRef.current, text, boundaryMap, rate, voiceKey);
      return;
    }

    utteranceIdRef.current++;
    const uttId = utteranceIdRef.current;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    const chosenVoice = voicesRef.current.find((v) => v.name === selectedVoice);
    if (chosenVoice) utterance.voice = chosenVoice;

    currentWordIndexRef.current = 0;
    attachUtteranceHandlers(utterance, 0, text, words, voiceKey, uttId);

    window.speechSynthesis.speak(utterance);
    setActiveTab("read");
  }, [text, rate, selectedVoice, boundaryMap, words, resetPlayback, startFallbackTimer, clearFallbackTimer, attachUtteranceHandlers, ttsEngine, synthesizeSarvamSpeech, startSarvamSyncLoop]);

  // ── Jump to word (rewind/forward) ──────────────────────────────────────────
  const jumpToWord = useCallback((targetIndex) => {
    if (words.length === 0) return;
    targetIndex = Math.max(0, Math.min(targetIndex, words.length - 1));

    if (ttsEngine === "sarvam") {
      const audio = sarvamAudioRef.current;
      if (audio && audio.duration) {
        const { cumulative, totalWeight } = buildWeightedPositions(text);
        const charPos = words[targetIndex].charIndex;
        const targetWeight = cumulative[charPos] || 0;
        const targetFraction = targetWeight / totalWeight;
        audio.currentTime = targetFraction * audio.duration;
        
        currentWordIndexRef.current = targetIndex;
        setActiveIndex(targetIndex);
        
        if (playbackRef.current !== "playing") {
          audio.play();
          setPlaybackState("playing");
          startSarvamSyncLoop();
        }
      }
      return;
    }

    // Native Speech Engine
    const voiceKey = `${selectedVoice}|${rate}`;

    // Build text from target word to end
    const jumpText = text.substring(words[targetIndex].charIndex);

    utteranceIdRef.current++;
    const uttId = utteranceIdRef.current;
    clearFallbackTimer();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(jumpText);
    utterance.rate = rate;
    const chosenVoice = voicesRef.current.find((v) => v.name === selectedVoice);
    if (chosenVoice) utterance.voice = chosenVoice;

    currentWordIndexRef.current = targetIndex;
    setActiveIndex(targetIndex);
    attachUtteranceHandlers(utterance, targetIndex, jumpText, words, voiceKey, uttId);

    window.speechSynthesis.speak(utterance);
    setPlaybackState("playing");
  }, [text, words, rate, selectedVoice, clearFallbackTimer, attachUtteranceHandlers, ttsEngine, startSarvamSyncLoop]);

  // ── Scrubbing Handlers ───────────────────────────────────────────────────
  const handleScrubStart = useCallback(() => {
    setIsScrubbing(true);
    const startVal = activeIndex >= 0 ? activeIndex : 0;
    setScrubIndex(startVal);
    scrubIndexRef.current = startVal;
    clearFallbackTimer();
    if (playbackState === "playing") {
      window.speechSynthesis.pause();
    }
  }, [activeIndex, playbackState, clearFallbackTimer]);

  const handleScrubChange = useCallback((e) => {
    const val = Number(e.target.value);
    scrubIndexRef.current = val;
    if (isScrubbing) {
      setScrubIndex(val);
    } else {
      jumpToWord(val);
    }
  }, [isScrubbing, jumpToWord]);

  const handleScrubEnd = useCallback(() => {
    setIsScrubbing(false);
    if (scrubIndexRef.current >= 0 && words.length > 0) {
      jumpToWord(scrubIndexRef.current);
    }
  }, [words.length, jumpToWord]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (playbackRef.current === "playing") handlePause();
        else handlePlay();
      }
      if (e.code === "Escape") handleStop();
      if (e.key === "ArrowLeft" && (playbackRef.current === "playing" || playbackRef.current === "paused")) {
        e.preventDefault();
        jumpToWord(currentWordIndexRef.current - 10);
      }
      if (e.key === "ArrowRight" && (playbackRef.current === "playing" || playbackRef.current === "paused")) {
        e.preventDefault();
        jumpToWord(currentWordIndexRef.current + 10);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePlay, handlePause, handleStop, jumpToWord]);

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".txt")) { setError("Only .txt files are supported."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("File too large. Max 5MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(sanitizeText(ev.target?.result || ""));
      setError("");
      setActiveTab("read");
    };
    reader.readAsText(file);
    // Reset so same file can be re-uploaded
    e.target.value = "";
  };

  const clearAll = () => {
    handleStop();
    setText("");
    setError("");
    setActiveTab("edit");
  };

  // ── Progress ──────────────────────────────────────────────────────────────
  const progress =
    words.length > 0 && currentIndex >= 0
      ? Math.round(((currentIndex + 1) / words.length) * 100)
      : 0;

  // Time estimates for progress display
  const avgWordSec = 0.3 / rate;
  const elapsedSec = currentIndex >= 0 ? (currentIndex + 1) * avgWordSec : 0;
  const remainingSec = currentIndex >= 0 ? (words.length - currentIndex - 1) * avgWordSec : words.length * avgWordSec;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className="app-container w-full max-w-3xl mx-auto px-3 sm:px-5 py-4 sm:py-6 min-h-screen flex flex-col relative overflow-x-hidden"
      style={{ paddingBottom: "var(--dock-height, 22rem)" }}
    >
      {/* Toast Alert */}
      {errorMessage && (
        <div className="absolute top-4 right-4 bg-red-50 text-red-600 px-4 py-2 rounded-md shadow-sm border border-red-100 text-sm animate-fade-in-down transition-all z-[100]">
          {errorMessage}
        </div>
      )}
      <header className="flex items-start sm:items-center justify-between gap-3 mb-4 sm:mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
            Lumina.
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
            Paste text or upload a .txt file. Listen with word-by-word highlighting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-11 h-11 shrink-0 rounded-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 motion-safe:transition-colors active:scale-95"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-5 rounded-2xl border border-gray-200 bg-[#fdfbf9] shadow-sm flex flex-col gap-4 animate-slide-down">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-500">
              Speech Preferences
            </h2>
            <button 
              onClick={() => setShowSettings(false)}
              className="text-xs text-gray-400 hover:text-slate-800 font-medium"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Engine Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">
                Synthesis Engine
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTtsEngine("native")}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${
                    ttsEngine === "native"
                      ? "bg-slate-800 border-slate-800 text-white shadow-sm"
                      : "border-gray-200 text-slate-600 bg-white hover:bg-slate-50"
                  }`}
                >
                  Native TTS (Free)
                </button>
                <button
                  onClick={() => setTtsEngine("sarvam")}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${
                    ttsEngine === "sarvam"
                      ? "bg-slate-800 border-slate-800 text-white shadow-sm"
                      : "border-gray-200 text-slate-600 bg-white hover:bg-slate-50"
                  }`}
                >
                  Sarvam AI (Premium)
                </button>
              </div>
            </div>

            {/* If Sarvam AI active: Premium Voices list */}
            {ttsEngine === "sarvam" && (
              <div className="flex flex-col gap-1.5 animate-slide-down">
                <label htmlFor="sarvam-voice-select" className="text-xs font-semibold text-slate-600">
                  Premium Neural Voice (`bulbul:v3`)
                </label>
                <select
                  id="sarvam-voice-select"
                  value={sarvamVoice}
                  onChange={(e) => setSarvamVoice(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white text-slate-800 px-3 py-2 text-xs outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800/10"
                >
                  <option value="shubh">Shubh (Male - Hindi & Multi-lingual)</option>
                  <option value="anushka">Anushka (Female - Hindi & Multi-lingual)</option>
                  <option value="aravind">Aravind (Male - Tamil / South Languages)</option>
                  <option value="kavya">Kavya (Female - Telugu / South Languages)</option>
                </select>
              </div>
            )}
          </div>

          {/* Sarvam AI — server-managed key notice */}
          {ttsEngine === "sarvam" && (
            <div className="border-t border-gray-100 pt-3 text-xs leading-relaxed">
              <span className="text-slate-500">
                Premium voices are powered by Sarvam AI. The API key is securely managed on the server.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-red-300 bg-red-50 dark:bg-red-950/60 dark:border-red-800 px-4 py-3 text-sm leading-relaxed text-red-800 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* Visually hidden live region — announces playback state to screen readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {isPlaying ? "Playing" : isPaused ? "Paused" : "Stopped"}
      </div>



      {/* Main card */}
      <div className="flex-1 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden flex flex-col">

        {/* Tab bar */}
        <div className="flex border-b border-stone-200 dark:border-stone-800">
          <button
            onClick={() => setActiveTab("edit")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "edit"
                ? "text-stone-900 dark:text-stone-100 border-b-2 border-blue-500"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            }`}
          >
            <Edit3 size={15} />
            Edit
          </button>
          <button
            onClick={() => setActiveTab("read")}
            disabled={!text.trim()}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === "read"
                ? "text-stone-900 dark:text-stone-100 border-b-2 border-blue-500"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            }`}
          >
            <BookOpen size={15} />
            Read
          </button>

          {/* Toolbar actions — right side of tab bar */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2 px-1 sm:px-3">
            <label
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800 text-[10px] sm:text-xs transition-colors active:scale-[0.98]"
              aria-label="Upload a .txt file"
            >
              <Upload size={13} />
              <span className="hidden xs:inline">Upload</span>
              <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
            </label>
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-[10px] sm:text-xs hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors active:scale-[0.98]"
              aria-label="Clear all text"
            >
              <Trash2 size={13} />
              <span className="hidden xs:inline">Clear</span>
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "edit" ? (
          <div className="flex-1 flex flex-col p-4 sm:p-5 gap-3">
            <textarea
              value={text}
              onChange={(e) => setText(sanitizeText(e.target.value))}
              placeholder="Paste your text here to start listening…"
              className="flex-1 min-h-[42vh] resize-y rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 p-4 text-base sm:text-lg leading-7 sm:leading-8 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 motion-safe:transition-colors"
              aria-label="Text input area"
            />
            <div className="flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
              <span>
                {text.trim()
                  ? `${words.length.toLocaleString()} words · ${text.trim().length.toLocaleString()} chars`
                  : "No text loaded"}
              </span>
              <span className="hidden sm:block">Paste text or upload a .txt file</span>
            </div>
          </div>
        ) : (
          // Read mode
          <div
            className="reading-area flex-1 overflow-auto p-5 sm:p-8 relative"
            role="region"
            aria-label="Reading area"
          >
            {isFetching && (
              <div className="absolute inset-0 bg-white/70 dark:bg-stone-900/70 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3 transition-opacity duration-300">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-blue-100 dark:border-blue-950 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin h-4 w-4 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Synthesizing Premium Neural Voice...
                </div>
              </div>
            )}
            {text.trim() ? (
              <div className="max-w-[68ch] mx-auto text-[1.08rem] sm:text-[1.15rem] leading-[1.9] sm:leading-[2.05] break-words select-none text-stone-800 dark:text-stone-200">
                {words.map((item, index) => (
                  <React.Fragment key={index}>
                    <WordSpan
                      word={item.word}
                      isActive={currentIndex === index}
                      spanRef={(el) => { wordRefs.current[index] = el; }}
                    />
                    {item.whitespace}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <div className="h-full min-h-[28vh] flex items-center justify-center text-stone-400 dark:text-stone-500 text-sm text-center px-4 leading-relaxed">
                Switch to Edit tab and add some text to begin.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fixed Bottom Dock ─────────────────────────────────────────────── */}
      <div
        ref={dockRef}
        className="dock-container fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl shadow-2xl dark:shadow-black/50 px-4 pt-4"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-3xl mx-auto flex flex-col gap-3.5">

          {/* Unified Interactive Scrubber */}
          {words.length > 0 && (
            <div className="flex flex-col gap-1 w-full mt-1">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 tabular-nums select-none shrink-0 min-w-[34px]">
                  {formatTime(elapsedSec)}
                </span>
                
                <div className="flex-1 relative group py-1">
                  <input
                    type="range"
                    min="0"
                    max={words.length - 1}
                    value={currentIndex >= 0 ? currentIndex : 0}
                    onMouseDown={handleScrubStart}
                    onTouchStart={handleScrubStart}
                    onChange={handleScrubChange}
                    onMouseUp={handleScrubEnd}
                    onTouchEnd={handleScrubEnd}
                    aria-label="Reading timeline scrubber"
                    aria-valuetext={`Word ${currentIndex + 1} of ${words.length}`}
                    className="scrubber-slider w-full cursor-pointer outline-none select-none"
                    style={{
                      '--slider-progress': `${progress}%`
                    }}
                  />
                </div>

                <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 tabular-nums select-none shrink-0 min-w-[38px] text-right">
                  −{formatTime(remainingSec)}
                </span>
              </div>
            </div>
          )}

          {/* Voice row */}
          {ttsEngine === "sarvam" ? (
            <div className="flex items-center justify-between p-3 rounded-2xl border border-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold text-stone-700 dark:text-stone-300 truncate">
                  Premium: <strong className="capitalize text-blue-600 dark:text-blue-400">{sarvamVoice}</strong>
                </span>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline shrink-0 ml-2"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="voice-select"
                  className="text-[10px] uppercase tracking-widest text-stone-400 dark:text-stone-500 font-medium"
                >
                  Voice
                </label>
                {/* Language filter group */}
                <div role="group" aria-label="Filter voices by language" className="flex items-center gap-1.5">
                  {["all", "english", "hindi"].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguageFilter(lang)}
                      aria-pressed={languageFilter === lang}
                      className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                        languageFilter === lang
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                      }`}
                    >
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <select
                id="voice-select"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                aria-label="Select voice"
                className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 px-3 py-2.5 text-sm min-h-[44px] motion-safe:transition-colors"
              >
                {filteredVoices.length > 0 ? (
                  filteredVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))
                ) : (
                  <option value="">No {languageFilter} voices found on this device</option>
                )}
              </select>

              {languageFilter === "hindi" && filteredVoices.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                  Install Hindi speech voices via your OS settings, then use Microsoft Edge.
                </p>
              )}
            </div>
          )}

          {/* Speed + playback row */}
          <div className="flex items-center gap-4">
            {/* Speed slider */}
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between text-[10px] uppercase tracking-widest text-stone-400 dark:text-stone-500">
                <span>Speed</span>
                <span>{rate.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.25"
                value={rate}
                disabled={isPlaying}
                onChange={(e) => setRate(Number(e.target.value))}
                aria-label="Playback speed"
                aria-valuetext={`${rate} times speed`}
                title={isPlaying ? "Stop playback to change speed" : "Adjust playback speed"}
                className="w-full accent-blue-600 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              />
            </div>

            {/* Rewind + Play/Pause + Forward + Stop */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => jumpToWord(currentWordIndexRef.current - 10)}
                disabled={!isActive}
                aria-label="Rewind 10 words"
                className="w-11 h-11 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 motion-safe:transition-transform"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
              </button>

              <button
                onClick={isPlaying ? handlePause : handlePlay}
                disabled={isFetching}
                aria-label={isFetching ? "Synthesizing..." : isPlaying ? "Pause" : isPaused ? "Resume" : "Play"}
                className="btn-play-main w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-80 motion-safe:transition-transform flex items-center justify-center text-white shadow-lg shadow-blue-500/25"
              >
                {isFetching ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : isPlaying ? (
                  <Pause size={20} />
                ) : (
                  <Play size={20} fill="white" />
                )}
              </button>

              <button
                onClick={() => jumpToWord(currentWordIndexRef.current + 10)}
                disabled={!isActive}
                aria-label="Forward 10 words"
                className="w-11 h-11 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 motion-safe:transition-transform"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
              </button>

              <button
                onClick={handleStop}
                disabled={!isActive}
                aria-label="Stop playback"
                className="w-11 h-11 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 motion-safe:transition-transform"
              >
                <Square size={16} />
              </button>
            </div>
          </div>

          {/* Keyboard hint + live progress */}
          <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500">
            <span className="hidden sm:inline">Space = Play/Pause · Esc = Stop · ← = −10 · → = +10</span>
            <span className="sm:hidden">Tap to play · swipe to scrub</span>
            {isActive && words.length > 0 && (
              <span>{progress}% · word {currentIndex + 1} of {words.length}</span>
            )}
          </div>

        </div>
      </div>


    </div>
  );
}

export default function PersonalReadingAssistant() {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100 overflow-x-hidden">
      <ReadingAssistantApp />
    </div>
  );
}
