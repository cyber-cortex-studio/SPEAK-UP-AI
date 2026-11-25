import { useState } from 'react'
import type { MissionObjective } from '../schemas/contentSchemas'
import type { AudioXRay } from '../schemas/validators'

interface MissionTrackerBarProps {
  objectives: MissionObjective[]
  completedIds: string[]
  xrayScores: AudioXRay[]
}

function averageScore(scores: number[]): number {
  if (scores.length === 0) return 0
  const sum = scores.reduce((acc, n) => acc + n, 0)
  return Math.round(sum / scores.length)
}

export function MissionTrackerBar({
  objectives,
  completedIds,
  xrayScores,
}: MissionTrackerBarProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [reportDismissed, setReportDismissed] = useState(false)

  if (objectives.length === 0) {
    return null
  }

  const completedSet = new Set(completedIds)
  const doneCount = objectives.filter((obj) => completedSet.has(obj.id)).length
  const totalCount = objectives.length
  const allComplete = doneCount === totalCount
  const progressPct = Math.round((doneCount / totalCount) * 100)

  const avgXRay =
    xrayScores.length > 0
      ? {
          pronunciation: averageScore(xrayScores.map((x) => x.pronunciation)),
          fluency: averageScore(xrayScores.map((x) => x.fluency)),
          grammar: averageScore(xrayScores.map((x) => x.grammar)),
          confidence: averageScore(xrayScores.map((x) => x.confidence)),
        }
      : null

  return (
    <div className="mb-2.5 flex flex-col gap-2">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                allComplete
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              Mission {doneCount}/{totalCount}
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
              {allComplete ? 'Mission Complete!' : 'Live Goals (কথা বলার টার্গেট)'}
            </span>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {isExpanded ? 'Hide' : 'Show'}
          </span>
        </button>

        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {isExpanded && (
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {objectives.map((obj) => {
              const isDone = completedSet.has(obj.id)
              return (
                <li
                  key={obj.id}
                  className={`flex items-start gap-2 rounded-xl px-2.5 py-1.5 text-xs ${
                    isDone
                      ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-300 dark:border-slate-600 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <div className="min-w-0">
                    <p className={isDone ? 'line-through font-medium' : 'font-medium'}>
                      {obj.label}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {obj.labelBn}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Mission Complete Report Card */}
      {allComplete && !reportDismissed && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                Mission Accomplished! (দারুণ করেছ!)
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                সব ৩টি টার্গেট পূরণ হয়েছে। চাইলে আরও কথা চালিয়ে যেতে পারো।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReportDismissed(true)}
              className="shrink-0 px-2.5 py-1 rounded-lg border border-emerald-600/30 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 cursor-pointer"
            >
              Close
            </button>
          </div>

          {avgXRay && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Pronunciation', value: avgXRay.pronunciation },
                { label: 'Fluency', value: avgXRay.fluency },
                { label: 'Grammar', value: avgXRay.grammar },
                { label: 'Confidence', value: avgXRay.confidence },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-500/20 p-2"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    <span>{stat.label}</span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {stat.value}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${stat.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
