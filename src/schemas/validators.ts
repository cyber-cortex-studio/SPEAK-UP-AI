import { z } from 'zod'

interface SafeParseable<T> {
  safeParse: (input: unknown) => { success: true; data: T } | { success: false }
}

function parseValidItems<T>(
  items: unknown[],
  schema: SafeParseable<T>,
  limit: number,
): T[] {
  const valid: T[] = []
  for (const item of items) {
    const parsed = schema.safeParse(item)
    if (parsed.success) {
      valid.push(parsed.data)
      if (valid.length >= limit) break
    }
  }
  return valid
}

const optionalTrimmedString = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
  })
  .catch(undefined)

const clampedScoreSchema = z
  .number()
  .transform((n) => (Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 65))
  .catch(65)

export const CorrectionSchema = z.object({
  learnerSaid: z.string().catch(''),
  betterWay: z.string().trim().min(1),
  shortNoteBn: z.string().catch(''),
})

export const WordMeaningSchema = z.object({
  word: z.string().trim().min(1),
  meaningBn: z.string().trim().min(1),
})

export const StuckChipSchema = z.object({
  level: z.enum(['easy', 'natural', 'smart']).catch('natural'),
  english: z.string().trim().min(1),
  bangla: z.string().trim().catch(''),
})

export const AudioXRaySchema = z.object({
  pronunciation: clampedScoreSchema,
  fluency: clampedScoreSchema,
  grammar: clampedScoreSchema,
  confidence: clampedScoreSchema,
  bengaliPhoneticTip: optionalTrimmedString,
})

export const EvidenceProposalSchema = z.object({
  skill: z.enum([
    'speaking',
    'listening',
    'sentence',
    'vocabulary',
    'grammar',
    'repair',
    'pronunciation',
  ]),
  outcome: z.enum(['demonstrated', 'developing', 'needs_support']),
  confidence: z.enum(['high', 'medium', 'low']),
})

const DEFAULT_EVIDENCE: z.infer<typeof EvidenceProposalSchema> = {
  skill: 'speaking',
  outcome: 'developing',
  confidence: 'medium',
}

export const CoachTurnResponseSchema = z.object({
  learnerTranscript: z
    .string()
    .nullish()
    .transform((v) => v?.trim() ?? '')
    .catch(''),
  reply: z.string().trim().min(1),
  correction: CorrectionSchema.nullish()
    .transform((v) => v ?? undefined)
    .catch(undefined),
  sayItBetter: optionalTrimmedString,
  bengaliHint: optionalTrimmedString,
  pronunciationNote: optionalTrimmedString,
  wordMeanings: z
    .array(z.unknown())
    .nullish()
    .transform((arr) => (arr ? parseValidItems(arr, WordMeaningSchema, 6) : []))
    .catch([]),
  evidenceProposal: EvidenceProposalSchema.catch(DEFAULT_EVIDENCE),
  // v11.0 Coaching Engine fields (Single-Call Piggyback)
  repeatTarget: optionalTrimmedString,
  stuckChips: z
    .array(z.unknown())
    .nullish()
    .transform((arr) => (arr ? parseValidItems(arr, StuckChipSchema, 3) : []))
    .catch([]),
  completedObjectiveIds: z
    .array(z.unknown())
    .nullish()
    .transform((arr) =>
      arr
        ? arr
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            .map((id) => id.trim())
            .slice(0, 5)
        : [],
    )
    .catch([]),
  audioXRay: AudioXRaySchema.nullish()
    .transform((v) => v ?? undefined)
    .catch(undefined),
  bengaliBridgeUsed: z
    .boolean()
    .nullish()
    .transform((v) => Boolean(v))
    .catch(false),
})

export type StuckChip = z.infer<typeof StuckChipSchema>
export type AudioXRay = z.infer<typeof AudioXRaySchema>
export type CoachTurnResponse = z.infer<typeof CoachTurnResponseSchema>
