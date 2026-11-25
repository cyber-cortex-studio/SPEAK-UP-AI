import { useState } from 'react'
import type { SpeechRate } from '../ai/androidSpeech'
import type { CoachTurnResponse } from '../schemas/validators'

const SPEED_OPTIONS: SpeechRate[] = [0.75, 1.0, 1.2]

export interface ChatMessage {
  id: string
  role: 'user' | 'model'
  text: string
  bengaliHint?: string
  correction?: CoachTurnResponse['correction']
  sayItBetter?: string
  pronunciationNote?: string
  bengaliPhoneticTip?: string
  bengaliBridgeUsed?: boolean
  wordMeanings?: CoachTurnResponse['wordMeanings']
}

interface CoachMessageBubbleProps {
  message: ChatMessage
  isPlaying: boolean
  speakingMessageId?: string | null
  selectedRate?: SpeechRate
  onSelectRate?: (rate: SpeechRate) => void
  onPlayVoice: (messageId: string, text: string, rateOverride?: SpeechRate) => void
  onSelectWord: (wordTip: { word: string; meaningBn: string }) => void
  onSavePhrase?: (phrase: string, noteBn?: string) => void
}

export function CoachMessageBubble({
  message,
  isPlaying,
  speakingMessageId,
  selectedRate,
  onSelectRate,
  onPlayVoice,
  onSelectWord,
  onSavePhrase,
}: CoachMessageBubbleProps) {
  const [phraseSaved, setPhraseSaved] = useState(false)
  const [localRate, setLocalRate] = useState<SpeechRate>(1.0)
  const isUser = message.role === 'user'

  const activeRate = selectedRate ?? localRate
  const fixVoiceId = `${message.id}_fix`
  const isFixPlaying = speakingMessageId === fixVoiceId

  const handleSaveBetter = () => {
    if (!message.sayItBetter || !onSavePhrase || phraseSaved) {
      return
    }
    onSavePhrase(message.sayItBetter, message.bengaliHint ?? '')
    setPhraseSaved(true)
  }

  const handleRatePick = (rate: SpeechRate) => {
    setLocalRate(rate)
    onSelectRate?.(rate)
    onPlayVoice(message.id, message.text, rate)
  }

  const phoneticTip =
    message.bengaliPhoneticTip &&
    message.bengaliPhoneticTip.trim() !== message.pronunciationNote?.trim()
      ? message.bengaliPhoneticTip
      : undefined

  return (
    <div
      className={`flex flex-col gap-1.5 max-w-[92%] ${isUser ? 'self-end' : 'self-start'}`}
    >
      <div
        className={`rounded-2xl p-3.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-emerald-600 text-white rounded-br-sm'
            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm'
        }`}
      >
        <p>{message.text}</p>

        {!isUser && message.bengaliHint && (
          <p className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            {message.bengaliHint}
          </p>
        )}

        {!isUser && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPlayVoice(message.id, message.text)}
              className="min-h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer"
            >
              {isPlaying ? 'Stop' : 'Play'}
            </button>

            <div
              className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800/70"
              role="group"
              aria-label="Playback speed"
            >
              {SPEED_OPTIONS.map((rate) => {
                const isSelected = activeRate === rate
                return (
                  <button
                    key={rate}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleRatePick(rate)}
                    className={`min-h-8 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {rate}x
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Gentle Correction or Bengali-to-English Bridge Card */}
      {!isUser && message.correction && (
        <div
          className={`rounded-xl border p-3 text-xs flex flex-col gap-1.5 ${
            message.bengaliBridgeUsed
              ? 'border-teal-500/30 bg-teal-500/10'
              : 'border-amber-500/30 bg-amber-500/10'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`font-semibold ${
                message.bengaliBridgeUsed
                  ? 'text-teal-800 dark:text-teal-300'
                  : 'text-amber-800 dark:text-amber-300'
              }`}
            >
              {message.bengaliBridgeUsed ? 'Bengali → English Bridge' : 'Quick Fix'}
            </span>
            <button
              type="button"
              onClick={() =>
                onPlayVoice(fixVoiceId, message.correction!.betterWay, activeRate)
              }
              className="min-h-7 px-2.5 rounded-lg border border-emerald-600/30 bg-white/80 dark:bg-slate-900/70 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer"
            >
              {isFixPlaying ? 'Stop' : `Listen (${activeRate}x)`}
            </button>
          </div>
          {message.correction.learnerSaid && (
            <p className="text-slate-600 dark:text-slate-400 line-through">
              {message.correction.learnerSaid}
            </p>
          )}
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
            {message.correction.betterWay}
          </p>
          {message.correction.shortNoteBn && (
            <p className="text-slate-700 dark:text-slate-300">
              {message.correction.shortNoteBn}
            </p>
          )}
        </div>
      )}

      {/* Say It Better Upgrade */}
      {!isUser && message.sayItBetter && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs flex items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              Say it naturally:{' '}
            </span>
            <span>{message.sayItBetter}</span>
          </div>
          {onSavePhrase && (
            <button
              type="button"
              disabled={phraseSaved}
              onClick={handleSaveBetter}
              className="shrink-0 px-2.5 py-1 rounded-lg border border-emerald-500/40 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer disabled:opacity-60"
            >
              {phraseSaved ? 'Saved' : 'Save'}
            </button>
          )}
        </div>
      )}

      {/* Pronunciation & Bengali Phonetic Tip */}
      {!isUser && (message.pronunciationNote || phoneticTip) && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs flex flex-col gap-1">
          {message.pronunciationNote && (
            <div>
              <span className="font-semibold text-sky-700 dark:text-sky-400">
                Pronunciation:{' '}
              </span>
              <span>{message.pronunciationNote}</span>
            </div>
          )}
          {phoneticTip && (
            <div>
              <span className="font-semibold text-sky-700 dark:text-sky-400">
                Sound Tip:{' '}
              </span>
              <span>{phoneticTip}</span>
            </div>
          )}
        </div>
      )}

      {/* Word Meaning Chips */}
      {!isUser && message.wordMeanings && message.wordMeanings.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {message.wordMeanings.map((item, idx) => (
            <button
              key={`${message.id}_${item.word}_${idx}`}
              type="button"
              onClick={() => onSelectWord(item)}
              className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {item.word}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
