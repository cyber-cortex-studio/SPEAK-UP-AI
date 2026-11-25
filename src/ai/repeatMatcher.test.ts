import { describe, expect, it } from 'vitest'
import { evaluateRepeatMatch } from './repeatMatcher'

describe('evaluateRepeatMatch (0-quota Force-Repeat matcher)', () => {
  it('matches exact and punctuation-different sentences cleanly', () => {
    const res = evaluateRepeatMatch(
      'Yesterday, I went to the market.',
      'yesterday i went to the market',
    )
    expect(res.matched).toBe(true)
    expect(res.score).toBe(100)
  })

  it('handles English contractions naturally', () => {
    const res = evaluateRepeatMatch(
      "I'm studying computer science and I don't miss classes.",
      'I am studying computer science and I do not miss classes',
    )
    expect(res.matched).toBe(true)
    expect(res.score).toBe(100)
  })

  it('prevents repeated single-word gaming and rejects empty speech', () => {
    const gamed = evaluateRepeatMatch('Yesterday I went to the market', 'I I I I I I')
    expect(gamed.matched).toBe(false)
    expect(gamed.score).toBeLessThan(30)

    const empty = evaluateRepeatMatch('One cup of tea please', '   ')
    expect(empty.matched).toBe(false)
    expect(empty.score).toBe(0)
  })

  it('passes friendly 60%+ accent tolerance', () => {
    const res = evaluateRepeatMatch(
      'Could you please replace these headphones?',
      'Could you please replace headphones',
    )
    expect(res.matched).toBe(true)
    expect(res.score).toBeGreaterThanOrEqual(80)
  })
})
