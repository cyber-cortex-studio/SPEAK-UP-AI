import { useEffect, useRef, useState } from 'react'
import type { SpeechRate } from '../ai/androidSpeech'
import { evaluateRepeatMatch } from '../ai/repeatMatcher'

const SPEED_OPTIONS: SpeechRate[] = [0.75, 1.0, 1.2]

interface SpeechRecognitionAlternativeLike {
  transcript?: string
}

interface SpeechRecognitionResultLike {
  0?: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike {
  results?: ArrayLike<SpeechRecognitionResultLike>
}

interface BrowserSpeechRecognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null
}

interface ForceRepeatCardProps {
  targetSentence: string
  selectedRate: SpeechRate
  onSelectRate: (rate: SpeechRate) => void
  isPlaying: boolean
  onPlayTarget: (text: string, rate: SpeechRate) => void
  onComplete: () => void
  onSkip: () => void
}

export function ForceRepeatCard({
  targetSentence,
  selectedRate,
  onSelectRate,
  isPlaying,
  onPlayTarget,
  onComplete,
  onSkip,
}: ForceRepeatCardProps) {
  const [isListening, setIsListening] = useState(false)
  const [heardText, setHeardText] = useState<string | null>(null)
  const [matchStatus, setMatchStatus] = useState<'idle' | 'matched' | 'retry'>('idle')
  const [matchScore, setMatchScore] = useState<number>(0)

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const completeTimerRef = useRef<number | null>(null)

  const canSpeechMatch = getSpeechRecognitionCtor() !== null

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
      if (completeTimerRef.current !== null) {
        window.clearTimeout(completeTimerRef.current)
      }
    }
  }, [])

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }

  const handleStartSpeakMatch = () => {
    if (isListening) {
      stopListening()
      return
    }

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    try {
      const recognition = new Ctor()
      recognition.lang = 'en-IN'
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? ''
        setHeardText(transcript || null)
        const result = evaluateRepeatMatch(targetSentence, transcript)
        setMatchScore(result.score)

        if (result.matched) {
          setMatchStatus('matched')
          completeTimerRef.current = window.setTimeout(() => {
            onComplete()
          }, 900)
        } else {
          setMatchStatus('retry')
        }
      }

      recognition.onerror = () => {
        setIsListening(false)
        setMatchStatus('retry')
      }

      recognition.onend = () => {
        setIsListening(false)
        recognitionRef.current = null
      }

      recognitionRef.current = recognition
      setHeardText(null)
      setMatchStatus('idle')
      setIsListening(true)
      recognition.start()
    } catch {
      setIsListening(false)
    }
  }

  const handleRatePick = (rate: SpeechRate) => {
    onSelectRate(rate)
    onPlayTarget(targetSentence, rate)
  }

  return (
    <div className="mb-2.5 rounded-2xl border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-amber-900 dark:text-amber-300">
            Speak It Once (মুখ দিয়ে একবার বলো)
          </p>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
            শুনে একবার জোরে বললেই বাক্যটা মাথায় গেঁথে যাবে (০ কোটা খরচ)।
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="shrink-0 px-2.5 py-1 rounded-lg border border-amber-500/40 text-[11px] font-semibold text-amber-800 dark:text-amber-300 cursor-pointer"
        >
          Skip
        </button>
      </div>

      <p className="rounded-xl bg-white dark:bg-slate-900 border border-amber-500/30 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
        “{targetSentence}”
      </p>

      {/* Listen + User-Selectable Speed Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPlayTarget(targetSentence, selectedRate)}
          className="min-h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer"
        >
          {isPlaying ? 'Stop' : `Listen (${selectedRate}x)`}
        </button>

        <div
          className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900"
          role="group"
          aria-label="Repeat playback speed"
        >
          {SPEED_OPTIONS.map((rate) => {
            const isSelected = selectedRate === rate
            return (
              <button
                key={rate}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleRatePick(rate)}
                className={`min-h-8 px-2 rounded-lg text-[11px] font-semibold cursor-pointer ${
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

      {/* Match feedback */}
      {matchStatus === 'matched' && (
        <p className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
          Great job! ({matchScore}% match) ✓
        </p>
      )}
      {matchStatus === 'retry' && (
        <p className="rounded-lg bg-white/80 dark:bg-slate-900/70 px-2.5 py-1.5 text-[11px] text-slate-700 dark:text-slate-300">
          {heardText ? `Heard: "${heardText}" (${matchScore}%). ` : 'Could not hear clearly. '}
          আরেকবার বলো অথবা &ldquo;I Said It ✓&rdquo; চাপো।
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {canSpeechMatch && (
          <button
            type="button"
            onClick={handleStartSpeakMatch}
            className={`flex-1 min-h-10 px-3 rounded-xl text-xs font-bold cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white'
                : 'bg-amber-600 text-white'
            }`}
          >
            {isListening ? 'Listening... Tap to Stop' : 'Speak & Match'}
          </button>
        )}
        <button
          type="button"
          onClick={onComplete}
          className="flex-1 min-h-10 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
        >
          I Said It ✓
        </button>
      </div>
    </div>
  )
}
