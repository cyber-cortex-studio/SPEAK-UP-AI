import { z } from 'zod'

export const StageIdSchema = z.enum([
  'pre_a1',
  'a1',
  'a2',
  'b1',
  'b1_plus',
  'b1_bridge',
])
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

export const MissionObjectiveSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelBn: z.string().min(1),
})
export type MissionObjective = z.infer<typeof MissionObjectiveSchema>

export const InitialStuckChipSchema = z.object({
  level: z.enum(['easy', 'natural', 'smart']),
  english: z.string().min(1),
  bangla: z.string().min(1),
})
export type InitialStuckChip = z.infer<typeof InitialStuckChipSchema>

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
  missionObjectives: z.array(MissionObjectiveSchema).default([]),
  initialStuckChips: z.array(InitialStuckChipSchema).default([]),
  isWarmup: z.boolean().default(false),
  alwaysUnlocked: z.boolean().default(false),
  estimatedMinutes: z.number().int().min(1).max(30).default(5),
})

export const CurriculumSchema = z.array(LessonItemSchema).min(1)

export type LessonItem = z.infer<typeof LessonItemSchema>
