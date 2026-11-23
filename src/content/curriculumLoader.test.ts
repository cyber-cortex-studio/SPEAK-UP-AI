import { describe, expect, it } from 'vitest'
import { getCurriculum, getLessonById, getLessonsByMode } from './curriculumLoader'

describe('curriculumLoader', () => {
  it('loads valid curriculum lessons across all four practice modes', () => {
    const all = getCurriculum()
    expect(all.length).toBe(10)

    expect(getLessonsByMode('free_talk').length).toBeGreaterThan(0)
    expect(getLessonsByMode('roleplay').length).toBeGreaterThan(0)
    expect(getLessonsByMode('listen_reply').length).toBeGreaterThan(0)
    expect(getLessonsByMode('quick_fix').length).toBeGreaterThan(0)

    const sample = getLessonById('ft_daily_routine')
    expect(sample?.stage).toBe('pre_a1')
  })
})
