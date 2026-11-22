# SpeakUp AI V1 — Master Architecture (v10.2 Unlimited Android Voice Edition)

## 1. Core Product Identity
- **Target Platform:** 100% Android-Only Progressive Web App (Chrome, Brave, Edge). Zero iOS/Safari code.
- **UI Frame:** Strict mobile-only centered frame (`max-w-[430px]`) across all devices, with Sun/Moon Dark & Light mode toggle and Android hardware back-button support (hash routing).
- **Backend:** Zero-backend, 100% client-side Bring Your Own Key (BYOK) architecture.

## 2. AI Brain & Unlimited Voice Split
- **AI Brain (Gemini API — `gemini-2.5-flash`):**
  - Handles user voice/text input, transcription, gentle corrections (`Quick Fix`), natural phrasing upgrades (`Say it naturally`), Bengali hints, and word meanings.
  - Strict runtime safety: `x-goog-api-key` header only, `finishReason === 'STOP'` check before JSON parsing, Zod schema validation (`CoachTurnResponseSchema`), sliding-window history (max 8 turns), AbortController timeout, and smart 429 cooldown handling.
  - Free-tier capacity: ~10 RPM / ~250 RPD (~60+ minutes of daily speaking practice).
- **AI Mouth / Voice Output (Android Native Google Speech — `src/ai/androidSpeech.ts`):**
  - **Gemini TTS (`gemini-2.5-flash-preview-tts`) completely removed** due to strict free-tier limits (3 RPM / 10 RPD).
  - Uses Android's built-in Speech Services by Google via `window.speechSynthesis`.
  - **0 API Quota, 0 RAM audio blobs, 100% Unlimited playback.**
  - Smart voice filter selects up to **8 clearest English voices**, prioritizing **Indian English (`en-IN`)** first, then **American English (`en-US`)**.
  - Supports instant `0.75x / 1.0x / 1.2x` playback speed and unlimited voice previews.

## 3. 2GB RAM, Battery & Storage Protection
- **Audio Recording (`src/ai/audioRecorder.ts`):** `16 kbps` Opus (`audio/webm;codecs=opus`), 60-second auto-stop, 1 MB hard cap, `isStopping` race-condition lock, and immediate hardware mic release (`stream.getTracks().forEach(t => t.stop())`).
- **Zero Audio Storage:** Neither user recordings nor AI voice audio are ever saved to IndexedDB or localStorage.
- **Zero Background Drain:** No background polling or idle timers; UI stays flat without heavy GPU blur/animations.
- **Bounded DOM & Queries:** Max 20 visible chat messages in `CoachScreen`, max 50 recent cards queried in `ProgressScreen`.

## 4. Security & Privacy (BYOK Key Vault)
- **Isolated Vault (`src/ai/keyVault.ts`):** API key stored locally on device (opt-in `localStorage` or `sessionStorage`), masked password input (`autocomplete="off"`), never placed in URLs or console logs.
- **Calm Security Alert:** If a `401/403` error occurs, triggers a calm, non-scary "Quick Safety Check" banner in Settings with a 4-step **Change / Replace Key** guide.
- **Beginner Onboarding:** 6-step click-by-click Google AI Studio setup guide inside Settings.

## 5. Local Persistence & Data-Driven Curriculum
- **Curriculum (`src/content/curriculum.json`):** Zod-validated (`contentSchemas.ts`), 10 lessons across 4 modes (`Free Talk`, `Roleplay`, `Listen & Reply`, `Quick Fix`).
- **Database (`src/db/speakupDb.ts` — Dexie.js IndexedDB):** Stores lightweight text-only records in 4 tables: `dailyStats`, `mistakeCards`, `savedPhrases`, and `skillEvidence` with non-blocking writes and two-tap reset.
