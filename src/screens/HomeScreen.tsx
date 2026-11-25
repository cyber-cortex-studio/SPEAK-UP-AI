import { useEffect, useState } from 'react'
import { getApiKey } from '../ai/keyVault'
import { LearningPathView } from '../components/LearningPathView'
import { ChevronRightIcon, CoachIcon } from '../components/NavIcons'
import { getDailyWarmup } from '../content/curriculumLoader'
import {
  computeDayStreak,
  computeLearningPathState,
  type LearningPathState,
} from '../db/progressLogic'
import { db, getLocalDateKey } from '../db/speakupDb'

const DAILY_GOAL_SECONDS = 600 // 10 minutes
const LAUNCH_LESSON_STORAGE_KEY = 'speakup_launch_lesson'

export function HomeScreen() {
  const [showLearningPath, setShowLearningPath] = useState(false)
  const [spokenSecondsToday, setSpokenSecondsToday] = useState(0)
  const [dayStreak, setDayStreak] = useState(0)
  const [pathState, setPathState] = useState<LearningPathState>(() =>
    computeLearningPathState([]),
  )

  const hasApiKey = Boolean(getApiKey())
  const dailyWarmup = getDailyWarmup()

  useEffect(() => {
    let active = true
    const loadHomeData = async () => {
      try {
        const [allStats, allEvidence] = await Promise.all([
          db.dailyStats.toArray(),
          db.skillEvidence.toArray(),
        ])
        if (!active) return

        const todayKey = getLocalDateKey()
        const todayStat = allStats.find((s) => s.date === todayKey)
        setSpokenSecondsToday(todayStat?.speakingSeconds ?? 0)
        setDayStreak(computeDayStreak(allStats))
        setPathState(computeLearningPathState(allEvidence))
      } catch {
        // Non-blocking: keep safe defaults if local DB is unavailable
      }
    }
    void loadHomeData()
    return () => {
      active = false
    }
  }, [])

  const openCoach = (lessonId?: string) => {
    try {
      if (lessonId) {
        window.sessionStorage.setItem(LAUNCH_LESSON_STORAGE_KEY, lessonId)
      } else {
        window.sessionStorage.removeItem(LAUNCH_LESSON_STORAGE_KEY)
      }
    } catch {
      // Ignore storage access errors in restricted webviews
    }
    window.location.hash = '#/coach'
  }

  if (showLearningPath) {
    return (
      <LearningPathView
        pathState={pathState}
        onBack={() => setShowLearningPath(false)}
        onStartPractice={openCoach}
      />
    )
  }

  const goalPercent = Math.min(100, Math.round((spokenSecondsToday / DAILY_GOAL_SECONDS) * 100))
  const spokenMinutes = Math.floor(spokenSecondsToday / 60)

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Greeting Card + Real Day Streak */}
      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Your AI English Coach
          </p>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/85 dark:bg-slate-900/80 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
            {dayStreak > 0 ? `🔥 ${dayStreak} Day Streak` : '🔥 Start Streak'}
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Hello, Learner!
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Let&apos;s practice speaking English today — step by step.
        </p>
      </section>

      {!hasApiKey && (
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/settings'
          }}
          className="w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
              Setup Free Gemini API Key
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-200/90">
              Takes 1 minute in Settings to unlock AI voice coaching
            </p>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        </button>
      )}

      {/* 1-Tap 60-Second Daily Warm-up */}
      <button
        type="button"
        onClick={() => openCoach('__daily_warmup__')}
        className="w-full rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 flex items-center justify-between gap-3 text-left hover:border-amber-500 transition-colors cursor-pointer"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            60-Second Daily Warm-up
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {dailyWarmup.titleBn}
          </span>
          <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
            {dailyWarmup.title} • Tap to start in 1 sec
          </span>
        </div>
        <span className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold">
          Go
        </span>
      </button>

      {/* Your Real Level -> Opens Dynamic Learning Path */}
      <button
        type="button"
        onClick={() => setShowLearningPath(true)}
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3 text-left hover:border-emerald-500 transition-colors cursor-pointer"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">Your Level</span>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {pathState.currentStageLabel} — {pathState.currentStageTitle}
          </span>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
            Tap to view full Learning Path
          </span>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {/* Primary Start Speaking CTA */}
      <button
        type="button"
        onClick={() => openCoach()}
        className="min-h-14 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold flex items-center justify-center gap-2.5 shadow-sm cursor-pointer transition-colors"
      >
        <CoachIcon className="w-5 h-5" />
        <span>Start Speaking</span>
      </button>

      {/* Today's Progress Bar */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Today&apos;s Goal (10 min)
          </span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {goalPercent}%
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{ width: `${goalPercent}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {spokenMinutes > 0
            ? `${spokenMinutes} min completed today — keep going!`
            : 'Start with just 1–2 minutes of speaking.'}
        </p>
      </section>
    </div>
  )
}
