import type { StageId } from '../schemas/contentSchemas'
import { getLocalDateKey, type DailyStat, type SkillEvidence } from './speakupDb'

export interface StageDefinition {
  id: StageId
  stageLabel: string
  title: string
  subtitle: string
  minTurns: number
  minDemonstrated: number
}

export interface ComputedStage extends StageDefinition {
  status: 'completed' | 'current' | 'locked'
}

export interface LearningPathState {
  currentStageId: StageId
  currentStageLabel: string
  currentStageTitle: string
  stages: ComputedStage[]
  nextGoalText: string
  totalTurns: number
  demonstratedTurns: number
}

export interface AudioXRaySummary {
  pronunciation: number
  fluency: number
  grammar: number
  confidence: number
  sampleCount: number
}

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    id: 'pre_a1',
    stageLabel: 'Stage 1: Pre-A1',
    title: 'Get Started (Basics)',
    subtitle: 'Simple greetings, daily routine & confidence',
    minTurns: 0,
    minDemonstrated: 0,
  },
  {
    id: 'a1',
    stageLabel: 'Stage 2: A1',
    title: 'Basic Communication',
    subtitle: 'Everyday questions, shopping & introductions',
    minTurns: 3,
    minDemonstrated: 0,
  },
  {
    id: 'a2',
    stageLabel: 'Stage 3: A2',
    title: 'Everyday Conversations',
    subtitle: 'Professor talks, doctor visits & social plans',
    minTurns: 8,
    minDemonstrated: 2,
  },
  {
    id: 'b1',
    stageLabel: 'Stage 4: B1',
    title: 'Real-life Communication',
    subtitle: 'Job interviews, support calls & problem solving',
    minTurns: 15,
    minDemonstrated: 5,
  },
  {
    id: 'b1_plus',
    stageLabel: 'Stage 5: B1+',
    title: 'Fluency & Confidence',
    subtitle: 'Project viva, pitching ideas & smooth replies',
    minTurns: 25,
    minDemonstrated: 10,
  },
  {
    id: 'b1_bridge',
    stageLabel: 'Stage 6: B1 Bridge',
    title: 'Independent Communication',
    subtitle: 'Tough interviews, pressure handling & clear English',
    minTurns: 40,
    minDemonstrated: 18,
  },
]

export function computeDayStreak(stats: DailyStat[], today: Date = new Date()): number {
  const activeDates = new Set(
    stats
      .filter((s) => s.turnsCount > 0 || s.speakingSeconds > 0)
      .map((s) => s.date),
  )

  if (activeDates.size === 0) {
    return 0
  }

  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayKey = getLocalDateKey(cursor)

  if (!activeDates.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1)
    if (!activeDates.has(getLocalDateKey(cursor))) {
      return 0
    }
  }

  let streak = 0
  while (activeDates.has(getLocalDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export function computeAverageXRay(
  evidence: SkillEvidence[],
  maxSamples = 20,
): AudioXRaySummary | null {
  const withXRay = [...evidence]
    .filter((item) => item.audioXRay !== undefined)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, maxSamples)

  if (withXRay.length === 0) {
    return null
  }

  let pronunciation = 0
  let fluency = 0
  let grammar = 0
  let confidence = 0

  for (const item of withXRay) {
    const x = item.audioXRay!
    pronunciation += x.pronunciation
    fluency += x.fluency
    grammar += x.grammar
    confidence += x.confidence
  }

  const count = withXRay.length
  return {
    pronunciation: Math.round(pronunciation / count),
    fluency: Math.round(fluency / count),
    grammar: Math.round(grammar / count),
    confidence: Math.round(confidence / count),
    sampleCount: count,
  }
}

export function computeLearningPathState(evidence: SkillEvidence[]): LearningPathState {
  const totalTurns = evidence.length
  const demonstratedTurns = evidence.filter((e) => e.outcome === 'demonstrated').length

  let highestUnlockedIndex = 0
  for (let i = 0; i < STAGE_DEFINITIONS.length; i += 1) {
    const def = STAGE_DEFINITIONS[i]!
    if (totalTurns >= def.minTurns && demonstratedTurns >= def.minDemonstrated) {
      highestUnlockedIndex = i
    }
  }

  const stages: ComputedStage[] = STAGE_DEFINITIONS.map((def, idx) => ({
    ...def,
    status:
      idx < highestUnlockedIndex
        ? 'completed'
        : idx === highestUnlockedIndex
          ? 'current'
          : 'locked',
  }))

  const current = STAGE_DEFINITIONS[highestUnlockedIndex]!
  const next = STAGE_DEFINITIONS[highestUnlockedIndex + 1]

  let nextGoalText =
    'You have unlocked all 6 stages! Keep sharpening your fluency in real-life missions.'
  if (next) {
    const turnsLeft = Math.max(0, next.minTurns - totalTurns)
    const demoLeft = Math.max(0, next.minDemonstrated - demonstratedTurns)
    if (turnsLeft > 0 && demoLeft > 0) {
      nextGoalText = `Complete ${turnsLeft} more speaking turns (${demoLeft} strong replies) to unlock ${next.stageLabel}.`
    } else if (turnsLeft > 0) {
      nextGoalText = `Complete ${turnsLeft} more speaking turns to unlock ${next.stageLabel} (${next.title}).`
    } else {
      nextGoalText = `Get ${demoLeft} more strong replies to unlock ${next.stageLabel} (${next.title}).`
    }
  }

  return {
    currentStageId: current.id,
    currentStageLabel: current.stageLabel,
    currentStageTitle: current.title,
    stages,
    nextGoalText,
    totalTurns,
    demonstratedTurns,
  }
}
