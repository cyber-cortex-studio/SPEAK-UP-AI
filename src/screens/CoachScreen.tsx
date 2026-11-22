import { useEffect, useRef, useState } from 'react'
import { speakWithAndroidVoice, stopAndroidSpeech } from '../ai/androidSpeech'
import { AudioRecorderError, VoiceRecorder } from '../ai/audioRecorder'
import { GeminiClientError, sendCoachTurn, type HistoryTurn } from '../ai/geminiClient'
import { getApiKey, setKeySecurityAlert } from '../ai/keyVault'
import { buildCoachSystemPrompt } from '../ai/promptBuilder'
import { loadVoiceSettings } from '../ai/voicePreferences'
import { CoachMessageBubble, type ChatMessage } from '../components/CoachMessageBubble'
import { getLessonsByMode } from '../content/curriculumLoader'
import { addSavedPhrase, recordCompletedTurn } from '../db/speakupDb'
import type { LessonItem, PracticeMode } from '../schemas/contentSchemas'

const MODE_TABS: Array<{ id: PracticeMode; label: string }> = [
  { id: 'free_talk', label: 'Free Talk' },
  { id: 'roleplay', label: 'Roleplay' },
  { id: 'listen_reply', label: 'Listen & Reply' },
  { id: 'quick_fix', label: 'Quick Fix' },
]

const MAX_VISIBLE_MESSAGES = 20

