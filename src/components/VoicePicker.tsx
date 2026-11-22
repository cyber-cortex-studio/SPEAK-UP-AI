import { useEffect, useState } from 'react'
import {
  getAvailableEnglishVoices,
  isAndroidSpeechSupported,
  speakWithAndroidVoice,
  stopAndroidSpeech,
  subscribeVoicesChanged,
  type AndroidVoiceOption,
  type SpeechRate,
  type VoiceGender,
} from '../ai/androidSpeech'

interface VoicePickerProps {
  selectedVoiceURI: string
  speechRate: SpeechRate
  onSelect: (voiceURI: string) => void
}

export function VoicePicker({ selectedVoiceURI, speechRate, onSelect }: VoicePickerProps) {
  const [voices, setVoices] = useState<AndroidVoiceOption[]>(() => getAvailableEnglishVoices())
  const [activeGender, setActiveGender] = useState<VoiceGender>(() => {
    const initial = getAvailableEnglishVoices().find((v) => v.voiceURI === selectedVoiceURI)
    return initial?.gender ?? 'female'
  })
  const [previewingURI, setPreviewingURI] = useState<string | null>(null)
  const supported = isAndroidSpeechSupported()

  useEffect(() => {
    const unsubscribe = subscribeVoicesChanged(() => {
      setVoices(getAvailableEnglishVoices())
    })
    return () => {
      unsubscribe()
      stopAndroidSpeech()
    }
  }, [])

  if (!supported) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-300">
        Android browser speech is not supported on this device. You can still read all replies.
      </p>
    )
  }

  const femaleVoices = voices.filter((v) => v.gender === 'female')
  const maleVoices = voices.filter((v) => v.gender === 'male')
  const visibleVoices = activeGender === 'female' ? femaleVoices : maleVoices
  const activeURI = selectedVoiceURI || voices[0]?.voiceURI || ''

  const handlePreview = (voice: AndroidVoiceOption) => {
    if (previewingURI === voice.voiceURI) {
      stopAndroidSpeech()
      setPreviewingURI(null)
      return
    }

    setPreviewingURI(voice.voiceURI)
    const sampleText = voice.isIndian
      ? 'Hello! I am your SpeakUp AI coach. Let us practice English together.'
      : 'Hi there! I am your SpeakUp AI coach. Ready to practice speaking?'

    const started = speakWithAndroidVoice({
      text: sampleText,
      voiceURI: voice.voiceURI,
      rate: speechRate,
      onEnded: () => setPreviewingURI(null),
      onError: () => setPreviewingURI(null),
    })

    if (!started) {
      setPreviewingURI(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Best Android Voices (Indian &amp; American)</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          Unlimited (0 Quota)
        </span>
      </div>

      {/* Female / Male Category Tabs */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveGender('female')}
          className={`min-h-11 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
            activeGender === 'female'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300'
          }`}
        >
          Female ({femaleVoices.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveGender('male')}
          className={`min-h-11 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
            activeGender === 'male'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300'
          }`}
        >
          Male ({maleVoices.length})
        </button>
      </div>

      {visibleVoices.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-600 dark:text-slate-400">
          Default Android English voice will be used automatically.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleVoices.map((voice) => {
            const isSelected = voice.voiceURI === activeURI
            const isPlaying = previewingURI === voice.voiceURI

            return (
              <div
                key={voice.voiceURI}
                className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(voice.voiceURI)}
                  className="flex-1 min-w-0 text-left min-h-11 flex flex-col justify-center cursor-pointer"
                >
                  <span className="text-xs font-semibold truncate">{voice.label}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {voice.lang} {isSelected ? '• Selected' : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePreview(voice)}
                  className="min-h-11 px-3.5 shrink-0 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {isPlaying ? 'Stop' : 'Preview'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
