# SpeakUp AI V1 — Build State

- **Active Blueprint:** v10.1 Gold Master (with Owner Android-Only & 2GB RAM Overrides)
- **Project Folder:** GEMINI-SPEAK-UP-AI-V2
- **Current Step:** Step 3.3 Completed

## Owner Architectural Overrides (Active & Locked)
1. **100% Android-Only Target:** Built strictly for Android browsers (Chrome, Brave, Edge). Zero iOS/Safari code (`audio/mp4`, `webkitAudioContext` removed).
2. **Strict Mobile-Only UI:** `max-w-[430px]` centered mobile frame across all devices (no desktop sidebar), with Sun/Moon Dark & Light mode toggle.
3. **2GB RAM & Battery Ultra-Light Optimization:**
   - `16 kbps` Opus audio bitrate (`audio/webm;codecs=opus`) with 60s auto-stop & 1 MB cap.
   - Immediate mic track release (`stream.getTracks().forEach(t => t.stop())`) and chunk cleanup.
   - RAM TTS Audio LRU Cache strictly capped at **7 voices** (older entries evicted via `URL.revokeObjectURL()`).
   - Zero background polling/intervals, zero audio stored in IndexedDB, flat zero-lag UI, max 20 visible messages in DOM.
4. **Voice Priority:** 8 verified Gemini TTS voices (4 Female + 4 Male, Indian & American) in `src/content/voices.json`.
5. **Live Quota & Security:** Client-side live free-tier quota & cooldown tracker (`src/ai/quotaTracker.ts`), calm security alert, and click-by-click setup/replace API key guides.
6. **Android Hardware Back Button:** Native hash-history navigation with duplicate-entry prevention and popup-first back dismissal.

## Completed Steps
- [x] Step 1.1 - 1.8: Strict Mobile-Only PWA Shell, Sun/Moon Theme Toggle, Oxlint Security Rules, Production Build & Commit
- [x] Step 2.1 - 2.9: Gemini Config, Key Vault, Android-Only 16kbps Audio Recorder, Zod Validators, Gemini Client, Gemini TTS (7-voice RAM cache), 8-Voice Picker, SettingsScreen with 6-step Guide & Live Quota Tracker
- [x] Step 3.1 & 3.2: Created Zod content schemas (`src/schemas/contentSchemas.ts`), seeded `src/content/curriculum.json` (10 lessons across 4 modes), and built `src/content/curriculumLoader.ts`
- [x] Step 3.3: Built `src/ai/promptBuilder.ts`, `src/components/CoachMessageBubble.tsx`, and voice-first `src/screens/CoachScreen.tsx`

## Next Step
- [ ] Step 4.1: Set up Dexie.js IndexedDB local persistence (`src/db/speakupDb.ts`) for Progress, Speaking Time, Mistake Cards, and Saved Phrases
