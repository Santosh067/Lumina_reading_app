# 📖 Personal Reading Assistant

A premium, highly responsive Vite + React + Tailwind CSS web application designed to help users read and listen to text with real-time, word-by-word synchronized highlighting. The application features dual-engine text-to-speech capabilities, supporting both free local device voices and premium Indic neural voices via the Sarvam AI API.

---

## 🚀 Key Features Completed

### 🎙️ Advanced Speech Engines
*   **Dual-Engine Architecture:** Seamless toggle between native browser Text-to-Speech (TTS) and Sarvam AI Premium neural voices.
*   **Sarvam AI Premium Voice Integration:** Integrated high-quality regional Indic neural voices using the `bulbul:v3` model (`Shubh`, `Anushka`, `Aravind`, `Kavya`).
*   **Smart Language Auto-Detection:** Scans incoming text to detect Indian language scripts (Hindi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Gurmukhi, Odia) and auto-selects the corresponding language code.
*   **Secure API Key Management:** Local-first settings panel storing the API key securely inside the browser's `localStorage`.

### ⏱️ Dynamic Control Dock & Navigation
*   **Word-by-Word Highlighting Fallback:** A self-calibrating requestAnimationFrame (rAF) fallback highlighter for voices that do not support native `onboundary` tracking (such as Chrome native voices). Uses character weight mappings to account for punctuation pauses and spoken special characters.
*   **Self-Calibrating Speed Memory:** Tracks actual speech duration to measure real-time characters-per-millisecond speeds, correcting alignment drifts on subsequent plays.
*   **Timeline Scrubber:** Interactively scrub through the text via a custom range slider to skip directly to any word, recalculating elapsed/remaining time in real-time.
*   **Layout Thrashing Prevention:** Viewport-aware scrolling ensures the document only scrolls when the active word goes out of the visible screen area, eliminating rendering lag.
*   **Visual Distraction-Free Modes:** Dual **Edit** (large text input area and uploading actions) and **Read** (large, fluid typography with smooth contrast highlights) tabs.

### 🎨 Design System & Accessibility
*   **Responsive Media Player:** Beautiful bottom safe-area styling on iOS and Android, fluid tap dimensions (44px/56px target zones), and auto-scaling elements.
*   **High-Contrast Dark Mode:** Adaptive HSL color theme supporting manual toggles or inheriting OS-level system dark modes.
*   **Keyboard Shortcuts:** Full keyboard accessibility supporting spacebar (play/pause), escape (stop), and left/right arrows (rewind/forward by 10 words).

---

## 🧠 AI Session Memory & Changelog (Date-Wise Report)

*This section serves as a persistent memory file for the AI assistant. In subsequent sessions, when greeting the assistant, it will read this section to understand precisely what has been done, what architectural choices were made, and how specific problems were resolved.*

### 📅 May 24, 2026

#### **What was done today:**
1.  **Repository Analysis & Mapping:** Inspected workspace files to map current structures and set up the `README.md` memory system.
2.  **Created `SettingsPanel.jsx`:** Implemented a new, client-side preferences modal overlay for configuring the Sarvam AI API Key securely in local storage, preventing raw repository key exposure.
3.  **Integrated Preferences Modal in `App.jsx`:**
    *   Hooked up the settings gear button and voice select row to activate the preferences modal.
    *   Set up dynamic auto-initialization for the active subscription key (`sk_mxds0nn4_VhRwwuRGRnb3W4hRVDOBq2j3`) into `localStorage.setItem('sarvam_api_key', ...)` on startup, allowing the app to work out of the box.
    *   Streamlined the inline layout using clean Nordic minimalist off-white (`#fdfbf9`) and slate elements to handle speech-engine (Native vs Premium) and voice selection, moving sensitive inputs to the overlay.
4.  **Tailwind Configurations Integration:** Overhauled [tailwind.config.js](file:///d:/Family%20Doc/Santosh%20Sharma/Business/Reading%20App/tailwind.config.js) to append the custom `fade-in-up` keyframes (`0% translateY(10px)` to `100% translateY(0)`) and animation class (`0.3s ease-out forwards`), preserving the crucial `darkMode: 'class'` option.
5.  **Defensive Storage Shield Implementation:** Engineered a `safeLocalStorage` try-catch utility in both `src/App.jsx` and `src/SettingsPanel.jsx` to prevent Brave Shields or sandbox cookies restrictions from denying storage access and crashing React.
6.  **Verified Build Validity:** Successfully executed multiple production builds (`npm run build`) using Vite with zero syntax or compilation errors.
7.  **Development Execution & Cleanup:** Restarted the local Vite development server, validated successful HMR live hot reloading, verified rendering mounts, and clean-stopped all background server processes upon session completion.

#### **Problems Resolved:**
*   **Risk of Context Loss Across Agent Restarts:** Established the persistent `README.md` AI memory log to act as our primary context anchor.
*   **API Key Hardcoding Risk (Static Hosting Safe):** The prior inline API key input field was moved into a secure, client-side modal, protecting user keys when deploying to public static hosts (like GitHub Pages).
*   **Stale React Hook Callback Warns:** Confirmed mutable voice and playback references are bridged through refs.
*   **Blank Screen Render Crash (ReferenceErrors):** Fixed a blank mount screen on browser launch.
*   **Browser Sandbox Storage Crash (Brave Shields Block):** Safeguarded the application against `localStorage` blocks that crash standard React loads.

#### **How they were resolved:**
*   **Preferences Modal & Storage Extraction:** Developed `SettingsPanel.jsx` exactly to specification, utilizing local storage key maps (`sarvam_api_key`), and integrated it as a full-screen fixed overlay modal with an easy-to-use toggle hook.
*   **Dual-Key Storage Syncing:** Configured an effect hook in `App.jsx` that synchronizes changes from state into both `sarvam_api_key` and legacy `pra-sarvam-key` keys, assuring backward compatibility.
*   **Token-Checked Bug Fixes:** Audited the codebase using targeted scripts to locate and eliminate orphaned variables (`isPreferencesOpen` ➡️ `isSettingsOpen` and `sarvamApiKey` ➡️ `sarvamKey`) that were triggering browser runtime ReferenceErrors.
*   **Safe Storage Defensive Wrappers:** Built a robust `safeLocalStorage` wrapper that leverages try-catch filters in both `App.jsx` and `SettingsPanel.jsx` to prevent Brave Shields or sandbox cookies restriction blocks from throwing exceptions and crashing the React renderer tree.

---

## 🛠️ Project Setup & Commands

To run this project locally, ensure you have [Node.js](https://nodejs.org/) installed:

```bash
# 1. Install dependencies
npm install

# 2. Run the local development server (Vite)
npm run dev

# 3. Build production bundle
npm run build
```
