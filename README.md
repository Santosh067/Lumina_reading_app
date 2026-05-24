# 📖 Lumina — Personal Reading Assistant

A premium, highly responsive Vite + React + Tailwind CSS web application designed to help users read and listen to text with real-time, word-by-word synchronized highlighting. The application features dual-engine text-to-speech capabilities, supporting both free local device voices and premium Indic neural voices via a secure serverless backend.

---

## 🚀 Key Features Completed

### 🎙️ Advanced Speech Engines
*   **Dual-Engine Architecture:** Seamless toggle between native browser Text-to-Speech (TTS) and Sarvam AI Premium neural voices.
*   **Sarvam AI Premium Voice Integration:** Integrated high-quality regional Indic neural voices using the `bulbul:v3` model (`Shubh`, `Anushka`, `Aravind`, `Kavya`).
*   **Smart Language Auto-Detection & Switching:** Instantly scans incoming text to detect regional script families (Hindi/Devanagari, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Gurmukhi, Odia), automatically configuring language codes and dynamically auto-selecting matching native or premium voices for zero-configuration playback.
*   **Secure Backend API Key Management:** Fully migrates voice synthesis requests to a secure serverless backend (`api/tts.js`) on Vercel to protect the Sarvam AI subscription key from client exposure.

### ⏱️ Dynamic Control Dock & Navigation
*   **Word-by-Word Highlighting Fallback:** A self-calibrating requestAnimationFrame (rAF) fallback highlighter for voices that do not support native `onboundary` tracking. Uses character weight mappings to account for punctuation pauses and spoken special characters.
*   **Self-Calibrating Speed Memory:** Tracks actual speech duration to measure real-time characters-per-millisecond speeds, correcting alignment drifts on subsequent plays.
*   **Timeline Scrubber:** Interactively scrub through the text via a custom range slider to skip directly to any word, recalculating elapsed/remaining time in real-time.
*   **Layout Thrashing Prevention:** Viewport-aware scrolling ensures the document only scrolls when the active word goes out of the visible screen area, eliminating rendering lag.
*   **Visual Distraction-Free Modes:** Dual **Edit** (large text input area and uploading actions) and **Read** (large, fluid typography with smooth contrast highlights) tabs.

### 🎨 Design System & Accessibility
*   **Responsive Media Player:** Beautiful bottom safe-area styling on iOS and Android, fluid tap dimensions (44px/56px target zones), and auto-scaling elements.
*   **High-Contrast Dark Mode:** Adaptive HSL color theme supporting manual toggles or inheriting OS-level system dark modes.
*   **Keyboard Shortcuts:** Full keyboard accessibility supporting spacebar (play/pause), escape (stop), and left/right arrows (rewind/forward by 10 words).
*   **Vector Brand Iconography:** Beautiful responsive inline SVG brand logo and adaptive browser tab favicon changing between light and dark modes based on system preferences.

---

## 🧠 AI Session Memory & Changelog (Date-Wise Report)

*This section serves as a persistent memory file for the AI assistant. In subsequent sessions, when greeting the assistant, it will read this section to understand precisely what has been done, what architectural choices were made, and how specific problems were resolved.*

### 📅 May 24, 2026

