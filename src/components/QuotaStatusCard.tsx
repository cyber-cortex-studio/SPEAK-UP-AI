import { useEffect, useState } from 'react'
import { getQuotaSnapshot, subscribeQuota, type CoachQuotaSnapshot } from '../ai/quotaTracker'

export function QuotaStatusCard() {
  const [snapshot, setSnapshot] = useState<CoachQuotaSnapshot>(() => getQuotaSnapshot())

  useEffect(() => {
    const refresh = () => setSnapshot(getQuotaSnapshot())
    return subscribeQuota(refresh)
  }, [])

  const needsLiveTick = snapshot.cooldownSeconds > 0 || snapshot.usedThisMinute > 0

  useEffect(() => {
    if (!needsLiveTick) {
      return
    }
    const timer = window.setInterval(() => {
      setSnapshot(getQuotaSnapshot())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [needsLiveTick])

  const coachRemainingMin = Math.max(0, snapshot.limitPerMinute - snapshot.usedThisMinute)

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Live Free Quota Tracker</h2>
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          Live
        </span>
      </div>

      {snapshot.cooldownSeconds > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 font-medium">
          AI Coach cooldown: wait {snapshot.cooldownSeconds}s before next turn.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            AI Coach (Chat)
          </span>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {coachRemainingMin} / {snapshot.limitPerMinute} left
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            This min ({snapshot.usedThisMinute} used)
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Today: {snapshot.usedToday} / ~{snapshot.limitPerDay}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Android Voice
          </span>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Unlimited</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            0 API quota used
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Powered by your phone
          </span>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Estimated from your device usage. Supports ~60+ mins of daily speaking practice.
      </p>
    </section>
  )
}
