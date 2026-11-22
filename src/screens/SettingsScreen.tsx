import { useState } from 'react'
import {
  clearApiKey,
  getKeyStorageMode,
  saveApiKey,
  testApiKey,
  type KeyStorageMode,
} from '../ai/keyVault'
import type { SpeechRate } from '../ai/geminiTts'
import {
  loadVoiceSettings,
  saveVoiceSettings,
  type BengaliSupportLevel,
  type UserVoiceSettings,
  type VoiceGender,
  type VoiceProfileId,
} from '../ai/voicePreferences'
import { VoicePicker } from '../components/VoicePicker'

const SPEED_OPTIONS: SpeechRate[] = [0.75, 1.0, 1.2]
const BENGALI_LEVELS: Array<{ id: BengaliSupportLevel; label: string }> = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

export function SettingsScreen() {
  const [keyInput, setKeyInput] = useState('')
  const [rememberKey, setRememberKey] = useState(false)
  const [storageMode, setStorageMode] = useState<KeyStorageMode>(() => getKeyStorageMode())
  const [keyStatus, setKeyStatus] = useState<string | null>(null)
  const [isTestingKey, setIsTestingKey] = useState(false)

  const [settings, setSettings] = useState<UserVoiceSettings>(() => loadVoiceSettings())

  const updateSettings = (next: UserVoiceSettings) => {
    setSettings(next)
    saveVoiceSettings(next)
  }

  const handleTestAndSaveKey = async () => {
    if (!keyInput.trim()) {
      setKeyStatus('Please paste your Gemini API key first.')
      return
    }
    setIsTestingKey(true)
    setKeyStatus('Verifying key with Gemini...')

    const result = await testApiKey(keyInput)
    setIsTestingKey(false)

    if (result.valid) {
      saveApiKey(keyInput, rememberKey)
      setStorageMode(getKeyStorageMode())
      setKeyInput('')
      setKeyStatus('Key verified and saved securely.')
    } else if (result.reason === 'invalid_key') {
      setKeyStatus('Invalid API key. Check your key in Google AI Studio.')
    } else if (result.reason === 'timeout') {
      setKeyStatus('Verification timed out. Check your internet connection.')
    } else {
      setKeyStatus('Network error while verifying key. Try again.')
    }
  }

  const handleClearKey = () => {
    clearApiKey()
    setStorageMode('none')
    setKeyInput('')
    setKeyStatus('API key removed from this browser.')
  }

  const handleVoiceSelect = (gender: VoiceGender, profileId: VoiceProfileId) => {
    updateSettings({
      ...settings,
      selectedGender: gender,
      selectedProfileId: profileId,
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Gemini API Key Vault */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Gemini API Key Vault</h2>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              storageMode === 'none'
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {storageMode === 'none'
              ? 'Not Set'
              : storageMode === 'local'
                ? 'Saved (Device)'
                : 'Saved (Session)'}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Bring your own free-tier key from Google AI Studio. Sent only via header to Gemini.
        </p>

        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="Paste your Gemini API key..."
          autoComplete="off"
          spellCheck={false}
          className="min-h-12 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm focus:outline-none focus:border-emerald-500"
        />

        <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberKey}
            onChange={(e) => setRememberKey(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-600"
          />
          <span>
            Remember key on this device (uses localStorage; leave unchecked to clear on tab close).
          </span>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={isTestingKey}
            onClick={() => {
              void handleTestAndSaveKey()
            }}
            className="min-h-12 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            {isTestingKey ? 'Testing...' : 'Test & Save Key'}
          </button>
          {storageMode !== 'none' && (
            <button
              type="button"
              onClick={handleClearKey}
              className="min-h-12 px-4 rounded-xl border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-500/10 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {keyStatus && (
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{keyStatus}</p>
        )}
      </section>

      {/* AI Voice Picker */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">AI Coach Voice</h2>
          <button
            type="button"
            onClick={() =>
              updateSettings({ ...settings, voiceEnabled: !settings.voiceEnabled })
            }
            className={`min-h-12 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
              settings.voiceEnabled
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'border-slate-300 dark:border-slate-700 text-slate-500'
            }`}
          >
            {settings.voiceEnabled ? 'Voice: ON' : 'Voice: OFF'}
          </button>
        </div>

        <VoicePicker
          selectedGender={settings.selectedGender}
          selectedProfileId={settings.selectedProfileId}
          speechRate={settings.speechRate}
          onSelect={handleVoiceSelect}
        />
      </section>

      {/* Playback Speed */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <h2 className="text-base font-semibold">Audio Speed</h2>
        <div className="grid grid-cols-3 gap-2">
          {SPEED_OPTIONS.map((rate) => {
            const active = settings.speechRate === rate
            return (
              <button
                key={rate}
                type="button"
                onClick={() => updateSettings({ ...settings, speechRate: rate })}
                className={`min-h-12 rounded-xl border text-sm font-semibold cursor-pointer ${
                  active
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {rate}x
              </button>
            )
          })}
        </div>
      </section>

      {/* Bengali Support Level */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <h2 className="text-base font-semibold">Bengali Support Level</h2>
        <div className="grid grid-cols-3 gap-2">
          {BENGALI_LEVELS.map((lvl) => {
            const active = settings.bengaliLevel === lvl.id
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => updateSettings({ ...settings, bengaliLevel: lvl.id })}
                className={`min-h-12 rounded-xl border text-sm font-semibold cursor-pointer ${
                  active
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {lvl.label}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
