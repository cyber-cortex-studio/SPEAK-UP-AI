import { useState } from 'react'
import { speakText, stopSpeech, TtsError, type SpeechRate } from '../ai/geminiTts'
import {
  getAllVoices,
  type VoiceGender,
  type VoiceProfile,
  type VoiceProfileId,
} from '../ai/voicePreferences'

interface VoicePickerProps {
  selectedGender: VoiceGender
  selectedProfileId: VoiceProfileId
  speechRate: SpeechRate
  onSelect: (gender: VoiceGender, profileId: VoiceProfileId) => void
}

export function VoicePicker({
  selectedGender,
  selectedProfileId,
  speechRate,
  onSelect,
}: VoicePickerProps) {
  const [previewingId, setPreviewingId] = useState<VoiceProfileId | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const allVoices = getAllVoices()
  const genderVoices = allVoices.filter((v) => v.gender === selectedGender)
  const savedVoice = allVoices.find((v) => v.id === selectedProfileId)
  const isSavedUnavailable = !savedVoice || !savedVoice.enabled

  const handleGenderChange = (gender: VoiceGender) => {
    stopSpeech()
    setPreviewingId(null)
    setPreviewError(null)
    const firstAvailable = allVoices.find((v) => v.gender === gender && v.enabled)
    onSelect(gender, firstAvailable ? firstAvailable.id : selectedProfileId)
  }

  const handlePreview = async (voice: VoiceProfile) => {
    if (previewingId === voice.id) {
      stopSpeech()
      setPreviewingId(null)
      return
    }

    setPreviewError(null)
    setPreviewingId(voice.id)

    const sampleText =
      voice.locale === 'en-IN'
        ? 'Hello! I am your SpeakUp AI coach. Let us practice English together.'
        : 'Hi there! I am your SpeakUp AI coach. Ready to practice speaking?'

    try {
      await speakText({
        text: sampleText,
        providerVoiceId: voice.providerVoiceId,
        rate: speechRate,
        onEnded: () => setPreviewingId(null),
      })
    } catch (err: unknown) {
      setPreviewingId(null)
      if (err instanceof TtsError && err.code === 'missing_key') {
        setPreviewError('Save your Gemini API key above first to preview voices.')
      } else if (err instanceof TtsError && err.code === 'rate_limited') {
        setPreviewError('Rate limit hit. Wait 30-60 seconds and try again.')
      } else {
        setPreviewError('Could not play preview. Check your API key and connection.')
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {isSavedUnavailable && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          Your previously saved voice is currently unavailable. Please choose another voice below.
        </div>
      )}

      {/* Gender Selector */}
      <div className="grid grid-cols-2 gap-2">
        {(['female', 'male'] as const).map((gender) => {
          const active = selectedGender === gender
          return (
            <button
              key={gender}
              type="button"
              onClick={() => handleGenderChange(gender)}
              className={`min-h-12 rounded-xl border text-sm font-semibold capitalize cursor-pointer transition-colors ${
                active
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {gender}
            </button>
          )
        })}
      </div>

      {/* Voice List for Selected Gender */}
      <div className="flex flex-col gap-2">
        {genderVoices.map((voice) => {
          const isSelected = voice.id === selectedProfileId
          const isPlaying = previewingId === voice.id
          return (
            <div
              key={voice.id}
              className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
              }`}
            >
              <button
                type="button"
                disabled={!voice.enabled}
                onClick={() => onSelect(voice.gender, voice.id)}
                className="flex-1 text-left min-h-12 flex flex-col justify-center cursor-pointer disabled:opacity-50"
              >
                <span className="text-sm font-semibold">{voice.displayName}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {voice.locale} {isSelected ? '- Selected' : ''}
                </span>
              </button>
              <button
                type="button"
                disabled={!voice.enabled}
                onClick={() => {
                  void handlePreview(voice)
                }}
                className="min-h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                {isPlaying ? 'Stop' : 'Preview'}
              </button>
            </div>
          )
        })}
      </div>

      {previewError && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{previewError}</p>
      )}
    </div>
  )
}
