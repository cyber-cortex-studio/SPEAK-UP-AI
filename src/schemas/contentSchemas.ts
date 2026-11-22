import { z } from 'zod'

export const StageIdSchema = z.enum(['pre_a1', 'a1', 'a2', 'b1'])
export type StageId = z.infer<typeof StageIdSchema>

export const PracticeModeSchema = z.enum([
  'free_talk',
  'roleplay',
  'listen_reply',
  'quick_fix',
])
export type PracticeMode = z.infer<typeof PracticeModeSchema>

export const TargetSkillSchema = z.enum([
  'speaking',
  'listening',
  'sentence',
  'vocabulary',
  'grammar',
  'repair',
  'pronunciation',
])
export type TargetSkill = z.infer<typeof TargetSkillSchema>

export const LessonItemSchema = z.object({
  id: z.string().min(1),
  stage: StageIdSchema,
  mode: PracticeModeSchema,
  title: z.string().min(1),
  titleBn: z.string().min(1),
  description: z.string().min(1),
  starterPrompt: z.string().min(1),
  starterPromptBn: z.string().min(1),
  coachRole: z.string().min(1),
  targetSkill: TargetSkillSchema,
})

export const CurriculumSchema = z.array(LessonItemSchema).min(1)

export type LessonItem = z.infer<typeof LessonItemSchema>
