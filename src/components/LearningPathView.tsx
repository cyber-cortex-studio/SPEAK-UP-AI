import { getLessonsByStage } from '../content/curriculumLoader'
import type { LearningPathState } from '../db/progressLogic'
import type { StageId } from '../schemas/contentSchemas'
import { ChevronRightIcon, LockIcon } from './NavIcons'

interface LearningPathViewProps {
  pathState: LearningPathState
  onBack: () => void
  onStartPractice: (lessonId?: string) => void
}

function pickPrimaryLessonForStage(stageId: StageId): string | undefined {
  const lessons = getLessonsByStage(stageId)
  const mission = lessons.find((item) => !item.isWarmup)
  return (mission ?? lessons[0])?.id
}

export function LearningPathView({
  pathState,
  onBack,
  onStartPractice,
}: LearningPathViewProps) {
  const currentStageLessonId = pickPrimaryLessonForStage(pathState.currentStageId)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          Back
        </button>
        <div>
          <h2 className="text-base font-bold">Learning Path</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {pathState.totalTurns} speaking turns completed
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {pathState.stages.map((stage) => {
          const isCurrent = stage.status === 'current'
          const isCompleted = stage.status === 'completed'
          const isLocked = stage.status === 'locked'
          const stageLessonId = pickPrimaryLessonForStage(stage.id)

          return (
            <button
              key={stage.id}
              type="button"
              disabled={isLocked}
              onClick={() => onStartPractice(stageLessonId)}
              className={`w-full rounded-2xl border p-4 flex items-center justify-between gap-3 text-left transition-colors ${
                isCurrent
                  ? 'border-emerald-500 bg-emerald-500/10 cursor-pointer'
                  : isCompleted
                    ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/50 cursor-pointer'
                    : 'border-slate-200/70 dark:border-slate-800/70 bg-slate-100/70 dark:bg-slate-900/50 opacity-70 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isLocked ? (
                    <LockIcon className="w-4 h-4" />
                  ) : isCompleted ? (
                    '✓'
                  ) : (
                    '▶'
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {stage.stageLabel}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {stage.title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {stage.subtitle}
                  </p>
                </div>
              </div>

              {!isLocked && (
                <ChevronRightIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col gap-2">
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
          Next Goal
        </span>
        <p className="text-xs text-slate-700 dark:text-slate-300">
          {pathState.nextGoalText}
        </p>
        <button
          type="button"
          onClick={() => onStartPractice(currentStageLessonId)}
          className="mt-1 min-h-12 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white cursor-pointer"
        >
          Practice {pathState.currentStageLabel}
        </button>
      </section>
    </div>
  )
}
