import { useState } from 'react'
import type { CoachTurnResponse } from '../schemas/validators'

export interface ChatMessage {
  id: string
  role: 'user' | 'model'
  text: string
  bengaliHint?: string
  correction?: CoachTurnResponse['correction']
  sayItBetter?: string
  pronunciationNote?: string
  wordMeanings?: CoachTurnResponse['wordMeanings']
}

interface CoachMessageBubbleProps {
  message: ChatMessage
  isPlaying: boolean
  onPlayVoice: (messageId: string, text: string) => void
  onSelectWord: (wordTip: { word: string; meaningBn: string }) => void
  onSavePhrase?: (phrase: string, noteBn?: string) => void
}

export function CoachMessageBubble({
  message,
  isPlaying,
  onPlayVoice,
  onSelectWord,
  onSavePhrase,
}: CoachMessageBubbleProps) {
  const [phraseSaved, setPhraseSaved] = useState(false)
  const isUser = message.role === 'user'

  const handleSaveBetter = () => {
    if (!message.sayItBetter || !onSavePhrase || phraseSaved) {
      return
    }
    onSavePhrase(message.sayItBetter, message.bengaliHint ?? '')
    setPhraseSaved(true)
  }

  return (
    <div
      className={`flex flex-col gap-1.5 max-w-[90%] ${isUser ? 'self-end' : 'self-start'}`}
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
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPlayVoice(message.id, message.text)}
              className="min-h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer"
            >
              {isPlaying ? 'Stop Voice' : 'Play Voice'}
            </button>
          </div>
        )}
      </div>

      {/* Gentle Correction Card */}
      {!isUser && message.correction && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs flex flex-col gap-1">
          <span className="font-semibold text-amber-800 dark:text-amber-300">Quick Fix</span>
          <p className="text-slate-600 dark:text-slate-400 line-through">
            {message.correction.learnerSaid}
          </p>
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
            {message.correction.betterWay}
          </p>
          <p className="text-slate-700 dark:text-slate-300">{message.correction.shortNoteBn}</p>
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

      {/* Pronunciation Tip */}
      {!isUser && message.pronunciationNote && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs">
          <span className="font-semibold text-sky-700 dark:text-sky-400">Pronunciation: </span>
          <span>{message.pronunciationNote}</span>
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
