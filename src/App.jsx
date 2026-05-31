// Lumina — Personal Reading Assistant — Full Redesign
// UI restructured: 4-tab navigation, onboarding, voice selector, library, history, settings
// TTS logic, Sarvam AI backend, word-by-word highlighting: COMPLETELY UNCHANGED
// Bug fixes applied: A (cached weighted pos), C (auto-lang on play), D (spacebar trap),
//                    E (sarvam scrub pause), G (removed duplicate error state)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Square, Upload, Trash2, BookOpen, Edit3, Save, ChevronRight, Sparkles } from "lucide-react";
import OnboardingScreen from "./components/OnboardingScreen";
import BottomNav from "./components/BottomNav";
import VoiceSelector from "./components/VoiceSelector";
import LanguageSelector from "./components/LanguageSelector";
import LibraryTab from "./components/LibraryTab";
import HistoryTab from "./components/HistoryTab";
import SettingsTab from "./components/SettingsTab";

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
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_KEYWORDS = ["Natural", "Neural", "Google", "Microsoft", "Enhanced", "Premium"];

const SPOKEN_CHAR_WEIGHT = {
  '=': 6, '+': 4, '-': 5, '*': 7, '/': 5, '\\': 8, '%': 7, '^': 5,
  '~': 5, '|': 4, '&': 4, '<': 7, '>': 9,
  '(': 10, ')': 11, '[': 8, ']': 9, '{': 8, '}': 9,
  '.': 3, ',': 2, ';': 2, ':': 4, '!': 3, '?': 3, '"': 5, "'": 1.5,
  '`': 6, '—': 2, '–': 2, '\n': 2.5,
  '@': 3, '#': 4, '$': 6, '_': 8,
  '0': 4, '1': 3, '2': 3, '3': 4, '4': 3, '5': 4, '6': 3, '7': 5, '8': 3, '9': 4,
};

// ─── Pure Functions (module-level) ────────────────────────────────────────────

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

function sanitizeText(input) {
  return input
    .replace(/[\u{1F600}-\u{1F9FF}\u{1FA00}-\u{1FA9F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1FA70}-\u{1FAFF}\u{2300}-\u{23FF}\u{2B50}\u{2934}-\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}\u{200B}-\u{200F}\u{2028}-\u{202F}\u{2060}-\u{206F}\u{FEFF}]/gu, '')
    .replace(/[^\p{L}\p{M}\p{N}\p{P}\p{Z}\s]/gu, '')
    .replace(/[ \t]+/g, ' ');
}

function rankVoice(voice) {
  return PRIORITY_KEYWORDS.some((k) => voice.name.includes(k)) ? 0 : 1;
}

function detectLanguageCode(inputText) {
  if (/[\u0900-\u097F]/.test(inputText)) return "hi-IN";
  if (/[\u0980-\u09FF]/.test(inputText)) return "bn-IN";
  if (/[\u0A00-\u0A7F]/.test(inputText)) return "pa-IN";
  if (/[\u0A80-\u0AFF]/.test(inputText)) return "gu-IN";
  if (/[\u0B00-\u0B7F]/.test(inputText)) return "or-IN";
  if (/[\u0B80-\u0BFF]/.test(inputText)) return "ta-IN";
  if (/[\u0C00-\u0C7F]/.test(inputText)) return "te-IN";
  if (/[\u0C80-\u0CFF]/.test(inputText)) return "kn-IN";
  if (/[\u0D00-\u0D7F]/.test(inputText)) return "ml-IN";
  return "en-IN";
}

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

function buildWeightedPositions(fullText) {
  const weights = new Array(fullText.length);
  for (let i = 0; i < fullText.length; i++) {
    weights[i] = SPOKEN_CHAR_WEIGHT[fullText[i]] || 1.0;
  }
  const cumulative = new Array(fullText.length);
  cumulative[0] = weights[0];
  for (let i = 1; i < fullText.length; i++) {
    cumulative[i] = cumulative[i - 1] + weights[i];
  }
  const totalWeight = cumulative[fullText.length - 1];
  return { cumulative, totalWeight };
}

