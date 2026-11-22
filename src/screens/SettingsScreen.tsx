import { useState } from 'react'
import type { SpeechRate } from '../ai/androidSpeech'
import {
  clearApiKey,
  getKeyStorageMode,
  hasKeySecurityAlert,
  saveApiKey,
  setKeySecurityAlert,
  testApiKey,
  type KeyStorageMode,
} from '../ai/keyVault'
import {
  loadVoiceSettings,
  saveVoiceSettings,
  type BengaliSupportLevel,
  type UserVoiceSettings,
} from '../ai/voicePreferences'
import { QuotaStatusCard } from '../components/QuotaStatusCard'
import { VoicePicker } from '../components/VoicePicker'

const SPEED_OPTIONS: SpeechRate[] = [0.75, 1.0, 1.2]
const BENGALI_LEVELS: Array<{ id: BengaliSupportLevel; label: string }> = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

const NEW_KEY_STEPS = [
  {
    step: 1,
    title: 'Open Google AI Studio',
    detail: 'Tap "Open AI Studio" below to open aistudio.google.com in Chrome.',
  },
  {
    step: 2,
    title: 'Sign in with Gmail',
    detail: 'Log in using your normal Google / Gmail account.',
  },
  {
    step: 3,
    title: 'Tap "Get API key"',
    detail: 'Open the left menu (or top bar) and tap "Get API key".',
  },
  {
    step: 4,
    title: 'Tap "Create API key"',
    detail: 'Tap the blue "Create API key" button and confirm if asked.',
  },
  {
    step: 5,
    title: 'Copy your new key',
    detail: 'Tap the Copy icon next to the generated key (starts with AIza...).',
  },
  {
    step: 6,
    title: 'Paste & Save below',
    detail: 'Come back here, paste the key below, and tap "Test & Save Key".',
  },
]

const REPLACE_KEY_STEPS = [
  {
    step: 1,
    title: 'Open Google AI Studio',
    detail: 'Tap "Open AI Studio" below to view your existing API keys.',
  },
  {
    step: 2,
    title: 'Delete the old key',
    detail: 'Find your old key in the list and tap the Trash / Delete icon to deactivate it safely.',
  },
  {
    step: 3,
    title: 'Create a fresh key',
    detail: 'Tap "Create API key" to generate a brand-new private key.',
  },
  {
    step: 4,
    title: 'Copy & Save here',
    detail: 'Copy the new key, paste it in the box below, and tap "Test & Save Key".',
  },
]

type KeyGuideTab = 'setup' | 'replace'

