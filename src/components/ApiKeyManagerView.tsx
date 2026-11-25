import { useState } from 'react'
import {
  clearGeminiApiKey,
  clearGroqApiKey,
  getGeminiStorageMode,
  getGroqStorageMode,
  saveGeminiApiKey,
  saveGroqApiKey,
  testGeminiApiKey,
  testGroqApiKey,
  type KeyStorageMode,
} from '../ai/keyVault'

export type KeyProviderTab = 'groq' | 'gemini'

interface ApiKeyManagerViewProps {
  initialProvider: KeyProviderTab
  onBack: () => void
  onKeysChanged: () => void
}

const GROQ_KEY_STEPS = [
  {
    step: 1,
    title: 'Open Groq Console',
    detail: 'Tap "Open Groq Console" below to open console.groq.com/keys.',
  },
  {
    step: 2,
    title: 'Sign in with Google or GitHub',
    detail: 'Free account, no credit card needed.',
  },
  {
    step: 3,
    title: 'Tap "Create API Key"',
    detail: 'Give it any name (like SpeakUp) and submit.',
  },
  {
    step: 4,
    title: 'Copy & Paste below',
    detail: 'Copy the key (starts with gsk_...), paste it below, and tap "Test & Save Key".',
  },
]

const GEMINI_KEY_STEPS = [
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
    title: 'Tap "Create API key"',
    detail: 'Generate a free API key (starts with AIza...).',
  },
  {
    step: 4,
    title: 'Copy & Paste below',
    detail: 'Paste the key below and tap "Test & Save Key".',
  },
]

export function ApiKeyManagerView({
  initialProvider,
  onBack,
  onKeysChanged,
}: ApiKeyManagerViewProps) {
  const [providerTab, setProviderTab] = useState<KeyProviderTab>(initialProvider)
  const [groqInput, setGroqInput] = useState('')
  const [geminiInput, setGeminiInput] = useState('')
  const [rememberKey, setRememberKey] = useState(true)
  const [groqMode, setGroqMode] = useState<KeyStorageMode>(() => getGroqStorageMode())
  const [geminiMode, setGeminiMode] = useState<KeyStorageMode>(() => getGeminiStorageMode())
  const [keyStatus, setKeyStatus] = useState<string | null>(null)
  const [isTestingKey, setIsTestingKey] = useState(false)

  const isGroq = providerTab === 'groq'
  const activeSteps = isGroq ? GROQ_KEY_STEPS : GEMINI_KEY_STEPS
  const activeMode = isGroq ? groqMode : geminiMode
  const activeInput = isGroq ? groqInput : geminiInput

  const handleTestAndSaveGroq = async () => {
    if (!groqInput.trim()) {
      setKeyStatus('Please paste your Groq API key first.')
      return
    }
    setIsTestingKey(true)
    setKeyStatus('Verifying key with Groq...')

    const result = await testGroqApiKey(groqInput)
    setIsTestingKey(false)

    if (result.valid) {
      saveGroqApiKey(groqInput, rememberKey)
      setGroqMode(getGroqStorageMode())
      setGroqInput('')
      setKeyStatus('Groq API key verified and saved securely!')
      onKeysChanged()
    } else if (result.reason === 'invalid_key') {
      setKeyStatus('This Groq key did not work. Create a fresh key in Groq Console.')
    } else if (result.reason === 'timeout') {
      setKeyStatus('Verification timed out. Check your internet connection.')
    } else {
      setKeyStatus('Network error while verifying Groq key. Try again.')
    }
  }

  const handleTestAndSaveGemini = async () => {
    if (!geminiInput.trim()) {
      setKeyStatus('Please paste your Gemini API key first.')
      return
    }
    setIsTestingKey(true)
    setKeyStatus('Verifying key with Gemini...')

    const result = await testGeminiApiKey(geminiInput)
    setIsTestingKey(false)

    if (result.valid) {
      saveGeminiApiKey(geminiInput, rememberKey)
      setGeminiMode(getGeminiStorageMode())
      setGeminiInput('')
      setKeyStatus('Gemini API key verified and saved securely!')
      onKeysChanged()
    } else if (result.reason === 'invalid_key') {
      setKeyStatus('This Gemini key did not work. Create a fresh key in Google AI Studio.')
    } else if (result.reason === 'timeout') {
      setKeyStatus('Verification timed out. Check your internet connection.')
    } else {
      setKeyStatus('Network error while verifying Gemini key. Try again.')
    }
  }

  const handleClearGroq = () => {
    clearGroqApiKey()
    setGroqMode('none')
    setGroqInput('')
    setKeyStatus('Groq API key removed from this device.')
    onKeysChanged()
  }

  const handleClearGemini = () => {
    clearGeminiApiKey()
    setGeminiMode('none')
    setGeminiInput('')
    setKeyStatus('Gemini API key removed from this device.')
    onKeysChanged()
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          Back
        </button>
        <div>
          <h2 className="text-base font-bold">Manage AI API Keys (BYOK)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add Groq, Gemini, or both for automatic failover
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setProviderTab('groq')
            setKeyStatus(null)
          }}
          className={`min-h-12 rounded-xl border text-xs font-semibold cursor-pointer flex flex-col items-center justify-center ${
            isGroq
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
          }`}
        >
          <span>Groq API Key</span>
          <span className="text-[10px] opacity-85">
            {groqMode === 'none' ? 'Fast · Recommended' : 'Connected'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setProviderTab('gemini')
            setKeyStatus(null)
          }}
          className={`min-h-12 rounded-xl border text-xs font-semibold cursor-pointer flex flex-col items-center justify-center ${
            !isGroq
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
          }`}
        >
          <span>Gemini API Key</span>
          <span className="text-[10px] opacity-85">
            {geminiMode === 'none' ? 'Google AI · Backup' : 'Connected'}
          </span>
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {isGroq ? 'Get Free Groq Key (1 Min)' : 'Get Free Gemini Key (1 Min)'}
          </h3>
          <a
            href={
              isGroq
                ? 'https://console.groq.com/keys'
                : 'https://aistudio.google.com/app/apikey'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-10 px-3.5 rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center"
          >
            {isGroq ? 'Open Groq Console' : 'Open AI Studio'}
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
          <h3 className="text-sm font-semibold">
            {isGroq ? 'Paste Your Groq API Key' : 'Paste Your Gemini API Key'}
          </h3>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              activeMode === 'none'
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {activeMode === 'none'
              ? 'Not Connected'
              : activeMode === 'local'
                ? 'Connected (Device)'
                : 'Connected (Session)'}
          </span>
        </div>

        <input
          type="password"
          value={activeInput}
          onChange={(e) =>
            isGroq ? setGroqInput(e.target.value) : setGeminiInput(e.target.value)
          }
          placeholder={
            isGroq
              ? 'Paste Groq key starting with gsk_...'
              : 'Paste Gemini key starting with AIza...'
          }
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
            Remember key on this device (uncheck to clear automatically when you close Chrome).
          </span>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={isTestingKey}
            onClick={() => {
              if (isGroq) {
                void handleTestAndSaveGroq()
              } else {
                void handleTestAndSaveGemini()
              }
            }}
            className="min-h-12 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            {isTestingKey ? 'Testing...' : 'Test & Save Key'}
          </button>
          {activeMode !== 'none' && (
            <button
              type="button"
              onClick={isGroq ? handleClearGroq : handleClearGemini}
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