// ─── Library & History Persistence Helpers ────────────────────────────────────

function loadLibrary() {
  try {
    const raw = safeLocalStorage.getItem("lumina-library", "[]");
    return JSON.parse(raw);
  } catch { return []; }
}

function saveLibrary(items) {
  safeLocalStorage.setItem("lumina-library", JSON.stringify(items));
}

function loadHistory() {
  try {
    const raw = safeLocalStorage.getItem("lumina-history", "[]");
    return JSON.parse(raw);
  } catch { return []; }
}

function saveHistory(sessions) {
  safeLocalStorage.setItem("lumina-history", JSON.stringify(sessions.slice(0, 50))); // cap at 50
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const WordSpan = React.memo(function WordSpan({ word, isActive, spanRef }) {
  return (
    <span
      ref={spanRef}
      className={
        isActive
          ? "rounded px-[3px] py-[1px] bg-indigo-200 text-indigo-900 dark:bg-indigo-600 dark:text-indigo-50 motion-safe:transition-colors motion-safe:duration-75"
          : undefined
      }
    >
      {word}
    </span>
  );
});

// ─── Main App ─────────────────────────────────────────────────────────────────

function ReadingAssistantApp() {
  // ── Navigation & Onboarding ────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return safeLocalStorage.getItem("lumina-onboarded") !== "true";
  });
  const [activeNavTab, setActiveNavTab] = useState("home"); // 'home' | 'library' | 'history' | 'settings'
  const [showVoicePanel, setShowVoicePanel] = useState(false);

  // ── Library & History ──────────────────────────────────────────────────
  const [libraryItems, setLibraryItems] = useState(loadLibrary);
  const [historySessions, setHistorySessions] = useState(loadHistory);

  // ── Persisted state ──────────────────────────────────────────────────────
  const [selectedVoice, setSelectedVoice] = useState(
    () => safeLocalStorage.getItem("pra-voice") || ""
  );
  const [rate, setRate] = useState(
    () => Number(safeLocalStorage.getItem("pra-rate") || 1)
  );
  const [theme, setTheme] = useState(() => {
    const saved = safeLocalStorage.getItem("pra-theme");
    if (saved === "system" || !saved) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return saved;
  });
  const [themePreference, setThemePreference] = useState(
    () => safeLocalStorage.getItem("pra-theme") || "system"
  );

  // ── Core state ───────────────────────────────────────────────────────────
  const [text, setText] = useState("");
  const [words, setWords] = useState([]);
  const [voices, setVoices] = useState([]);
  const [languageCode, setLanguageCode] = useState("auto"); // language selector value
  const [playbackState, setPlaybackState] = useState("idle"); // 'idle' | 'playing' | 'paused'
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("edit"); // 'edit' | 'read'

  // Scrubbing states
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubIndex, setScrubIndex] = useState(-1);
  const scrubIndexRef = useRef(-1);

  // Sarvam AI States
  const [ttsEngine, setTtsEngine] = useState(() => safeLocalStorage.getItem("pra-engine") || "native");
  const [sarvamVoice, setSarvamVoice] = useState(() => safeLocalStorage.getItem("pra-sarvam-voice") || "shubh");
  const [isFetching, setIsFetching] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // ── Refs ─────────────────────────────────────────────────────────────────
  const wordRefs = useRef([]);
  const dockRef = useRef(null);
  const sarvamAudioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const lastRequestTime = useRef(0);
  const RATE_LIMIT_MS = 2500;
  const voicesRef = useRef(voices);
  const playbackRef = useRef(playbackState);
  const rAFRef = useRef(null);
  const playStartTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const currentWordIndexRef = useRef(-1);
  const utteranceIdRef = useRef(0);
  // BUG FIX A: Cache weighted positions — recalculated only when text changes
  const weightedPosRef = useRef(null);
  const playStartTextRef = useRef(""); // track text at play start for history

  // Derived
  const isPlaying = playbackState === "playing";
  const isPaused = playbackState === "paused";
  const isActive = isPlaying || isPaused;
  const currentIndex = isScrubbing ? scrubIndex : activeIndex;

  // ── Keep refs in sync ────────────────────────────────────────────────────
  useEffect(() => { voicesRef.current = voices; }, [voices]);
  useEffect(() => { playbackRef.current = playbackState; }, [playbackState]);

  // ── BUG FIX A: Cache weighted positions on text change ────────────────
  useEffect(() => {
    if (text && text.length > 0) {
      weightedPosRef.current = buildWeightedPositions(text);
    } else {
      weightedPosRef.current = null;
    }
  }, [text]);

  // ── Theme ────────────────────────────────────────────────────────────────
  const handleThemeChange = useCallback((preference) => {
    setThemePreference(preference);
    safeLocalStorage.setItem("pra-theme", preference);
    if (preference === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(isDark ? "dark" : "light");
    } else {
      setTheme(preference);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
      document.body.style.backgroundColor = "#0a0a0a";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
      document.body.style.backgroundColor = "#f5f5f4";
    }
  }, [theme]);

  // ── System theme listener ──────────────────────────────────────────────
  useEffect(() => {
    if (themePreference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themePreference]);

  // ── Persist settings ─────────────────────────────────────────────────────
  useEffect(() => { safeLocalStorage.setItem("pra-rate", String(rate)); }, [rate]);
  useEffect(() => {
    if (selectedVoice) safeLocalStorage.setItem("pra-voice", selectedVoice);
  }, [selectedVoice]);
  useEffect(() => { safeLocalStorage.setItem("pra-engine", ttsEngine); }, [ttsEngine]);
  useEffect(() => { safeLocalStorage.setItem("pra-sarvam-voice", sarvamVoice); }, [sarvamVoice]);

  // ── Library Persistence ────────────────────────────────────────────────
  useEffect(() => { saveLibrary(libraryItems); }, [libraryItems]);
  useEffect(() => { saveHistory(historySessions); }, [historySessions]);

  // ── Onboarding ─────────────────────────────────────────────────────────
  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    safeLocalStorage.setItem("lumina-onboarded", "true");
  }, []);

  // ── Toast ───────────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  }, []);

  // ── Sarvam AI Synthesis Client ──────────────────────────────────────────
  const synthesizeSarvamSpeech = useCallback(async (targetText, pace) => {
    if (targetText.length > 2500) {
      throw new Error("Premium voices support up to 2,500 characters. Please shorten your text or use Native TTS.");
    }
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
      const errMsg = (errData.error && typeof errData.error === 'object')
        ? (errData.error.message || JSON.stringify(errData.error))
        : (errData.error || `Server error (${response.status})`);
      throw new Error(errMsg);
    }

    const data = await response.json();
    if (!data.audios || data.audios.length === 0) {
      throw new Error("No audio was returned by the server.");
    }

    const base64Audio = data.audios[0];
    const binaryString = window.atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes.buffer], { type: "audio/mp3" });
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    const url = URL.createObjectURL(audioBlob);
    audioUrlRef.current = url;
    return url;
  }, [sarvamVoice, showToast]);

  // ── Sarvam AI Audio Sync Loops ──────────────────────────────────────────
  const sarvamAnimationFrameRef = useRef(null);

  // BUG FIX A: Uses cached weighted positions instead of recalculating every frame
  const syncSarvamHighlight = useCallback(() => {
    const audio = sarvamAudioRef.current;
    if (!audio || !audio.duration || words.length === 0) return;

    const cached = weightedPosRef.current;
    if (!cached) return;
    const { cumulative, totalWeight } = cached;

    const progressFraction = audio.currentTime / audio.duration;
    const targetWeight = progressFraction * totalWeight;

    let lo = 0, hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cumulative[mid] < targetWeight) lo = mid + 1;
      else hi = mid;
    }
    const estimatedCharPos = lo;

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
  }, [words]);

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
      if (!localStorage.getItem("pra-voice")) {
        const best =
          sorted.find((v) => v.lang.toLowerCase().startsWith("en") && rankVoice(v) === 0) ||
          sorted.find((v) => v.lang.toLowerCase().startsWith("en"));
        if (best) setSelectedVoice(best.name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null; // BUG FIX: clean up event listener
      window.speechSynthesis.cancel();
    };
  }, []);

  // ── Tokenize text ─────────────────────────────────────────────────────────
  useEffect(() => {
    wordRefs.current = [];
    setWords(tokenizeText(text));
    if (playbackState !== "idle") {
      window.speechSynthesis.cancel();
      setPlaybackState("idle");
      setActiveIndex(-1);
    }
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── BUG FIX C: Auto Language Detection — only fires on PLAY, not on every keystroke ──
  // Moved the auto-detection logic into handlePlay instead of a useEffect on [text]
  const autoDetectAndSwitchLanguage = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || voices.length === 0) return;

    const detectedLang = detectLanguageCode(trimmed);
    if (detectedLang === "hi-IN") {
      if (ttsEngine === "native") {
        setTtsEngine("sarvam");
        setSarvamVoice("shubh");
        showToast("Hindi text detected! Switched to Premium neural voice for high-quality reading.");
      }
    } else if (["bn-IN", "pa-IN", "gu-IN", "or-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN"].includes(detectedLang)) {
      if (ttsEngine === "native") {
        setTtsEngine("sarvam");
        const targetVoice = ["ta-IN", "te-IN", "kn-IN", "ml-IN"].includes(detectedLang)
          ? (detectedLang === "ta-IN" ? "gokul" : "kavya")
          : "shubh";
        setSarvamVoice(targetVoice);
        showToast("Regional script detected! Switched to Premium neural voice for perfect accent support.");
      }
    }
  }, [text, voices, ttsEngine, showToast]);

  // ── Dynamic dock height for safe bottom padding ───────────────────────────
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

  // ── Viewport-aware scroll ────────────────────────────────────────────────
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

  // ── Filtered voices (for VoiceSelector native list) ────────────────────
  const filteredVoices = useMemo(() => voices, [voices]);

  // ── Boundary map ──────────────────────────────────────────────────────────
  const boundaryMap = useMemo(() => words.map((w) => w.charIndex), [words]);

  // ── Playback handlers ─────────────────────────────────────────────────────

  const clearFallbackTimer = useCallback(() => {
    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
      rAFRef.current = null;
    }
  }, []);

  const voiceSpeedMapRef = useRef(new Map());
  const STARTUP_DELAY_MS = 350;
  const DEFAULT_CHARS_PER_SEC = 12;

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

  // ── History: save session on playback end ────────────────────────────────
  const saveToHistory = useCallback((voiceName, engine, durationSec) => {
    const snippet = playStartTextRef.current;
    if (!snippet || snippet.length < 3) return;
    const session = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      textSnippet: snippet.substring(0, 120),
      voiceName: voiceName || "Unknown",
      duration: Math.round(durationSec || 0),
      date: new Date().toISOString(),
      engine: engine || "native",
      fullText: snippet,
    };
    setHistorySessions(prev => [session, ...prev].slice(0, 50));
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

  const attachUtteranceHandlers = useCallback((utterance, startOffset, spokenText, fullWords, voiceKey, uttId) => {
    let nativeBoundaryWorking = false;
    let consecutiveZeroCharIndex = 0;
    let actualStartTime = 0;
    let fallbackStartedFromZeroGuard = false;

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
    };

    utterance.onboundary = (event) => {
      if (utteranceIdRef.current !== uttId) return;
      if (event.name !== "word") return;

      if (event.charIndex === 0 && currentWordIndexRef.current > startOffset) {
        consecutiveZeroCharIndex++;
        if (consecutiveZeroCharIndex >= 3 && !fallbackStartedFromZeroGuard) {
          fallbackStartedFromZeroGuard = true;
          return;
        }
      } else {
        consecutiveZeroCharIndex = 0;
      }

      if (fallbackStartedFromZeroGuard) return;

      if (!nativeBoundaryWorking) {
        nativeBoundaryWorking = true;
        clearFallbackTimer();
      }

      const idx = findWordByCharIndex(event.charIndex, localWords);
      const globalIdx = startOffset + idx;
      setActiveIndex(globalIdx);
      currentWordIndexRef.current = globalIdx;
    };

    utterance.onend = () => {
      if (utteranceIdRef.current !== uttId) return;
      if (!nativeBoundaryWorking && actualStartTime > 0 && startOffset === 0) {
        const actualDuration = Date.now() - actualStartTime;
        if (actualDuration > 500 && spokenText.length > 10) {
          const measuredCharsPerMs = spokenText.length / actualDuration;
          voiceSpeedMapRef.current.set(voiceKey, measuredCharsPerMs);
        }
      }
      // Save to history on playback complete
      const duration = actualStartTime > 0 ? (Date.now() - actualStartTime) / 1000 : 0;
      saveToHistory(voiceKey.split('|')[0], 'native', duration);
      resetPlayback();
    };

    utterance.onerror = (e) => {
      if (utteranceIdRef.current !== uttId) return;
      if (e.error !== "interrupted") setError("Playback was interrupted.");
      resetPlayback();
    };
  }, [clearFallbackTimer, resetPlayback, startFallbackTimer, saveToHistory]);

  const handlePlay = useCallback(async () => {
    setError("");
    if (!text.trim()) {
      setError("Add some text before pressing play.");
      return;
    }

    // BUG FIX C: Auto-language detect fires HERE on play, not on every keystroke
    autoDetectAndSwitchLanguage();

    // Record text for history
    playStartTextRef.current = text.trim();

    if (ttsEngine === "sarvam") {
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
        const playStartTime = Date.now();

        audio.onplay = () => {
          setPlaybackState("playing");
          startSarvamSyncLoop();
        };
        audio.onended = () => {
          const duration = (Date.now() - playStartTime) / 1000;
          saveToHistory(sarvamVoice, 'sarvam', duration);
          resetPlayback();
        };
        audio.onerror = () => {
          setError("Audio playback failed.");
          resetPlayback();
        };

        currentWordIndexRef.current = 0;
        setActiveIndex(0);
        setActiveView("read");

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
    setActiveView("read");
  }, [text, rate, selectedVoice, boundaryMap, words, resetPlayback, startFallbackTimer, clearFallbackTimer, attachUtteranceHandlers, ttsEngine, synthesizeSarvamSpeech, startSarvamSyncLoop, autoDetectAndSwitchLanguage, saveToHistory, sarvamVoice]);

  // ── Jump to word ──────────────────────────────────────────────────────────
  const jumpToWord = useCallback((targetIndex) => {
    if (words.length === 0) return;
    targetIndex = Math.max(0, Math.min(targetIndex, words.length - 1));

    if (ttsEngine === "sarvam") {
      const audio = sarvamAudioRef.current;
      if (audio && audio.duration) {
        const cached = weightedPosRef.current;
        if (!cached) return;
        const { cumulative, totalWeight } = cached;
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

    const voiceKey = `${selectedVoice}|${rate}`;
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
      // BUG FIX E: Also pause Sarvam audio during scrubbing
      if (ttsEngine === "sarvam" && sarvamAudioRef.current) {
        sarvamAudioRef.current.pause();
        stopSarvamSyncLoop();
      }
    }
  }, [activeIndex, playbackState, clearFallbackTimer, ttsEngine, stopSarvamSyncLoop]);

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

  // ── BUG FIX D: Keyboard shortcuts — excludes BUTTON and A from spacebar trap ──
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || tag === "BUTTON" || tag === "A") return;
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
      setActiveView("read");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const clearAll = () => {
    handleStop();
    setText("");
    setError("");
    setActiveView("edit");
  };

  // ── Library Actions ─────────────────────────────────────────────────────
  const handleSaveToLibrary = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      showToast("No text to save. Add some text first.");
      return;
    }
    const title = trimmed.substring(0, 60).replace(/\s+/g, ' ');
    const newItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setLibraryItems(prev => [newItem, ...prev]);
    showToast("Text saved to Library ✓");
  }, [text, showToast]);

  const handleLibraryLoad = useCallback((item) => {
    setText(item.text);
    setActiveNavTab("home");
    setActiveView("read");
    showToast(`Loaded "${item.title.substring(0, 30)}…"`);
  }, [showToast]);

  const handleLibraryDelete = useCallback((id) => {
    setLibraryItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // ── History Actions ─────────────────────────────────────────────────────
  const handleHistoryReplay = useCallback((session) => {
    if (session.fullText) {
      setText(session.fullText);
    } else {
      setText(session.textSnippet);
    }
    setActiveNavTab("home");
    setActiveView("read");
    showToast("Session loaded — tap Play to start");
  }, [showToast]);

  const handleHistoryDelete = useCallback((id) => {
    setHistorySessions(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistorySessions([]);
    showToast("History cleared");
  }, [showToast]);

  // ── Settings Actions ────────────────────────────────────────────────────
  const handleResetSettings = useCallback(() => {
    setRate(1);
    setTtsEngine("native");
    setSarvamVoice("shubh");
    handleThemeChange("system");
    showToast("Settings reset to defaults");
  }, [showToast, handleThemeChange]);

  // ── Progress ──────────────────────────────────────────────────────────────
  const progress =
    words.length > 0 && currentIndex >= 0
      ? Math.round(((currentIndex + 1) / words.length) * 100)
      : 0;

  const avgWordSec = 0.3 / rate;
  const elapsedSec = currentIndex >= 0 ? (currentIndex + 1) * avgWordSec : 0;
  const remainingSec = currentIndex >= 0 ? (words.length - currentIndex - 1) * avgWordSec : words.length * avgWordSec;

  // Get current voice display name for the voice pill
  const currentVoiceDisplay = ttsEngine === "sarvam"
    ? `${sarvamVoice.charAt(0).toUpperCase() + sarvamVoice.slice(1)} (Premium)`
    : (selectedVoice ? selectedVoice.split(' ').slice(0, 2).join(' ') : "Select Voice");

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 dark:bg-[#0a0a0a] dark:text-stone-100 overflow-x-hidden">

      {/* ── Onboarding Screen ──────────────────────────────────────────── */}
      {showOnboarding && (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      )}

      {/* ── Toast Notification ─────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[150] px-5 py-3 rounded-2xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-sm font-medium shadow-2xl animate-fade-in-down max-w-sm text-center">
          {toastMessage}
        </div>
      )}

      {/* ── Voice Selector Panel ───────────────────────────────────────── */}
      <VoiceSelector
        isOpen={showVoicePanel}
        voices={filteredVoices}
        selectedVoice={selectedVoice}
        sarvamVoice={sarvamVoice}
        ttsEngine={ttsEngine}
        onVoiceChange={setSelectedVoice}
        onSarvamVoiceChange={setSarvamVoice}
        onEngineChange={setTtsEngine}
        onClose={() => setShowVoicePanel(false)}
      />

      {/* ── Main Content Area ──────────────────────────────────────────── */}
      <div
        className="app-container w-full max-w-3xl mx-auto px-4 sm:px-6 pb-24 min-h-screen flex flex-col"
      >
        {/* ── HOME TAB ────────────────────────────────────────────────── */}
        {activeNavTab === "home" && (
          <div className="flex-1 flex flex-col pt-6 animate-fade-in">

            {/* ── Header ──────────────────────────────────────────────── */}
            <header className="mb-6">
              <div className="flex items-center gap-3 mb-1">
                <img
                  src="/brand/lumina-logo-black-text.png"
                  alt=""
                  aria-hidden="true"
                  className="h-10 w-auto object-contain dark:hidden"
                  draggable="false"
                />
                <img
                  src="/brand/lumina-logo-white-text.png"
                  alt=""
                  aria-hidden="true"
                  className="hidden h-10 w-auto object-contain dark:block"
                  draggable="false"
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white mt-4">
                Hello <Sparkles size={24} className="inline text-indigo-500" />
              </h1>
              <p className="text-stone-500 dark:text-stone-400 text-sm sm:text-base mt-1">
                What would you like to hear today?
              </p>
            </header>

            {/* ── Error Alert ──────────────────────────────────────────── */}
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-2xl border border-red-300 bg-red-50 dark:bg-red-950/60 dark:border-red-800 px-4 py-3 text-sm leading-relaxed text-red-800 dark:text-red-300 animate-fade-in-down"
              >
                {error}
              </div>
            )}

            {/* Visually hidden live region */}
            <div role="status" aria-live="polite" className="sr-only">
              {isPlaying ? "Playing" : isPaused ? "Paused" : "Stopped"}
            </div>

            {/* ── Main Content Card ───────────────────────────────────── */}
            <div className="flex-1 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden flex flex-col">

              {/* Tab bar */}
              <div className="flex border-b border-stone-200 dark:border-stone-800">
                <button
                  onClick={() => setActiveView("edit")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeView === "edit"
                      ? "text-stone-900 dark:text-stone-100 border-b-2 border-indigo-500"
                      : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                  }`}
                >
                  <Edit3 size={15} />
                  Edit
                </button>
                <button
                  onClick={() => setActiveView("read")}
                  disabled={!text.trim()}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeView === "read"
                      ? "text-stone-900 dark:text-stone-100 border-b-2 border-indigo-500"
                      : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                  }`}
                >
                  <BookOpen size={15} />
                  Read
                </button>

                {/* Toolbar actions — right side */}
                <div className="ml-auto flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
                  <label
                    className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800 text-[10px] sm:text-xs transition-colors active:scale-[0.98]"
                    aria-label="Upload a .txt file"
                  >
                    <Upload size={13} />
                    <span className="hidden xs:inline">Upload</span>
                    <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
                  </label>
                  {text.trim() && (
                    <button
                      onClick={handleSaveToLibrary}
                      className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[10px] sm:text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors active:scale-[0.98] font-medium"
                      aria-label="Save to library"
                    >
                      <Save size={13} />
                      <span className="hidden xs:inline">Save</span>
                    </button>
                  )}
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
              {activeView === "edit" ? (
                <div className="flex-1 flex flex-col p-4 sm:p-5 gap-3">
                  <textarea
                    value={text}
                    onChange={(e) => setText(sanitizeText(e.target.value))}
                    placeholder="Type or paste your text here..."
                    className="flex-1 min-h-[30vh] resize-y rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 p-4 text-base sm:text-lg leading-7 sm:leading-8 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 motion-safe:transition-colors"
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
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-indigo-100 dark:border-indigo-950 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        <svg className="animate-spin h-4 w-4 text-indigo-500 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

            {/* ── Voice & Language Selectors ───────────────────────────── */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <button
                onClick={() => setShowVoicePanel(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm font-medium text-stone-700 dark:text-stone-200 hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
              >
                <span className="text-stone-400">🎙</span>
                <span className="truncate max-w-[160px]">{currentVoiceDisplay}</span>
                <ChevronRight size={14} className="text-stone-400" />
              </button>
              <LanguageSelector
                value={languageCode}
                onChange={setLanguageCode}
                disabled={isPlaying}
              />
            </div>

            {/* ── Speed Slider ─────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mt-3 px-1">
              <span className="text-xs text-stone-400 dark:text-stone-500 font-medium w-10">Speed</span>
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
                className="flex-1 h-1.5 rounded-full appearance-none bg-stone-200 dark:bg-stone-700 accent-indigo-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-stone-500 dark:text-stone-400 font-semibold tabular-nums w-10 text-right">{rate.toFixed(1)}×</span>
            </div>

            {/* ── Generate Speech Button ───────────────────────────────── */}
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              disabled={isFetching}
              className="mt-4 w-full h-14 rounded-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-semibold text-base flex items-center justify-center gap-2.5 hover:opacity-90 active:scale-[0.98] disabled:opacity-70 motion-safe:transition-all shadow-lg shadow-stone-900/10 dark:shadow-white/5"
            >
              {isFetching ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : isPlaying ? (
                <>
                  <Pause size={18} />
                  Pause
                </>
              ) : isPaused ? (
                <>
                  <Play size={18} fill="currentColor" />
                  Resume
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" />
                  Generate Speech
                </>
              )}
            </button>

            {/* ── Playback Controls (visible when active) ─────────────── */}
            {isActive && words.length > 0 && (
              <div className="mt-4 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 animate-fade-in-up">
                {/* Scrubber */}
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
                      style={{ '--slider-progress': `${progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 tabular-nums select-none shrink-0 min-w-[38px] text-right">
                    −{formatTime(remainingSec)}
                  </span>
                </div>

                {/* Control buttons */}
                <div className="flex items-center justify-center gap-4 mt-3">
                  <button
                    onClick={() => jumpToWord(currentWordIndexRef.current - 10)}
                    disabled={!isActive}
                    aria-label="Rewind 10 words"
                    className="w-10 h-10 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 motion-safe:transition-transform"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
                  </button>

                  <button
                    onClick={isPlaying ? handlePause : handlePlay}
                    aria-label={isPlaying ? "Pause" : "Resume"}
                    className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 motion-safe:transition-transform flex items-center justify-center text-white shadow-lg shadow-indigo-500/25"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} fill="white" />}
                  </button>

                  <button
                    onClick={() => jumpToWord(currentWordIndexRef.current + 10)}
                    disabled={!isActive}
                    aria-label="Forward 10 words"
                    className="w-10 h-10 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 motion-safe:transition-transform"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
                  </button>

                  <button
                    onClick={handleStop}
                    disabled={!isActive}
                    aria-label="Stop playback"
                    className="w-10 h-10 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 motion-safe:transition-transform"
                  >
                    <Square size={14} />
                  </button>
                </div>

                {/* Progress info */}
                <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500 mt-3">
                  <span className="hidden sm:inline">Space = Play/Pause · Esc = Stop · ← = −10 · → = +10</span>
                  <span className="sm:hidden">Tap controls or swipe scrubber</span>
                  <span>{progress}% · word {currentIndex + 1} of {words.length}</span>
                </div>
              </div>
            )}

            {/* Bottom spacer for nav */}
            <div className="h-4" />
          </div>
        )}

        {/* ── LIBRARY TAB ──────────────────────────────────────────────── */}
        {activeNavTab === "library" && (
          <div className="flex-1 pt-2 animate-fade-in">
            <LibraryTab
              items={libraryItems}
              onLoad={handleLibraryLoad}
              onDelete={handleLibraryDelete}
              onSave={handleSaveToLibrary}
            />
          </div>
        )}

        {/* ── HISTORY TAB ──────────────────────────────────────────────── */}
        {activeNavTab === "history" && (
          <div className="flex-1 pt-2 animate-fade-in">
            <HistoryTab
              sessions={historySessions}
              onReplay={handleHistoryReplay}
              onDelete={handleHistoryDelete}
              onClearAll={handleClearHistory}
            />
          </div>
        )}

        {/* ── SETTINGS TAB ─────────────────────────────────────────────── */}
        {activeNavTab === "settings" && (
          <div className="flex-1 pt-2 animate-fade-in">
            <SettingsTab
              theme={themePreference}
              onThemeChange={handleThemeChange}
              rate={rate}
              onRateChange={setRate}
              ttsEngine={ttsEngine}
              onEngineChange={setTtsEngine}
              onClearHistory={handleClearHistory}
              onResetSettings={handleResetSettings}
            />
          </div>
        )}
      </div>

      {/* ── Bottom Navigation ────────────────────────────────────────── */}
      <BottomNav
        activeTab={activeNavTab}
        onTabChange={setActiveNavTab}
      />
    </div>
  );
}

export default ReadingAssistantApp;
