import { describe, expect, it } from 'vitest'
import {
  computeAverageXRay,
  computeDayStreak,
  computeLearningPathState,
} from './progressLogic'
import type { DailyStat, SkillEvidence } from './speakupDb'

describe('progressLogic (v11.0 Live Brain Connection)', () => {
  it('computes real consecutive day streak including yesterday grace period', () => {
    const today = new Date('2026-11-24T12:00:00')
    const stats: DailyStat[] = [
      { date: '2026-11-24', speakingSeconds: 120, turnsCount: 3 },
      { date: '2026-11-23', speakingSeconds: 90, turnsCount: 2 },
      { date: '2026-11-22', speakingSeconds: 60, turnsCount: 1 },
      { date: '2026-11-20', speakingSeconds: 100, turnsCount: 2 },
    ]
    expect(computeDayStreak(stats, today)).toBe(3)

    const yesterdayOnly: DailyStat[] = [
      { date: '2026-11-23', speakingSeconds: 90, turnsCount: 2 },
      { date: '2026-11-22', speakingSeconds: 60, turnsCount: 1 },
    ]
    expect(computeDayStreak(yesterdayOnly, today)).toBe(2)

    const broken: DailyStat[] = [
      { date: '2026-11-22', speakingSeconds: 60, turnsCount: 1 },
    ]
    expect(computeDayStreak(broken, today)).toBe(0)
  })

  it('unlocks Learning Path stages dynamically based on turns and demonstrated outcomes', () => {
    const empty = computeLearningPathState([])
    expect(empty.currentStageId).toBe('pre_a1')
    expect(empty.stages[0]?.status).toBe('current')
    expect(empty.stages[1]?.status).toBe('locked')

    const makeEvidence = (
      count: number,
      outcome: 'demonstrated' | 'developing',
    ): SkillEvidence[] =>
      Array.from({ length: count }, (_, i) => ({
        createdAt: 1000 + i,
        lessonId: 'rp_new_friend',
        skill: 'speaking',
        outcome,
        confidence: 'high',
      }))

    const stageA1 = computeLearningPathState(makeEvidence(3, 'developing'))
    expect(stageA1.currentStageId).toBe('a1')
    expect(stageA1.stages[0]?.status).toBe('completed')
    expect(stageA1.stages[1]?.status).toBe('current')

    const stageA2 = computeLearningPathState([
      ...makeEvidence(6, 'developing'),
      ...makeEvidence(2, 'demonstrated'),
    ])
    expect(stageA2.currentStageId).toBe('a2')
  })

  it('averages 4-skill Audio X-Ray scores cleanly', () => {
    expect(computeAverageXRay([])).toBeNull()

    const evidence: SkillEvidence[] = [
      {
        createdAt: 1,
        lessonId: 'm1',
        skill: 'speaking',
        outcome: 'developing',
        confidence: 'medium',
        audioXRay: { pronunciation: 80, fluency: 70, grammar: 60, confidence: 90, bengaliPhoneticTip: undefined },
      },
      {
        createdAt: 2,
        lessonId: 'm1',
        skill: 'speaking',
        outcome: 'demonstrated',
        confidence: 'high',
        audioXRay: { pronunciation: 90, fluency: 80, grammar: 80, confidence: 80, bengaliPhoneticTip: undefined },
      },
    ]

    const avg = computeAverageXRay(evidence)
    expect(avg).toEqual({
      pronunciation: 85,
      fluency: 75,
      grammar: 70,
      confidence: 85,
      sampleCount: 2,
    })
  })
})
