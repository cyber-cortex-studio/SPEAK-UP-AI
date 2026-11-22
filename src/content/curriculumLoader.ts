import rawCurriculum from './curriculum.json'
import {
  CurriculumSchema,
  type LessonItem,
  type PracticeMode,
} from '../schemas/contentSchemas'

let cachedLessons: LessonItem[] | null = null

export function getCurriculum(): LessonItem[] {
  if (cachedLessons) {
    return cachedLessons
  }
  const parsed = CurriculumSchema.safeParse(rawCurriculum)
  if (!parsed.success) {
    throw new Error('Invalid curriculum.json format')
  }
  cachedLessons = parsed.data
  return cachedLessons
}

export function getLessonsByMode(mode: PracticeMode): LessonItem[] {
  return getCurriculum().filter((item) => item.mode === mode)
}

export function getLessonById(id: string): LessonItem | undefined {
  return getCurriculum().find((item) => item.id === id)
}
