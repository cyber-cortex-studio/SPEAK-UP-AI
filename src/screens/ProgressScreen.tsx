import { useEffect, useState } from 'react'
import {
  computeAverageXRay,
  computeDayStreak,
  type AudioXRaySummary,
} from '../db/progressLogic'
import {
  clearAllLearningData,
  db,
  deleteMistakeCard,
  deleteSavedPhrase,
  getLocalDateKey,
  toggleMistakeMastered,
  type MistakeCard,
  type SavedPhrase,
} from '../db/speakupDb'

type ProgressTab = 'mistakes' | 'phrases'

async function fetchProgressData() {
  const todayKey = getLocalDateKey()
  const [allStats, allEvidence, recentMistakes, recentPhrases] = await Promise.all([
    db.dailyStats.toArray(),
    db.skillEvidence.toArray(),
    db.mistakeCards.orderBy('createdAt').reverse().limit(50).toArray(),
    db.savedPhrases.orderBy('createdAt').reverse().limit(50).toArray(),
  ])

  const todayStat = allStats.find((s) => s.date === todayKey)

  return {
    todaySeconds: todayStat?.speakingSeconds ?? 0,
    todayTurns: todayStat?.turnsCount ?? 0,
    dayStreak: computeDayStreak(allStats),
    xraySummary: computeAverageXRay(allEvidence),
    mistakes: recentMistakes,
    phrases: recentPhrases,
  }
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export function ProgressScreen() {
  const [activeTab, setActiveTab] = useState<ProgressTab>('mistakes')
  const [todaySeconds, setTodaySeconds] = useState(0)
  const [todayTurns, setTodayTurns] = useState(0)
  const [dayStreak, setDayStreak] = useState(0)
  const [xraySummary, setXraySummary] = useState<AudioXRaySummary | null>(null)
  const [mistakes, setMistakes] = useState<MistakeCard[]>([])
  const [phrases, setPhrases] = useState<SavedPhrase[]>([])
  const [confirmReset, setConfirmReset] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async () => {
    const data = await fetchProgressData()
    setTodaySeconds(data.todaySeconds)
    setTodayTurns(data.todayTurns)
    setDayStreak(data.dayStreak)
    setXraySummary(data.xraySummary)
    setMistakes(data.mistakes)
    setPhrases(data.phrases)
    setIsLoading(false)
  }

  useEffect(() => {
    let active = true
    void fetchProgressData().then((data) => {
      if (!active) return
      setTodaySeconds(data.todaySeconds)
      setTodayTurns(data.todayTurns)
      setDayStreak(data.dayStreak)
      setXraySummary(data.xraySummary)
      setMistakes(data.mistakes)
      setPhrases(data.phrases)
      setIsLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const handleToggleMastered = async (card: MistakeCard) => {
    if (card.id === undefined) {
      return
    }
    await toggleMistakeMastered(card.id, !card.mastered)
    await loadData()
  }

  const handleDeleteMistake = async (id?: number) => {
    if (id === undefined) {
      return
    }
    await deleteMistakeCard(id)
    await loadData()
  }

  const handleDeletePhrase = async (id?: number) => {
    if (id === undefined) {
      return
    }
    await deleteSavedPhrase(id)
    await loadData()
  }

  const handleResetAll = async () => {
    await clearAllLearningData()
    setConfirmReset(false)
    await loadData()
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Daily & Streak Stats */}
      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatDuration(todaySeconds)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Spoken Today</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{todayTurns}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Turns Today</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            🔥 {dayStreak}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Day Streak</p>
        </div>
      </section>

      {/* 4-Skill Audio X-Ray Summary */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Speaking X-Ray
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {xraySummary
                ? `Average from your last ${xraySummary.sampleCount} speaking turns`
                : 'Complete 1 voice turn in Coach to see your 4-skill X-Ray'}
            </p>
          </div>
        </div>

        {xraySummary && (
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Pronunciation', value: xraySummary.pronunciation },
              { label: 'Fluency', value: xraySummary.fluency },
              { label: 'Grammar', value: xraySummary.grammar },
              { label: 'Confidence', value: xraySummary.confidence },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2.5"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{item.value}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tabs: Mistake Cards vs Saved Phrases */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('mistakes')}
          className={`min-h-12 rounded-xl border text-xs font-semibold cursor-pointer ${
            activeTab === 'mistakes'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
          }`}
        >
          Mistake Cards ({mistakes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('phrases')}
          className={`min-h-12 rounded-xl border text-xs font-semibold cursor-pointer ${
            activeTab === 'phrases'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
          }`}
        >
          Saved Phrases ({phrases.length})
        </button>
      </div>

      {/* Content List */}
      {isLoading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
          Loading your progress...
        </p>
      ) : activeTab === 'mistakes' ? (
        mistakes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-center text-xs text-slate-500 dark:text-slate-400">
            No mistake cards yet. Practice with the AI Coach and any gentle corrections will appear here for revision.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mistakes.map((card) => (
              <div
                key={card.id}
                className={`rounded-2xl border p-4 flex flex-col gap-1.5 text-xs ${
                  card.mastered
                    ? 'border-emerald-500/30 bg-emerald-500/5 opacity-75'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <p className="text-slate-500 dark:text-slate-400 line-through">
                  {card.learnerSaid}
                </p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {card.betterWay}
                </p>
                <p className="text-slate-700 dark:text-slate-300">{card.shortNoteBn}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleToggleMastered(card)
                    }}
                    className={`min-h-10 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                      card.mastered
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {card.mastered ? 'Mastered' : 'Mark Mastered'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteMistake(card.id)
                    }}
                    className="min-h-10 px-3 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : phrases.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-center text-xs text-slate-500 dark:text-slate-400">
          No saved phrases yet. Tap &ldquo;Save&rdquo; on any natural phrasing tip in Coach to keep it here.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {phrases.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-start justify-between gap-3"
            >
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.phrase}
                </p>
                {item.noteBn && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">{item.noteBn}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleDeletePhrase(item.id)
                }}
                className="min-h-10 px-3 shrink-0 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Safe Two-Tap Reset Section */}
      <section className="mt-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          Local Storage Management
        </h3>
        {confirmReset ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="min-h-11 flex-1 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleResetAll()
              }}
              className="min-h-11 flex-1 rounded-xl bg-rose-600 text-white text-xs font-semibold cursor-pointer"
            >
              Confirm Clear All
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="min-h-11 w-full rounded-xl border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer"
          >
            Clear All Progress Data
          </button>
        )}
      </section>
    </div>
  )
}
