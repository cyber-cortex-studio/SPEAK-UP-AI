import { useEffect, useState } from 'react'
import { getQuotaSnapshot, subscribeQuota, type QuotaSnapshot } from '../ai/quotaTracker'

export function QuotaStatusCard() {
  const [snapshot, setSnapshot] = useState<QuotaSnapshot>(() => getQuotaSnapshot())

  useEffect(() => {
    const refresh = () => setSnapshot(getQuotaSnapshot())
    const unsubscribe = subscribeQuota(refresh)
    return unsubscribe
  }, [])

  const needsLiveTick =
    snapshot.coach.cooldownSeconds > 0 ||
    snapshot.tts.cooldownSeconds > 0 ||
    snapshot.coach.usedThisMinute > 0 ||
    snapshot.tts.usedThisMinute > 0

  useEffect(() => {
    if (!needsLiveTick) {
      return
    }
    const timer = window.setInterval(() => {
      setSnapshot(getQuotaSnapshot())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [needsLiveTick])

  const coachRemainingMin = Math.max(0, snapshot.coach.limitPerMinute - snapshot.coach.usedThisMinute)
  const ttsRemainingMin = Math.max(0, snapshot.tts.limitPerMinute - snapshot.tts.usedThisMinute)

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Live Free Quota Tracker</h2>
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          Live
        </span>
      </div>

      {/* Active Cooldown Banner */}
      {(snapshot.tts.cooldownSeconds > 0 || snapshot.coach.cooldownSeconds > 0) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 font-medium">
          {snapshot.tts.cooldownSeconds > 0 && (
            <p>Voice (TTS) cooldown: wait {snapshot.tts.cooldownSeconds}s before next voice call.</p>
          )}
          {snapshot.coach.cooldownSeconds > 0 && (
            <p>AI Coach cooldown: wait {snapshot.coach.cooldownSeconds}s before next turn.</p>
          )}
        </div>
      )}

      {/* Two Buckets */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* AI Coach Quota */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            AI Coach (Chat)
          </span>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {coachRemainingMin} / {snapshot.coach.limitPerMinute} left
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            This min ({snapshot.coach.usedThisMinute} used)
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Today: {snapshot.coach.usedToday} / ~{snapshot.coach.limitPerDay}
          </span>
        </div>

        {/* Voice TTS Quota */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Voice (TTS)
          </span>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {ttsRemainingMin} / {snapshot.tts.limitPerMinute} left
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            This min ({snapshot.tts.usedThisMinute} used)
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Today: {snapshot.tts.usedToday} / ~{snapshot.tts.limitPerDay}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Estimated from your device usage. Cached voice replays use 0 quota.
      </p>
    </section>
  )
}
