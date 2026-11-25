import { useEffect, useRef, useState } from 'react'
import {
  speakWithAndroidVoice,
  stopAndroidSpeech,
  type SpeechRate,
} from '../ai/androidSpeech'
import { AudioRecorderError, VoiceRecorder } from '../ai/audioRecorder'
import { GeminiClientError, sendCoachTurn, type HistoryTurn } from '../ai/geminiClient'
import { getApiKey, setKeySecurityAlert } from '../ai/keyVault'
import { buildCoachSystemPrompt, type PastMistakeMemory } from '../ai/promptBuilder'
import { loadVoiceSettings, saveVoiceSettings } from '../ai/voicePreferences'
import { CoachMessageBubble, type ChatMessage } from '../components/CoachMessageBubble'
import { ForceRepeatCard } from '../components/ForceRepeatCard'
import { MissionTrackerBar } from '../components/MissionTrackerBar'
import { StuckChipsDrawer } from '../components/StuckChipsDrawer'
import {
  createCustomTalkLesson,
  getDailyWarmup,
  getLessonById,
  getLessonsByMode,
} from '../content/curriculumLoader'
import { addSavedPhrase, db, recordCompletedTurn } from '../db/speakupDb'
import type { LessonItem, PracticeMode } from '../schemas/contentSchemas'
import type { AudioXRay, StuckChip } from '../schemas/validators'

const MODE_TABS: Array<{ id: PracticeMode; label: string }> = [
  { id: 'free_talk', label: 'Free Talk' },
  { id: 'roleplay', label: 'Roleplay' },
  { id: 'listen_reply', label: 'Listen & Reply' },
  { id: 'quick_fix', label: 'Quick Fix' },
]

const MAX_VISIBLE_MESSAGES = 20
const FORCE_REPEAT_VOICE_ID = 'force_repeat_target'
const LAUNCH_LESSON_STORAGE_KEY = 'speakup_launch_lesson'

async function loadRecentMistakes(): Promise<PastMistakeMemory[]> {
  try {
    const cards = await db.mistakeCards
      .orderBy('createdAt')
      .reverse()
      .filter((card) => !card.mastered && card.betterWay.trim().length > 0)
      .limit(2)
      .toArray()

    return cards.map((card) => ({
      learnerSaid: card.learnerSaid,
      betterWay: card.betterWay,
    }))
  } catch {
    return []
  }
}