export function SettingsScreen() {
  const [showKeySetup, setShowKeySetup] = useState(false)
  const [guideTab, setGuideTab] = useState<KeyGuideTab>('setup')
  const [keyInput, setKeyInput] = useState('')
  const [rememberKey, setRememberKey] = useState(true)
  const [storageMode, setStorageMode] = useState<KeyStorageMode>(() => getKeyStorageMode())
  const [securityAlert, setSecurityAlert] = useState<boolean>(() => hasKeySecurityAlert())
  const [keyStatus, setKeyStatus] = useState<string | null>(null)
  const [isTestingKey, setIsTestingKey] = useState(false)

  const [settings, setSettings] = useState<UserVoiceSettings>(() => loadVoiceSettings())

  const updateSettings = (next: UserVoiceSettings) => {
    setSettings(next)
    saveVoiceSettings(next)
  }

  const openKeyManager = (initialTab: KeyGuideTab) => {
    setGuideTab(initialTab)
    setKeyStatus(null)
    setShowKeySetup(true)
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
      setSecurityAlert(false)
      setKeyInput('')
      setKeyStatus('Key verified and saved securely.')
    } else if (result.reason === 'invalid_key') {
      setKeyStatus('This key did not work. Try creating a fresh key in Google AI Studio.')
    } else if (result.reason === 'timeout') {
      setKeyStatus('Verification timed out. Check your internet connection.')
    } else {
      setKeyStatus('Network error while verifying key. Try again.')
    }
  }

  const handleClearKey = () => {
    clearApiKey()
    setStorageMode('none')
    setSecurityAlert(false)
    setKeyInput('')
    setKeyStatus('API key removed from this phone.')
  }

  if (showKeySetup) {
    const activeSteps = guideTab === 'replace' ? REPLACE_KEY_STEPS : NEW_KEY_STEPS

    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowKeySetup(false)
              setKeyStatus(null)
            }}
            className="min-h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Back
          </button>
          <div>
            <h2 className="text-base font-bold">
              {guideTab === 'replace' ? 'Change / Replace API Key' : 'Setup Gemini API Key'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Private key stored only on your phone
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setGuideTab('setup')}
            className={`min-h-12 rounded-xl border text-xs font-semibold cursor-pointer ${
              guideTab === 'setup'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
            }`}
          >
            New Key Guide
          </button>
          <button
            type="button"
            onClick={() => setGuideTab('replace')}
            className={`min-h-12 rounded-xl border text-xs font-semibold cursor-pointer ${
              guideTab === 'replace'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
            }`}
          >
            Change / Replace Key
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {guideTab === 'replace' ? 'Safe Key Replacement (1 Min)' : 'Step-by-Step Guide (1 Min)'}
            </h3>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-10 px-3.5 rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center"
            >
              Open AI Studio
            </a>
          </div>

          <ol className="flex flex-col gap-2.5">
            {activeSteps.map((item) => (
              <li
                key={item.step}
                className="flex items-start gap-3 rounded-xl bg-slate-50 dark:bg-slate-950 p-2.5 border border-slate-100 dark:border-slate-800"
              >
                <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                  {item.step}
                </span>
                <div className="text-xs">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Paste Your API Key</h3>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                storageMode === 'none'
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {storageMode === 'none'
                ? 'Not Connected'
                : storageMode === 'local'
                  ? 'Connected (Device)'
                  : 'Connected (Session)'}
            </span>
          </div>

          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Paste key starting with AIza..."
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
              Remember key on this phone (uncheck to clear automatically when you close Chrome).
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
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {keyStatus}
            </p>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {securityAlert && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Quick Safety Check
              </h2>
              <p className="text-xs text-amber-700 dark:text-amber-200/90 mt-1">
                Your Gemini API key needs a quick refresh to keep your account safe. You can replace it easily in 1 minute.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setKeySecurityAlert(false)
                setSecurityAlert(false)
              }}
              className="text-xs text-amber-700 dark:text-amber-300 px-2 py-1 cursor-pointer"
              aria-label="Dismiss safety check"
            >
              Dismiss
            </button>
          </div>
          <button
            type="button"
            onClick={() => openKeyManager('replace')}
            className="min-h-12 w-full rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-semibold text-white cursor-pointer"
          >
            Replace API Key Safely
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Gemini API Key</h2>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              storageMode === 'none'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {storageMode === 'none' ? 'Not Connected' : 'Connected'}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          {storageMode === 'none'
            ? 'Follow our simple 1-minute step-by-step guide to connect your free Gemini key.'
            : 'Your personal Gemini key is active and sent only via secure headers.'}
        </p>

        <button
          type="button"
          onClick={() => openKeyManager(storageMode === 'none' ? 'setup' : 'replace')}
          className="min-h-12 w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white cursor-pointer transition-colors"
        >
          {storageMode === 'none' ? 'Setup Gemini API Key' : 'Manage / Change API Key'}
        </button>
      </section>

      <QuotaStatusCard />

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
          selectedVoiceURI={settings.selectedVoiceURI}
          speechRate={settings.speechRate}
          onSelect={(voiceURI) => updateSettings({ ...settings, selectedVoiceURI: voiceURI })}
        />
      </section>

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
