# SpeakUp AI V1 — Build State

- **Active Blueprint:** v10.1 Gold Master (with Owner Android-Only & 2GB RAM Overrides)
- **Project Folder:** GEMINI-SPEAK-UP-AI-V2
- **Current Step:** Step 4.2 Completed (Core V1 App Feature-Complete)

## Owner Architectural Overrides (Active & Locked)
1. **100% Android-Only Target:** Built strictly for Android browsers (Chrome, Brave, Edge). Zero iOS/Safari code (`audio/mp4`, `webkitAudioContext` removed).
2. **Strict Mobile-Only UI:** `max-w-[430px]` centered mobile frame across all devices (no desktop sidebar), with Sun/Moon Dark & Light mode toggle.
3. **2GB RAM & Battery Ultra-Light Optimization:**
   - `16 kbps` Opus audio bitrate (`audio/webm;codecs=opus`) with 60s auto-stop & 1 MB cap.
   - Immediate mic track release (`stream.getTracks().forEach(t => t.stop())`) and chunk cleanup.
   - RAM TTS Audio LRU Cache strictly capped at **7 voices** (older entries evicted via `URL.revokeObjectURL()`).
   - Zero background polling/intervals, zero audio stored in IndexedDB, flat zero-lag UI, max 20 visible messages in DOM, max 50 cards queried in Progress.
4. **Voice Priority:** 8 verified Gemini TTS voices (4 Female + 4 Male, Indian & American) in `src/content/voices.json`.
5. **Live Quota & Security:** Client-side live free-tier quota & cooldown tracker (`src/ai/quotaTracker.ts`), calm security alert, and click-by-click setup/replace API key guides.
6. **Android Hardware Back Button:** Native hash-history navigation with duplicate-entry prevention and popup-first back dismissal.

## Completed Steps
- [x] Step 1.1 - 1.8: Strict Mobile-Only PWA Shell, Sun/Moon Theme Toggle, Oxlint Security Rules, Production Build & Commit
- [x] Step 2.1 - 2.9: Gemini Config, Key Vault, Android-Only 16kbps Audio Recorder, Zod Validators, Gemini Client, Gemini TTS (7-voice RAM cache), 8-Voice Picker, SettingsScreen with 6-step Guide & Live Quota Tracker
- [x] Step 3.1 - 3.3: Zod content schemas, curriculum.json (10 lessons), curriculumLoader, promptBuilder, CoachMessageBubble, voice-first CoachScreen
- [x] Step 4.1: Implemented Dexie.js IndexedDB (`src/db/speakupDb.ts`) and wired non-blocking turn/mistake/phrase persistence into `CoachScreen.tsx`
- [x] Step 4.2: Built `ProgressScreen.tsx` (Daily Stats, Mistake Cards, Saved Phrases, Two-Tap Reset) and live `HomeScreen.tsx`

## Next Step
- [ ] Step 5.1: Automated Vitest unit tests (Zod validators, PCM-to-WAV header, Quota tracker) & Final Deployment Prep (GitHub Pages / Cloudflare Pages)
