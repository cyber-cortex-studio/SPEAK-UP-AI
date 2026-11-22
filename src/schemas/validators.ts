import { z } from 'zod'

export const CorrectionSchema = z.object({
  learnerSaid: z.string(),
  betterWay: z.string(),
  shortNoteBn: z.string(),
})

export const WordMeaningSchema = z.object({
  word: z.string().min(1),
  meaningBn: z.string().min(1),
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

export const CoachTurnResponseSchema = z.object({
  learnerTranscript: z.string(),
  reply: z.string().min(1),
  correction: CorrectionSchema.optional(),
  sayItBetter: z.string().optional(),
  bengaliHint: z.string().optional(),
  pronunciationNote: z.string().optional(),
  wordMeanings: z.array(WordMeaningSchema).default([]),
  evidenceProposal: EvidenceProposalSchema,
})

export type CoachTurnResponse = z.infer<typeof CoachTurnResponseSchema>
