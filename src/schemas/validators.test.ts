import { describe, expect, it } from 'vitest'
import { CoachTurnResponseSchema } from './validators'

describe('CoachTurnResponseSchema (v11.0)', () => {
  it('parses full v11.0 coaching payload cleanly', () => {
    const parsed = CoachTurnResponseSchema.parse({
      learnerTranscript: 'Yesterday I go to market',
      reply: 'Nice try! What did you buy at the market?',
      correction: {
        learnerSaid: 'Yesterday I go to market',
        betterWay: 'Yesterday I went to the market.',
        shortNoteBn: 'গতকালের কথা বোঝাতে go-এর জায়গায় went বসবে।',
      },
      repeatTarget: 'Yesterday I went to the market.',
      stuckChips: [
        { level: 'easy', english: 'I bought vegetables.', bangla: 'আমি সবজি কিনেছিলাম।' },
        { level: 'natural', english: 'I picked up some fresh fruit.', bangla: 'আমি কিছু তাজা ফল নিয়েছি।' },
        { level: 'smart', english: 'I just went for a few groceries.', bangla: 'আমি শুধু কিছু বাজার করতে গিয়েছিলাম।' },
      ],
      completedObjectiveIds: ['obj_1'],
      audioXRay: {
        pronunciation: 82,
        fluency: 74,
        grammar: 68,
        confidence: 79,
        bengaliPhoneticTip: 'Keep the "v" sound soft in vegetables.',
      },
      bengaliBridgeUsed: false,
      wordMeanings: [{ word: 'groceries', meaningBn: 'নিত্যপ্রয়োজনীয় বাজার' }],
      evidenceProposal: {
        skill: 'grammar',
        outcome: 'developing',
        confidence: 'high',
      },
    })

    expect(parsed.repeatTarget).toBe('Yesterday I went to the market.')
    expect(parsed.stuckChips).toHaveLength(3)
    expect(parsed.completedObjectiveIds).toEqual(['obj_1'])
    expect(parsed.audioXRay?.pronunciation).toBe(82)
  })

  it('recovers safely from Gemini nulls, out-of-range scores, and partial bad items', () => {
    const parsed = CoachTurnResponseSchema.parse({
      learnerTranscript: null,
      reply: 'Great job! Tell me more.',
      correction: null,
      repeatTarget: '   ',
      stuckChips: [
        { level: 'easy', english: 'Sure, I work in Kolkata.', bangla: 'অবশ্যই, আমি কলকাতায় কাজ করি।' },
        { level: 'bad', english: '', bangla: 'invalid' },
      ],
      audioXRay: {
        pronunciation: 145,
        fluency: -12,
        grammar: 77.6,
        confidence: 80,
        bengaliPhoneticTip: null,
      },
      evidenceProposal: { skill: 'invalid_skill' },
    })

    expect(parsed.learnerTranscript).toBe('')
    expect(parsed.correction).toBeUndefined()
    expect(parsed.repeatTarget).toBeUndefined()
    expect(parsed.stuckChips).toHaveLength(1)
    expect(parsed.audioXRay?.pronunciation).toBe(100)
    expect(parsed.audioXRay?.fluency).toBe(0)
    expect(parsed.audioXRay?.grammar).toBe(78)
    expect(parsed.evidenceProposal.skill).toBe('speaking')
  })

  it('rejects empty reply', () => {
    const result = CoachTurnResponseSchema.safeParse({ reply: '   ' })
    expect(result.success).toBe(false)
  })
})
