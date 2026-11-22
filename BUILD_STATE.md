# SpeakUp AI V1 — Build State

- **Active Blueprint:** v10.1 Gold Master (with Owner Android-Only & 2GB RAM Overrides)
- **Project Folder:** GEMINI-SPEAK-UP-AI-V2
- **Current Step:** Step 2.8 Completed (Step 2 Exit Gate Ready for Live Test)

## Owner Architectural Overrides (Active & Locked)
1. **100% Android-Only Target:** Built strictly for Android browsers (Chrome, Brave, Edge). Zero iOS/Safari code (`audio/mp4`, `webkitAudioContext` removed).
2. **Strict Mobile-Only UI:** `max-w-[430px]` centered mobile frame across all devices (no desktop sidebar), with Sun/Moon Dark & Light mode toggle.
3. **2GB RAM & Battery Ultra-Light Optimization:**
   - `16 kbps` Opus audio bitrate (`audio/webm;codecs=opus`) with 60s auto-stop & 1 MB cap.
   - Immediate mic track release (`stream.getTracks().forEach(t => t.stop())`) and chunk cleanup.
   - RAM TTS Audio LRU Cache strictly capped at **7 voices** (older entries evicted via `URL.revokeObjectURL()`).
   - Zero background polling/intervals, zero audio stored in IndexedDB, flat zero-lag UI.
4. **Voice Priority:** 1 Indian English (`en-IN`) + 1 American English (`en-US`) for both Female and Male profiles in `src/content/voices.json`.
5. **Android Hardware Back Button:** Native hash-history navigation with duplicate-entry prevention and popup-first back dismissal.

## Completed Steps
- [x] Step 1.1 - 1.8: Strict Mobile-Only PWA Shell, Sun/Moon Theme Toggle, Oxlint Security Rules, Production Build & Commit
- [x] Step 2.1 - 2.7: Gemini Config, Key Vault, Android-Only 16kbps Audio Recorder, Zod Validators, Gemini Client (finishReason + 429), Gemini TTS (PCM-to-WAV + 7-voice RAM cache), Indian/American 4-Voice Picker, SettingsScreen
- [x] Step 2.8: Verified production build, committed Step 2 milestone, and launched local preview for live API Key & 4-Voice TTS verification

## Next Step
- [ ] Step 3.1 & 3.2: Create Zod content schemas & seed src/content/curriculum.json (Pre-A1 to B1 Bridge: Free Talk, Roleplays, Listen & Reply, 3-Second Reflex Cards)
