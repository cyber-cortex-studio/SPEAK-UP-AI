import { describe, expect, it } from 'vitest'
import type { LessonItem } from '../schemas/contentSchemas'
import { buildCoachSystemPrompt } from './promptBuilder'

const SAMPLE_LESSON: LessonItem = {
  id: 'm1',
  title: 'Return Broken Headphones',
  stage: 'a1',
  mode: 'roleplay',
  coachRole: 'Strict electronics shopkeeper',
  targetSkill: 'speaking',
  starterPrompt: 'Yes? How can I help you?',
  starterPromptBn: 'হ্যাঁ, বলুন কী সাহায্য করতে পারি?',
} as LessonItem

describe('buildCoachSystemPrompt (v11.0)', () => {
  it('stays backward compatible with 2 arguments and includes v11.0 JSON fields', () => {
    const prompt = buildCoachSystemPrompt(SAMPLE_LESSON, 'high')
    expect(prompt).toContain('Return Broken Headphones')
    expect(prompt).toContain('Ask-Anything Rule')
    expect(prompt).toContain('"stuckChips"')
    expect(prompt).toContain('"repeatTarget"')
    expect(prompt).toContain('"audioXRay"')
    expect(prompt).toContain('"bengaliBridgeUsed"')
    expect(prompt).toContain('"completedObjectiveIds"')
  })

  it('injects mission objectives with DONE/PENDING status and limits mistake memory to 2', () => {
    const prompt = buildCoachSystemPrompt(SAMPLE_LESSON, 'medium', {
      missionObjectives: [
        { id: 'obj_1', label: 'Explain the headphone problem' },
        { id: 'obj_2', label: 'Ask politely for a refund' },
      ],
      completedObjectiveIds: ['obj_1'],
      recentMistakes: [
        { learnerSaid: 'Yesterday I go shop', betterWay: 'Yesterday I went to the shop.' },
        { learnerSaid: 'It not working', betterWay: 'It is not working.' },
        { learnerSaid: 'Third mistake ignored', betterWay: 'Should not be included.' },
      ],
      isWarmup: true,
    })

    expect(prompt).toContain('[DONE] id="obj_1"')
    expect(prompt).toContain('[PENDING] id="obj_2"')
    expect(prompt).toContain('Yesterday I went to the shop.')
    expect(prompt).toContain('It is not working.')
    expect(prompt).not.toContain('Should not be included.')
    expect(prompt).toContain('60-Second Warm-up Mode')
  })

  it('injects custom learner topic cleanly when provided', () => {
    const prompt = buildCoachSystemPrompt(SAMPLE_LESSON, 'high', {
      customTopic: '  বন্ধুর সাথে ক্রিকেট নিয়ে আড্ডা  ',
    })
    expect(prompt).toContain('Custom Learner Topic / Scenario: "বন্ধুর সাথে ক্রিকেট নিয়ে আড্ডা".')
  })
})
