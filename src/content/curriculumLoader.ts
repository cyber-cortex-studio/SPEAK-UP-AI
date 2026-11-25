import rawCurriculum from './curriculum.json'
import {
  CurriculumSchema,
  type LessonItem,
  type PracticeMode,
  type StageId,
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

export function getLessonsByStage(stage: StageId): LessonItem[] {
  return getCurriculum().filter((item) => item.stage === stage)
}

export function getWarmupLessons(): LessonItem[] {
  return getCurriculum().filter((item) => item.isWarmup)
}

export function getDailyWarmup(date: Date = new Date()): LessonItem {
  const warmups = getWarmupLessons()
  const pool = warmups.length > 0 ? warmups : getCurriculum()
  const daySeed =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  const index = Math.abs(daySeed) % pool.length
  return pool[index] ?? pool[0]!
}

export function getLessonById(id: string): LessonItem | undefined {
  return getCurriculum().find((item) => item.id === id)
}

export function createCustomTalkLesson(rawTopic: string): LessonItem {
  const topic = rawTopic.trim() || 'Everyday conversation with a friend'
  return {
    id: `custom_${Date.now()}`,
    stage: 'a1',
    mode: 'free_talk',
    title: topic.length > 42 ? `${topic.slice(0, 42)}...` : topic,
    titleBn: 'নিজের টপিক (Custom Talk)',
    description: `Custom real-life conversation about: ${topic}`,
    starterPrompt: `Awesome! Let's talk about "${topic}". Start in English or Bengali — or ask me how to start this conversation!`,
    starterPromptBn: `দারুণ! চলো "${topic}" নিয়ে কথা বলি। ইংরেজি বা বাংলায় যা খুশি দিয়ে শুরু করো — অথবা জিজ্ঞাসা করো কীভাবে শুরু করবে!`,
    coachRole: `A warm, natural speaking partner roleplaying or chatting about "${topic}".`,
    targetSkill: 'speaking',
    missionObjectives: [],
    initialStuckChips: [
      {
        "level": "easy",
        "english": "Hi! Can you help me start this conversation?",
        "bangla": "হাই! এই কথাটা কীভাবে শুরু করব একটু সাহায্য করবে?"
      },
      {
        "level": "natural",
        "english": "Hey! Let's jump right in — you ask the first question.",
        "bangla": "হেই! চলো সরাসরি শুরু করি — তুমিই প্রথম প্রশ্নটা করো।"
      },
      {
        "level": "smart",
        "english": "I'm ready to practice this scenario naturally. Let's begin!",
        "bangla": "আমি এই পরিস্থিতিটা স্বাভাবিকভাবে প্র্যাকটিস করতে প্রস্তুত। চলো শুরু করি!"
      }
    ],
    isWarmup: false,
    alwaysUnlocked: true,
    estimatedMinutes: 5,
  }
}