#### **What was done today:**
1.  **Repository Analysis & Mapping:** Inspected workspace files to map current structures and set up the `README.md` memory system.
2.  **Created `SettingsPanel.jsx`:** Implemented a new preferences modal overlay for configuring the Sarvam AI API Key securely in local storage, preventing raw repository key exposure.
3.  **Vercel Serverless API Migration:** Migrated premium synthesis requests to a secure serverless endpoint (`api/tts.js`) on Vercel. Set up proper CORS headers, validation checks, and securely managed environment variables, eliminating all client-side hardcoded API key leaks.
4.  **Integrated Preferences Modal in `App.jsx`:** Hooked up speech engine settings, streamlined the dock layout, and resolved ReferenceErrors resulting from the migration.
5.  **Tailwind Configurations Integration:** Overhauled [tailwind.config.js](file:///d:/Family%20Doc/Santosh%20Sharma/Business/Reading%20App/tailwind.config.js) to append the custom `fade-in-up` keyframes (`0% translateY(10px)` to `100% translateY(0)`) and animation class, adding a custom `xs` (480px) mobile breakpoint.
6.  **Defensive Storage Shield Implementation:** Engineered a `safeLocalStorage` try-catch utility in both `src/App.jsx` and `src/SettingsPanel.jsx` to prevent Brave Shields or sandbox cookies restrictions from denying storage access and crashing React.
7.  **Overhauled Mobile Responsiveness:** Enhanced vertical safe padding on mobile docks, added flex wrapping on small screen controls, shortened voice labels to prevent layout clipping, and added touch-friendly user instructions.
8.  **Git & GitHub Setup:** Initialized the Git repository, committed all files with production configs, and successfully pushed the codebase to `https://github.com/Santosh067/Lumina_reading_app.git`.
9.  **Vercel Production Deployment:** Deployed the full-stack web application live to Vercel at **`https://lumina-reading-app.vercel.app`** with full serverless functionality and CD integration.
10. **Rebranded to Lumina:** Renamed the entire application header from `Cadence.` to `Lumina.` and updated the browser tab title to `Lumina — Personal Reading Assistant`.
11. **Flawless Multilingual Highlight Fix:** Resolved a critical bug where Hindi text synthesis only read numbers and skipped words by rewriting the sanitization regex to allow Unicode Marks (`\p{M}`), fully preserving diacritics, conjuncts, and vowel signs.
12. **Added Auto-Language & Voice Swapping:** Implemented an active text listener that scans text language in real-time. If Hindi or other regional scripts are detected, it dynamically selects a compatible native voice, or automatically switches the engine to Sarvam AI (Premium) with the neural `shubh` voice.
13. **Responsive Vector Brand Logo & Adaptive Favicon:** Integrated a premium SVG vector logo mark in the header and an adaptive favicon in the HTML head that automatically transitions between slate-white in Dark Mode and dark-slate in Light Mode via CSS media queries.

#### **Problems Resolved:**
*   **Risk of Context Loss Across Agent Restarts:** Established the persistent `README.md` AI memory log to act as our primary context anchor.
*   **API Key Hardcoding Risk (Static Hosting Safe):** Fully moved the voice synthesis validation to a Vercel serverless backend, protecting user keys when deploying to public environments.
*   **Stale React Hook Callback Warns:** Confirmed mutable voice and playback references are bridged through refs.
*   **Blank Screen Render Crash (ReferenceErrors):** Fixed a blank mount screen on browser launch.
*   **Browser Sandbox Storage Crash (Brave Shields Block):** Safeguarded the application against `localStorage` blocks that crash standard React loads.
*   **Mobile Dock Clipping:** Re-aligned mobile viewport heights and flex behaviors to support extra-narrow screens perfectly.
*   **Hindi & Regional Script Text Corruption:** Solved the vowel-stripping issue by adding `\p{M}` to the whitelist filter, fully restoring regional reading capabilities.
*   **Mismatched English Voice on Hindi Texts:** Created the auto-language detector to auto-shift engine/voice preferences to matching neural premium scripts on non-English texts, ensuring high-fidelity spoken output.
*   **Browser Favicon Blank State:** Configured an adaptive vector brand favicon that auto-toggles light/dark states to remain highly visible.

#### **How they were resolved:**
*   **Serverless Endpoint & Vercel rewrite rules:** Built `api/tts.js` using Node standard request-response structures, mapping env variables (`SARVAM_API_KEY`) safely on the server side, and defined rewrites in `vercel.json`.
*   **Unicode Marks regex whitelist:** Modified the sanitation replace regex `[^\p{L}\p{N}\p{P}\p{Z}\s]` to `[^\p{L}\p{M}\p{N}\p{P}\p{Z}\s]`, allowing combining marks (`\p{M}`) to bypass sanitization.
*   **Language-detection hooks:** Bound a text listener hook in `App.jsx` comparing script scopes and auto-configuring `ttsEngine` state values alongside helpful toast alerts.
*   **Adaptive Media Query favicon:** Wrote a custom SVG containing embedded CSS media selectors (`@media (prefers-color-scheme: dark)`) to dynamically tint paths, linked via `<link rel="icon" type="image/svg+xml">`.

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
