import Dexie, { type EntityTable } from 'dexie'
import type { TargetSkill } from '../schemas/contentSchemas'

export interface DailyStat {
  date: string // YYYY-MM-DD
  speakingSeconds: number
  turnsCount: number
}

export interface MistakeCard {
  id?: number
  createdAt: number
  lessonId: string
  learnerSaid: string
  betterWay: string
  shortNoteBn: string
  mastered: boolean
}

export interface SavedPhrase {
  id?: number
  createdAt: number
  phrase: string
  noteBn: string
}

export interface SkillEvidence {
  id?: number
  createdAt: number
  lessonId: string
  skill: TargetSkill
  outcome: 'demonstrated' | 'developing' | 'needs_support'
  confidence: 'high' | 'medium' | 'low'
}

class SpeakUpDatabase extends Dexie {
  dailyStats!: EntityTable<DailyStat, 'date'>
  mistakeCards!: EntityTable<MistakeCard, 'id'>
  savedPhrases!: EntityTable<SavedPhrase, 'id'>
  skillEvidence!: EntityTable<SkillEvidence, 'id'>

  constructor() {
    super('SpeakUpAI_V1_DB')
    this.version(1).stores({
      dailyStats: 'date',
      mistakeCards: '++id, createdAt, lessonId, mastered',
      savedPhrases: '++id, createdAt',
      skillEvidence: '++id, createdAt, skill, outcome',
    })
  }
}

export const db = new SpeakUpDatabase()

export function getLocalDateKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface RecordTurnInput {
  lessonId: string
  speakingSeconds: number
  skill: TargetSkill
  outcome: 'demonstrated' | 'developing' | 'needs_support'
  confidence: 'high' | 'medium' | 'low'
  correction?: {
    learnerSaid: string
    betterWay: string
    shortNoteBn: string
  }
}

export async function recordCompletedTurn(input: RecordTurnInput): Promise<void> {
  const today = getLocalDateKey()
  const now = Date.now()

  await db.transaction('rw', [db.dailyStats, db.skillEvidence, db.mistakeCards], async () => {
    const existing = await db.dailyStats.get(today)
    if (existing) {
      await db.dailyStats.update(today, {
        speakingSeconds: existing.speakingSeconds + Math.max(0, input.speakingSeconds),
        turnsCount: existing.turnsCount + 1,
      })
    } else {
      await db.dailyStats.add({
        date: today,
        speakingSeconds: Math.max(0, input.speakingSeconds),
        turnsCount: 1,
      })
    }

    await db.skillEvidence.add({
      createdAt: now,
      lessonId: input.lessonId,
      skill: input.skill,
      outcome: input.outcome,
      confidence: input.confidence,
    })

    if (input.correction && input.correction.betterWay.trim().length > 0) {
      await db.mistakeCards.add({
        createdAt: now,
        lessonId: input.lessonId,
        learnerSaid: input.correction.learnerSaid,
        betterWay: input.correction.betterWay,
        shortNoteBn: input.correction.shortNoteBn,
        mastered: false,
      })
    }
  })
}

export async function addSavedPhrase(phrase: string, noteBn = ''): Promise<void> {
  const trimmed = phrase.trim()
  if (!trimmed) {
    return
  }
  await db.savedPhrases.add({
    createdAt: Date.now(),
    phrase: trimmed,
    noteBn: noteBn.trim(),
  })
}

export async function toggleMistakeMastered(id: number, mastered: boolean): Promise<void> {
  await db.mistakeCards.update(id, { mastered })
}

export async function deleteMistakeCard(id: number): Promise<void> {
  await db.mistakeCards.delete(id)
}

export async function deleteSavedPhrase(id: number): Promise<void> {
  await db.savedPhrases.delete(id)
}

export async function clearAllLearningData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.dailyStats, db.mistakeCards, db.savedPhrases, db.skillEvidence],
    async () => {
      await db.dailyStats.clear()
      await db.mistakeCards.clear()
      await db.savedPhrases.clear()
      await db.skillEvidence.clear()
    },
  )
}
