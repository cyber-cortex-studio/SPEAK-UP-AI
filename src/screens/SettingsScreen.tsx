import { useState } from 'react'
import type { SpeechRate } from '../ai/androidSpeech'
import {
  getGeminiStorageMode,
  getGroqStorageMode,
  getKeyStorageMode,
  getProviderPreference,
  hasKeySecurityAlert,
  setKeySecurityAlert,
  setProviderPreference,
  type AiProviderPreference,
  type KeyStorageMode,
} from '../ai/keyVault'
import {
  loadVoiceSettings,
  saveVoiceSettings,
  type BengaliSupportLevel,
  type UserVoiceSettings,
} from '../ai/voicePreferences'
import { ApiKeyManagerView, type KeyProviderTab } from '../components/ApiKeyManagerView'
import { DataPrivacyView } from '../components/DataPrivacyView'
import { ChevronRightIcon, ShieldIcon } from '../components/NavIcons'
import { QuotaStatusCard } from '../components/QuotaStatusCard'
import { VoicePicker } from '../components/VoicePicker'

const SPEED_OPTIONS: SpeechRate[] = [0.75, 1.0, 1.2]
const BENGALI_LEVELS: Array<{ id: BengaliSupportLevel; label: string }> = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

const PROVIDER_OPTIONS: Array<{ id: AiProviderPreference; label: string; sub: string }> = [
  { id: 'auto', label: 'Auto', sub: 'Groq → Gemini' },
  { id: 'groq', label: 'Groq Only', sub: 'Ultra Fast' },
  { id: 'gemini', label: 'Gemini Only', sub: 'Google AI' },
]

type SettingsSubView = 'main' | 'key_setup' | 'privacy'

export function SettingsScreen() {
  const [subView, setSubView] = useState<SettingsSubView>('main')
  const [providerTab, setProviderTab] = useState<KeyProviderTab>('groq')
  const [groqMode, setGroqMode] = useState<KeyStorageMode>(() => getGroqStorageMode())
  const [geminiMode, setGeminiMode] = useState<KeyStorageMode>(() => getGeminiStorageMode())
  const [combinedMode, setCombinedMode] = useState<KeyStorageMode>(() => getKeyStorageMode())
  const [providerPref, setProviderPrefState] = useState<AiProviderPreference>(() =>
    getProviderPreference(),
  )
  const [securityAlert, setSecurityAlert] = useState<boolean>(() => hasKeySecurityAlert())
  const [settings, setSettings] = useState<UserVoiceSettings>(() => loadVoiceSettings())

  const anyConnected = groqMode !== 'none' || geminiMode !== 'none'

  const refreshKeyStates = () => {
    setGroqMode(getGroqStorageMode())
    setGeminiMode(getGeminiStorageMode())
    setCombinedMode(getKeyStorageMode())
    setSecurityAlert(hasKeySecurityAlert())
  }

  const updateSettings = (next: UserVoiceSettings) => {
    setSettings(next)
    saveVoiceSettings(next)
  }

  const updateProviderPref = (next: AiProviderPreference) => {
    setProviderPrefState(next)
    setProviderPreference(next)
  }

  const openKeyManager = (initialProvider: KeyProviderTab) => {
    setProviderTab(initialProvider)
    setSubView('key_setup')
  }

  if (subView === 'privacy') {
    return (
      <DataPrivacyView
        storageMode={combinedMode}
        onBack={() => setSubView('main')}
        onOpenKeyManager={() => openKeyManager(groqMode === 'none' ? 'groq' : 'gemini')}
      />
    )
  }

  if (subView === 'key_setup') {
    return (
      <ApiKeyManagerView
        initialProvider={providerTab}
        onBack={() => setSubView('main')}
        onKeysChanged={refreshKeyStates}
      />
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
                One of your API keys needs a quick refresh. Replace it easily in 1 minute.
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
            onClick={() => openKeyManager('groq')}
            className="min-h-12 w-full rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-semibold text-white cursor-pointer"
          >
            Manage API Keys Safely
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">AI API Keys (Multi-Provider)</h2>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              !anyConnected
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {!anyConnected ? 'Not Connected' : 'Connected'}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Add Groq (ultra-fast 1s replies), Gemini (Google AI Studio), or both for automatic
          multi-model failover.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openKeyManager('groq')}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-left hover:border-emerald-500 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold">Groq API</span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  groqMode === 'none'
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {groqMode === 'none' ? 'Not Set' : 'Active'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Recommended · Fast
            </p>
          </button>

          <button
            type="button"
            onClick={() => openKeyManager('gemini')}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-left hover:border-emerald-500 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold">Gemini API</span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  geminiMode === 'none'
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {geminiMode === 'none' ? 'Not Set' : 'Active'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Google AI · Backup
            </p>
          </button>
        </div>

        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Active Provider Mode
          </span>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDER_OPTIONS.map((opt) => {
              const active = providerPref === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateProviderPref(opt.id)}
                  className={`min-h-12 rounded-xl border px-2 py-1.5 text-center cursor-pointer ${
                    active
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className="text-[10px] opacity-85">{opt.sub}</div>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openKeyManager(groqMode === 'none' ? 'groq' : 'gemini')}
          className="min-h-12 w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white cursor-pointer transition-colors"
        >
          {!anyConnected ? 'Setup AI API Key' : 'Manage Groq & Gemini Keys'}
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

      <button
        type="button"
        onClick={() => setSubView('privacy')}
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3 text-left hover:border-emerald-500 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldIcon className="w-5 h-5" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Data &amp; Privacy</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              How your data is stored &amp; full control
            </span>
          </div>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0" />
      </button>
    </div>
  )
}
