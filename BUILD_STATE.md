# SpeakUp AI V1 — Build State

- **Active Blueprint:** v10.2 Unlimited Android Voice Edition
- **Project Folder:** GEMINI-SPEAK-UP-AI-V2
- **Current Step:** Step 5.1 Completed (V1 Release Ready)

## Completed Steps (Full V1 Summary)
- [x] **Step 1.1 - 1.8:** Strict Mobile-Only PWA Shell (`max-w-[430px]`), Sun/Moon Theme Toggle, Oxlint security checks, production build & commit.
- [x] **Step 2.1 - 2.9:** Gemini config, isolated BYOK Key Vault, Android-only `16 kbps` Opus audio recorder (`60s` auto-stop, `1 MB` cap, immediate mic release), Zod `CoachTurnResponseSchema` validators, `geminiClient.ts`, SettingsScreen with 6-step beginner guide + 4-step key replacement guide + calm security check, and live client-side quota/cooldown tracker (`quotaTracker.ts` & `QuotaStatusCard.tsx`).
- [x] **Step 3.1 - 3.3:** Zod content schemas, 10-lesson `curriculum.json` across 4 modes (`Free Talk`, `Roleplay`, `Listen & Reply`, `Quick Fix`), `curriculumLoader.ts`, `promptBuilder.ts`, `CoachMessageBubble.tsx`, and voice-first `CoachScreen.tsx`.
- [x] **Step 4.1 - 4.3:** Dexie.js IndexedDB (`src/db/speakupDb.ts`) for daily speaking stats, mistake cards, saved phrases, and skill evidence; `ProgressScreen.tsx` & live `HomeScreen.tsx`; removed Gemini TTS completely and implemented **Unlimited Android Google Voice** (`src/ai/androidSpeech.ts` — Female & Male tabs, Indian & American voices, `0` voice quota) + updated `ARCHITECTURE.md`.
- [x] **Step 5.1:** Added unit tests (`quotaTracker.test.ts`, `curriculumLoader.test.ts`), `"test"` script in `package.json`, verified build & committed V1 release state.
