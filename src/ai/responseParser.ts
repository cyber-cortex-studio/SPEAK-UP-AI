import { CoachTurnResponseSchema, type CoachTurnResponse } from '../schemas/validators'

function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNulls).filter((item) => item !== null && item !== undefined)
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null && v !== undefined) {
        out[k] = stripNulls(v)
      }
    }
    return out
  }
  return value
}

export function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
  }
  return trimmed
}

function tryParseJsonFromText(raw: string): unknown | null {
  const cleaned = stripMarkdownFences(raw)
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function buildMinimalCoachResponse(
  reply: string,
  learnerTranscript = '',
  bengaliHint?: string,
  bengaliBridgeUsed = false,
): CoachTurnResponse {
  return {
    learnerTranscript,
    reply,
    correction: undefined,
    sayItBetter: undefined,
    bengaliHint,
    pronunciationNote: undefined,
    repeatTarget: undefined,
    audioXRay: undefined,
    bengaliBridgeUsed,
    wordMeanings: [],
    stuckChips: [],
    completedObjectiveIds: [],
    evidenceProposal: {
      skill: 'speaking',
      outcome: 'developing',
      confidence: 'medium',
    },
  }
}

export function parseCoachModelOutput(
  rawText: string,
  fallbackUserText: string,
): CoachTurnResponse | null {
  const parsedUnknown = tryParseJsonFromText(rawText)

  if (parsedUnknown !== null) {
    const cleaned = stripNulls(parsedUnknown)
    const validated = CoachTurnResponseSchema.safeParse(cleaned)
    if (validated.success) {
      if (!validated.data.learnerTranscript && fallbackUserText) {
        return {
          ...validated.data,
          learnerTranscript: fallbackUserText,
        }
      }
      return validated.data
    }

    if (cleaned && typeof cleaned === 'object') {
      const obj = cleaned as Record<string, unknown>
      if (typeof obj.reply === 'string' && obj.reply.trim().length > 0) {
        const transcript =
          typeof obj.learnerTranscript === 'string' && obj.learnerTranscript.trim().length > 0
            ? obj.learnerTranscript.trim()
            : fallbackUserText
        return buildMinimalCoachResponse(
          obj.reply.trim(),
          transcript,
          typeof obj.bengaliHint === 'string' ? obj.bengaliHint : undefined,
          Boolean(obj.bengaliBridgeUsed),
        )
      }
    }
  }

  // Plain-text safety net: if any model replies in plain English instead of JSON, still use it
  const plainReply = stripMarkdownFences(rawText).trim()
  if (plainReply.length > 0 && !plainReply.startsWith('{')) {
    return buildMinimalCoachResponse(plainReply, fallbackUserText)
  }

  return null
}
