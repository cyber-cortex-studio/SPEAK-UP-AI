import { useEffect, useState } from 'react'
import { getApiKey } from '../ai/keyVault'
import { db, getLocalDateKey } from '../db/speakupDb'

interface HomeSummary {
  todaySeconds: number
  todayTurns: number
  pendingMistakes: number
}

async function fetchHomeSummary(): Promise<HomeSummary> {
  const todayKey = getLocalDateKey()
  const [todayStat, pendingMistakes] = await Promise.all([
    db.dailyStats.get(todayKey),
    db.mistakeCards.filter((card) => !card.mastered).count(),
  ])
  return {
    todaySeconds: todayStat?.speakingSeconds ?? 0,
    todayTurns: todayStat?.turnsCount ?? 0,
    pendingMistakes,
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

export function HomeScreen() {
  const [summary, setSummary] = useState<HomeSummary>({
    todaySeconds: 0,
    todayTurns: 0,
    pendingMistakes: 0,
  })
  const hasApiKey = Boolean(getApiKey())

  useEffect(() => {
    let active = true
    void fetchHomeSummary().then((data) => {
      if (active) {
        setSummary(data)
      }
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Hero Speaking Card */}
      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-600 text-white p-5 flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium text-emerald-100">Daily English Practice</p>
          <h2 className="text-xl font-bold mt-0.5">Ready to speak today?</h2>
          <p className="text-xs text-emerald-50/90 mt-1">
            Practice 5 minutes a day with your personal AI voice coach.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/coach'
          }}
          className="min-h-12 w-full rounded-xl bg-white text-emerald-700 font-bold text-sm cursor-pointer hover:bg-emerald-50 transition-colors"
        >
          Start Speaking Now
        </button>
      </section>

      {/* API Key Status Prompt (Only if not connected) */}
      {!hasApiKey && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col gap-2.5">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            1-Minute Setup Required
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-200/90">
            Connect your free personal Gemini API key in Settings to unlock voice coaching.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/settings'
            }}
            className="min-h-11 w-full rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white cursor-pointer"
          >
            Setup Gemini API Key
          </button>
        </section>
      )}

      {/* Today's Live Stats */}
      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatDuration(summary.todaySeconds)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Spoken Today</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {summary.todayTurns}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Turns Today</p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/progress'
          }}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center cursor-pointer hover:border-emerald-500 transition-colors"
        >
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {summary.pendingMistakes}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">To Review</p>
        </button>
      </section>

      {/* Quick Practice Modes */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-2.5">
        <h3 className="text-sm font-semibold">Practice Modes</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/coach'
            }}
            className="min-h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-left cursor-pointer hover:border-emerald-500"
          >
            <p className="font-semibold">Free Talk</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Daily topics</p>
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/coach'
            }}
            className="min-h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-left cursor-pointer hover:border-emerald-500"
          >
            <p className="font-semibold">Roleplay</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Real-life scenes</p>
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/coach'
            }}
            className="min-h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-left cursor-pointer hover:border-emerald-500"
          >
            <p className="font-semibold">Listen &amp; Reply</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Audio comprehension</p>
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/coach'
            }}
            className="min-h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-left cursor-pointer hover:border-emerald-500"
          >
            <p className="font-semibold">Quick Fix</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">3-second reflex</p>
          </button>
        </div>
      </section>
    </div>
  )
}