export function CoachScreen() {
  const [selectedMode, setSelectedMode] = useState<PracticeMode>('free_talk')
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [textInput, setTextInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [activeWordTip, setActiveWordTip] = useState<{ word: string; meaningBn: string } | null>(
    null,
  )

  const recorderRef = useRef<VoiceRecorder | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const hasApiKey = Boolean(getApiKey())
  const lessons = getLessonsByMode(selectedMode)

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel()
      abortRef.current?.abort()
      stopAndroidSpeech()
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  const playCoachVoice = (messageId: string, text: string) => {
    if (speakingMessageId === messageId) {
      stopAndroidSpeech()
      setSpeakingMessageId(null)
      return
    }

    const settings = loadVoiceSettings()
    setSpeakingMessageId(messageId)

    const started = speakWithAndroidVoice({
      text,
      voiceURI: settings.selectedVoiceURI || undefined,
      rate: settings.speechRate,
      onEnded: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null),
    })

    if (!started) {
      setSpeakingMessageId(null)
    }
  }

  const startLesson = (lesson: LessonItem) => {
    recorderRef.current?.cancel()
    abortRef.current?.abort()
    stopAndroidSpeech()

    const starterId = `starter_${Date.now()}`
    setActiveLesson(lesson)
    setStatusError(null)
    setActiveWordTip(null)
    setMessages([
      {
        id: starterId,
        role: 'model',
        text: lesson.starterPrompt,
        bengaliHint: lesson.starterPromptBn,
      },
    ])

    const settings = loadVoiceSettings()
    if (settings.voiceEnabled) {
      playCoachVoice(starterId, lesson.starterPrompt)
    }
  }

  const exitLesson = () => {
    recorderRef.current?.cancel()
    abortRef.current?.abort()
    stopAndroidSpeech()
    setIsRecording(false)
    setIsSending(false)
    setSpeakingMessageId(null)
    setActiveLesson(null)
    setMessages([])
    setStatusError(null)
    setActiveWordTip(null)
  }

  const submitTurn = async (payload: {
    userText?: string
    userAudio?: { base64: string; mimeType: string }
    durationSeconds?: number
  }) => {
    if (!activeLesson || isSending) {
      return
    }

    setStatusError(null)
    setIsSending(true)
    stopAndroidSpeech()
    setSpeakingMessageId(null)

    const controller = new AbortController()
    abortRef.current = controller

    const settings = loadVoiceSettings()
    const systemInstruction = buildCoachSystemPrompt(activeLesson, settings.bengaliLevel)
    const history: HistoryTurn[] = messages.map((m) => ({
      role: m.role,
      text: m.text,
    }))

    try {
      const result = await sendCoachTurn({
        systemInstruction,
        history,
        userText: payload.userText,
        userAudio: payload.userAudio,
        signal: controller.signal,
      })

      const now = Date.now()
      const userMsg: ChatMessage = {
        id: `u_${now}`,
        role: 'user',
        text: result.learnerTranscript || payload.userText || '(Voice message)',
      }
      const coachMsgId = `m_${now + 1}`
      const coachMsg: ChatMessage = {
        id: coachMsgId,
        role: 'model',
        text: result.reply,
        bengaliHint: result.bengaliHint,
        correction: result.correction,
        sayItBetter: result.sayItBetter,
        pronunciationNote: result.pronunciationNote,
        wordMeanings: result.wordMeanings,
      }

      setMessages((prev) => [...prev, userMsg, coachMsg].slice(-MAX_VISIBLE_MESSAGES))

      void recordCompletedTurn({
        lessonId: activeLesson.id,
        speakingSeconds: payload.durationSeconds ?? 0,
        skill: result.evidenceProposal.skill,
        outcome: result.evidenceProposal.outcome,
        confidence: result.evidenceProposal.confidence,
        correction: result.correction,
      }).catch(() => {
        // Non-blocking: local DB failure should never interrupt live coaching
      })

      if (settings.voiceEnabled) {
        playCoachVoice(coachMsgId, result.reply)
      }
    } catch (err: unknown) {
      if (err instanceof GeminiClientError) {
        if (err.code === 'aborted') {
          return
        }
        if (err.code === 'missing_key') {
          setStatusError('Please connect your Gemini API key in Settings first.')
        } else if (err.code === 'invalid_key') {
          setKeySecurityAlert(true)
          setStatusError('Your API key needs a refresh. Open Settings to replace it safely.')
        } else if (err.code === 'rate_limited_rpm') {
          setStatusError('Free-tier limit hit. Please wait 45 seconds and try again.')
        } else if (err.code === 'rate_limited_rpd') {
          setStatusError('Daily free-tier quota may be full. Try again later or check Settings.')
        } else if (err.code === 'timeout') {
          setStatusError('Request timed out. Check your internet and try again.')
        } else {
          setStatusError('Could not get a reply right now. Please try again.')
        }
      } else {
        setStatusError('Something went wrong. Please try again.')
      }
    } finally {
      setIsSending(false)
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }

  const handleStopAndSendMic = async () => {
    const recorder = recorderRef.current
    if (!recorder || !recorder.isRecording()) {
      setIsRecording(false)
      return
    }
    setIsRecording(false)

    try {
      const audio = await recorder.stop()
      await submitTurn({
        userAudio: { base64: audio.base64, mimeType: audio.mimeType },
        durationSeconds: audio.durationSeconds,
      })
    } catch (err: unknown) {
      if (err instanceof AudioRecorderError) {
        if (err.code === 'payload_too_large') {
          setStatusError('Recording was too long (over 1 MB). Keep replies under 60 seconds.')
        } else if (err.code === 'empty_recording') {
          setStatusError('No voice was captured. Tap Speak and talk clearly.')
        } else {
          setStatusError('Microphone recording failed. Try again.')
        }
      }
    }
  }

  const handleStartMic = async () => {
    if (isSending) {
      return
    }
    setStatusError(null)
    stopAndroidSpeech()
    setSpeakingMessageId(null)

    if (!recorderRef.current) {
      recorderRef.current = new VoiceRecorder()
    }

    try {
      await recorderRef.current.start(() => {
        void handleStopAndSendMic()
      })
      setIsRecording(true)
    } catch (err: unknown) {
      setIsRecording(false)
      if (err instanceof AudioRecorderError && err.code === 'permission_denied') {
        setStatusError('Microphone permission denied. Allow mic access in Chrome settings.')
      } else {
        setStatusError('Microphone is not available on this browser.')
      }
    }
  }

  const handleCancelMic = () => {
    recorderRef.current?.cancel()
    setIsRecording(false)
  }

  const handleSendText = () => {
    const trimmed = textInput.trim()
    if (!trimmed || isSending) {
      return
    }
    setTextInput('')
    void submitTurn({ userText: trimmed })
  }

  if (!activeLesson) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {!hasApiKey && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col gap-2.5">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Connect Gemini API Key to Start
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-200/90">
              Follow our 1-minute step-by-step guide in Settings to activate your free AI speaking coach.
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/settings'
              }}
              className="min-h-12 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
            >
              Open Settings &amp; Setup Key
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {MODE_TABS.map((tab) => {
            const active = selectedMode === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedMode(tab.id)}
                className={`min-h-12 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                  active
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3">
          {lessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              onClick={() => startLesson(lesson)}
              className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-emerald-500 transition-colors cursor-pointer flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lesson.title}
                </span>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  {lesson.stage.replace('_', '-')}
                </span>
              </div>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {lesson.titleBn}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{lesson.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <button
          type="button"
          onClick={exitLesson}
          className="min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
        >
          Back
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-xs font-bold truncate">{activeLesson.title}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {activeLesson.titleBn}
          </p>
        </div>
        <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shrink-0">
          {activeLesson.stage.replace('_', '-')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg) => (
          <CoachMessageBubble
            key={msg.id}
            message={msg}
            isPlaying={speakingMessageId === msg.id}
            onPlayVoice={(id, text) => playCoachVoice(id, text)}
            onSelectWord={setActiveWordTip}
            onSavePhrase={(phrase, noteBn) => {
              void addSavedPhrase(phrase, noteBn).catch(() => {})
            }}
          />
        ))}

        {isSending && (
          <div className="self-start rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
            Coach is listening and thinking...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {activeWordTip && (
        <div className="mx-4 mb-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 flex items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              {activeWordTip.word}:{' '}
            </span>
            <span>{activeWordTip.meaningBn}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveWordTip(null)}
            className="text-xs font-semibold px-2 py-1 cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {statusError && (
        <div className="px-4 pb-2">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{statusError}</p>
        </div>
      )}

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-2 shrink-0">
        {isRecording ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancelMic}
              className="min-h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleStopAndSendMic()
              }}
              className="min-h-12 flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white cursor-pointer"
            >
              Stop &amp; Send Voice
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isSending}
            onClick={() => {
              void handleStartMic()
            }}
            className="min-h-12 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            {isSending ? 'Sending...' : 'Tap to Speak'}
          </button>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSendText()
              }
            }}
            disabled={isRecording || isSending}
            placeholder="Or type your reply..."
            className="min-h-11 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            disabled={isRecording || isSending || !textInput.trim()}
            onClick={handleSendText}
            className="min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