export function CoachScreen() {
  const [selectedMode, setSelectedMode] = useState<PracticeMode>('free_talk')
  const [customTopicInput, setCustomTopicInput] = useState('')
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null)
  const [activeCustomTopic, setActiveCustomTopic] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [textInput, setTextInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const [selectedRate, setSelectedRate] = useState<SpeechRate>(
    () => loadVoiceSettings().speechRate,
  )
  const [statusError, setStatusError] = useState<string | null>(null)
  const [activeWordTip, setActiveWordTip] = useState<{ word: string; meaningBn: string } | null>(
    null,
  )
  const [activeStuckChips, setActiveStuckChips] = useState<StuckChip[]>([])
  const [pendingRepeat, setPendingRepeat] = useState<{ id: string; sentence: string } | null>(
    null,
  )
  const [completedObjectiveIds, setCompletedObjectiveIds] = useState<string[]>([])
  const [sessionXRayScores, setSessionXRayScores] = useState<AudioXRay[]>([])
  const [recentMistakes, setRecentMistakes] = useState<PastMistakeMemory[]>([])

  const recorderRef = useRef<VoiceRecorder | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const speakingRateRef = useRef<SpeechRate>(selectedRate)
  const selectedRateRef = useRef<SpeechRate>(selectedRate)

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

  const handleSelectRate = (rate: SpeechRate) => {
    setSelectedRate(rate)
    selectedRateRef.current = rate
    const current = loadVoiceSettings()
    saveVoiceSettings({ ...current, speechRate: rate })
  }

  const playCoachVoice = (
    messageId: string,
    text: string,
    rateOverride?: SpeechRate,
  ) => {
    const effectiveRate = rateOverride ?? selectedRateRef.current

    if (speakingMessageId === messageId && speakingRateRef.current === effectiveRate) {
      stopAndroidSpeech()
      setSpeakingMessageId(null)
      return
    }

    const settings = loadVoiceSettings()
    stopAndroidSpeech()
    speakingRateRef.current = effectiveRate
    setSpeakingMessageId(messageId)

    const started = speakWithAndroidVoice({
      text,
      voiceURI: settings.selectedVoiceURI || undefined,
      rate: effectiveRate,
      onEnded: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null),
    })

    if (!started) {
      setSpeakingMessageId(null)
    }
  }

  const startLesson = (lesson: LessonItem, customTopic?: string) => {
    recorderRef.current?.cancel()
    abortRef.current?.abort()
    stopAndroidSpeech()

    const starterId = `starter_${Date.now()}`
    setActiveLesson(lesson)
    setActiveCustomTopic(customTopic?.trim() || undefined)
    setStatusError(null)
    setActiveWordTip(null)
    setTextInput('')
    setPendingRepeat(null)
    setCompletedObjectiveIds([])
    setSessionXRayScores([])
    setActiveStuckChips(lesson.initialStuckChips)
    setMessages([
      {
        id: starterId,
        role: 'model',
        text: lesson.starterPrompt,
        bengaliHint: lesson.starterPromptBn,
      },
    ])

    void loadRecentMistakes().then((items) => {
      setRecentMistakes(items)
    })

    const settings = loadVoiceSettings()
    if (settings.voiceEnabled) {
      playCoachVoice(starterId, lesson.starterPrompt, selectedRateRef.current)
    }
  }

  // Handle direct lesson or 60s Warm-up launch from Home / Learning Path
  useEffect(() => {
    let active = true
    const launchPending = async () => {
      let pendingLaunch: string | null = null
      try {
        pendingLaunch = window.sessionStorage.getItem(LAUNCH_LESSON_STORAGE_KEY)
        if (pendingLaunch) {
          window.sessionStorage.removeItem(LAUNCH_LESSON_STORAGE_KEY)
        }
      } catch {
        return
      }

      if (!active || !pendingLaunch) return
      const targetLesson =
        pendingLaunch === '__daily_warmup__'
          ? getDailyWarmup()
          : getLessonById(pendingLaunch)
      if (!targetLesson) return

      const mistakes = await loadRecentMistakes()
      if (!active) return

      const starterId = `starter_${Date.now()}`
      setActiveLesson(targetLesson)
      setActiveCustomTopic(undefined)
      setStatusError(null)
      setActiveWordTip(null)
      setTextInput('')
      setPendingRepeat(null)
      setCompletedObjectiveIds([])
      setSessionXRayScores([])
      setActiveStuckChips(targetLesson.initialStuckChips)
      setRecentMistakes(mistakes)
      setMessages([
        {
          id: starterId,
          role: 'model',
          text: targetLesson.starterPrompt,
          bengaliHint: targetLesson.starterPromptBn,
        },
      ])

      const settings = loadVoiceSettings()
      if (settings.voiceEnabled) {
        const rate = selectedRateRef.current
        speakingRateRef.current = rate
        setSpeakingMessageId(starterId)
        const started = speakWithAndroidVoice({
          text: targetLesson.starterPrompt,
          voiceURI: settings.selectedVoiceURI || undefined,
          rate,
          onEnded: () => setSpeakingMessageId(null),
          onError: () => setSpeakingMessageId(null),
        })
        if (!started) {
          setSpeakingMessageId(null)
        }
      }
    }

    void launchPending()
    return () => {
      active = false
    }
  }, [])

  const handleStartCustomTalk = () => {
    const trimmed = customTopicInput.trim()
    if (!trimmed) return
    const customLesson = createCustomTalkLesson(trimmed)
    setCustomTopicInput('')
    startLesson(customLesson, trimmed)
  }

  const exitLesson = () => {
    recorderRef.current?.cancel()
    abortRef.current?.abort()
    stopAndroidSpeech()
    setIsRecording(false)
    setIsSending(false)
    setSpeakingMessageId(null)
    setActiveLesson(null)
    setActiveCustomTopic(undefined)
    setMessages([])
    setTextInput('')
    setStatusError(null)
    setActiveWordTip(null)
    setActiveStuckChips([])
    setPendingRepeat(null)
    setCompletedObjectiveIds([])
    setSessionXRayScores([])
  }

  const clearPendingRepeat = () => {
    if (speakingMessageId === FORCE_REPEAT_VOICE_ID) {
      stopAndroidSpeech()
      setSpeakingMessageId(null)
    }
    setPendingRepeat(null)
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
    clearPendingRepeat()
    stopAndroidSpeech()
    setSpeakingMessageId(null)

    const controller = new AbortController()
    abortRef.current = controller

    const settings = loadVoiceSettings()
    const systemInstruction = buildCoachSystemPrompt(activeLesson, settings.bengaliLevel, {
      missionObjectives: activeLesson.missionObjectives,
      completedObjectiveIds,
      recentMistakes,
      customTopic: activeCustomTopic,
      isAudioTurn: Boolean(payload.userAudio),
      isWarmup: activeLesson.isWarmup,
    })
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
        bengaliPhoneticTip: result.audioXRay?.bengaliPhoneticTip,
        bengaliBridgeUsed: result.bengaliBridgeUsed,
        wordMeanings: result.wordMeanings,
      }

      setMessages((prev) => [...prev, userMsg, coachMsg].slice(-MAX_VISIBLE_MESSAGES))

      if (result.stuckChips.length > 0) {
        setActiveStuckChips(result.stuckChips)
      }

      if (result.repeatTarget) {
        setPendingRepeat({ id: coachMsgId, sentence: result.repeatTarget })
      }

      if (result.audioXRay) {
        const latestXRay = result.audioXRay
        setSessionXRayScores((prev) => [...prev, latestXRay])
      }

      if (
        activeLesson.missionObjectives.length > 0 &&
        result.completedObjectiveIds.length > 0
      ) {
        const validIds = new Set(activeLesson.missionObjectives.map((o) => o.id))
        setCompletedObjectiveIds((prev) => {
          const merged = new Set(prev)
          for (const id of result.completedObjectiveIds) {
            if (validIds.has(id)) {
              merged.add(id)
            }
          }
          return Array.from(merged)
        })
      }

      void recordCompletedTurn({
        lessonId: activeLesson.id,
        speakingSeconds: payload.durationSeconds ?? 0,
        skill: result.evidenceProposal.skill,
        outcome: result.evidenceProposal.outcome,
        confidence: result.evidenceProposal.confidence,
        audioXRay: result.audioXRay,
        correction: result.correction,
      })
        .then(() => loadRecentMistakes())
        .then((items) => setRecentMistakes(items))
        .catch(() => {
          // Non-blocking: local DB failure should never interrupt live coaching
        })

      if (settings.voiceEnabled) {
        playCoachVoice(coachMsgId, result.reply, selectedRateRef.current)
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
        } else if (err.code === 'server_busy') {
          setStatusError('Google AI servers are briefly busy. Tap Send again in a few seconds.')
        } else if (err.code === 'timeout') {
          setStatusError('Request timed out. Check your internet and try again.')
        } else {
          setStatusError('Could not reach the AI Coach right now. Please try again.')
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

        {/* Custom Talk (Talk About Anything in English or Bengali) */}
        <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/5 dark:bg-emerald-950/20 p-3.5 flex flex-col gap-2">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Custom Talk (নিজের টপিকে কথা বলো)
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              যেকোনো বাস্তব পরিস্থিতি বা আড্ডার টপিক বাংলা বা ইংরেজিতে লেখো — ০ কোটায় রুম খুলবে।
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customTopicInput}
              onChange={(e) => setCustomTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleStartCustomTalk()
                }
              }}
              placeholder="যেমন: বন্ধুর সাথে ক্রিকেট নিয়ে আড্ডা..."
              className="min-h-11 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={!customTopicInput.trim()}
              onClick={handleStartCustomTalk}
              className="min-h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-40"
            >
              Start
            </button>
          </div>
        </div>

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
                <span className="shrink-0 text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  {lesson.stage.replace('_', '-')}
                </span>
              </div>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {lesson.titleBn}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{lesson.description}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  ~{lesson.estimatedMinutes} min
                </span>
                {lesson.isWarmup && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    60s Warm-up
                  </span>
                )}
                {lesson.missionObjectives.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
                    {lesson.missionObjectives.length} Mission Goals
                  </span>
                )}
                {lesson.alwaysUnlocked && !lesson.isWarmup && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    Always Open
                  </span>
                )}
              </div>
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

      {/* Live Mission Goals Bar */}
      {activeLesson.missionObjectives.length > 0 && (
        <div className="px-4 pt-2.5 shrink-0">
          <MissionTrackerBar
            key={activeLesson.id}
            objectives={activeLesson.missionObjectives}
            completedIds={completedObjectiveIds}
            xrayScores={sessionXRayScores}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg) => (
          <CoachMessageBubble
            key={msg.id}
            message={msg}
            isPlaying={speakingMessageId === msg.id}
            speakingMessageId={speakingMessageId}
            selectedRate={selectedRate}
            onSelectRate={handleSelectRate}
            onPlayVoice={(id, text, rateOverride) =>
              playCoachVoice(id, text, rateOverride)
            }
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
        {/* Force-Repeat Muscle Memory Drill (0 Extra API Quota) */}
        {pendingRepeat && (
          <ForceRepeatCard
            key={pendingRepeat.id}
            targetSentence={pendingRepeat.sentence}
            selectedRate={selectedRate}
            onSelectRate={handleSelectRate}
            isPlaying={speakingMessageId === FORCE_REPEAT_VOICE_ID}
            onPlayTarget={(text, rate) =>
              playCoachVoice(FORCE_REPEAT_VOICE_ID, text, rate)
            }
            onComplete={clearPendingRepeat}
            onSkip={clearPendingRepeat}
          />
        )}

        {/* Anti-Freeze Reply Chips Drawer */}
        {!pendingRepeat && activeStuckChips.length > 0 && (
          <StuckChipsDrawer
            chips={activeStuckChips}
            selectedRate={selectedRate}
            speakingMessageId={speakingMessageId}
            onPlayChip={(chipId, text, rate) => playCoachVoice(chipId, text, rate)}
            onUseChip={(text) => setTextInput(text)}
            disabled={isRecording || isSending}
          />
        )}

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
            placeholder="Type in English or বাংলা..."
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
