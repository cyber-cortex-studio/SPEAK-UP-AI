import { describe, expect, it } from 'vitest'
import type { StageId } from '../schemas/contentSchemas'
import {
  createCustomTalkLesson,
  getCurriculum,
  getDailyWarmup,
  getLessonById,
  getLessonsByMode,
  getLessonsByStage,
  getWarmupLessons,
} from './curriculumLoader'

const ALL_STAGES: StageId[] = ['pre_a1', 'a1', 'a2', 'b1', 'b1_plus', 'b1_bridge']

describe('curriculumLoader (v11.0 Real-Life Missions)', () => {
  it('loads all 14 validated lessons across all 4 modes and 6 stages', () => {
    const all = getCurriculum()
    expect(all.length).toBe(14)

    expect(getLessonsByMode('free_talk').length).toBeGreaterThan(0)
    expect(getLessonsByMode('roleplay').length).toBeGreaterThan(0)
    expect(getLessonsByMode('listen_reply').length).toBeGreaterThan(0)
    expect(getLessonsByMode('quick_fix').length).toBeGreaterThan(0)

    for (const stage of ALL_STAGES) {
      expect(getLessonsByStage(stage).length).toBeGreaterThan(0)
    }

    const bestFriend = getLessonById('ft_best_friend')
    expect(bestFriend?.alwaysUnlocked).toBe(true)
  })

  it('provides 3 Turn-1 stuck chips for every lesson and 3 objectives for all 10 missions', () => {
    const all = getCurriculum()
    const missionLessons = all.filter((l) => !l.isWarmup && l.id !== 'ft_best_friend')
    expect(missionLessons.length).toBe(10)

    for (const lesson of all) {
      expect(lesson.initialStuckChips.length).toBe(3)
    }
    for (const mission of missionLessons) {
      expect(mission.missionObjectives.length).toBe(3)
    }
  })

  it('rotates 3 daily 60-second warm-ups deterministically and builds custom talk rooms', () => {
    const warmups = getWarmupLessons()
    expect(warmups.length).toBe(3)

    const w1 = getDailyWarmup(new Date('2026-11-23T10:00:00'))
    const w2 = getDailyWarmup(new Date('2026-11-23T22:00:00'))
    expect(w1.id).toBe(w2.id)
    expect(w1.isWarmup).toBe(true)

    const custom = createCustomTalkLesson('বন্ধুর সাথে ক্রিকেট নিয়ে আড্ডা')
    expect(custom.title).toContain('বন্ধুর সাথে ক্রিকেট')
    expect(custom.alwaysUnlocked).toBe(true)
    expect(custom.initialStuckChips.length).toBe(3)

    const fallback = createCustomTalkLesson('   ')
    expect(fallback.title.length).toBeGreaterThan(0)
  })
})
