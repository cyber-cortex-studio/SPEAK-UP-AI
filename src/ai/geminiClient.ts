import { GEMINI_COACH_MODEL, getGenerateContentUrl } from './geminiConfig'
import { getApiKey } from './keyVault'
import { CoachTurnResponseSchema, type CoachTurnResponse } from '../schemas/validators'

export type GeminiErrorCode =
  | 'missing_key'
  | 'invalid_key'
  | 'rate_limited_rpm'
  | 'rate_limited_rpd'
  | 'bad_request'
  | 'finish_reason_blocked'
  | 'invalid_json'
  | 'timeout'
  | 'aborted'
  | 'network_error'

export class GeminiClientError extends Error {
  readonly code: GeminiErrorCode
  readonly retryAfterSeconds?: number

  constructor(code: GeminiErrorCode, message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'GeminiClientError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export interface HistoryTurn {
  role: 'user' | 'model'
  text: string
}

export interface CoachTurnRequest {
  systemInstruction: string
  history: HistoryTurn[]
  userText?: string
  userAudio?: {
    base64: string
    mimeType: string
  }
  signal?: AbortSignal
}

interface GeminiRawResponse {
  candidates?: Array<{
    finishReason?: string
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

const REQUEST_TIMEOUT_MS = 25_000
const MAX_HISTORY_TURNS = 8
let consecutive429Count = 0

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
  }
  return trimmed
}

function buildRequestBody(req: CoachTurnRequest): Record<string, unknown> {
  const recentHistory = req.history.slice(-MAX_HISTORY_TURNS)
  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> =
    recentHistory.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }))

  const currentParts: Array<Record<string, unknown>> = []
  if (req.userAudio) {
    currentParts.push({
      inlineData: {
        mimeType: req.userAudio.mimeType,
        data: req.userAudio.base64,
      },
    })
  }
  if (req.userText && req.userText.trim().length > 0) {
    currentParts.push({ text: req.userText.trim() })
  }
  if (currentParts.length === 0) {
    throw new GeminiClientError('bad_request', 'Turn must include audio or text')
  }

  contents.push({ role: 'user', parts: currentParts })

  return {
    systemInstruction: {
      parts: [{ text: req.systemInstruction }],
    },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
    },
  }
}

async function fetchWithTimeout(
  url: string,
  apiKey: string,
  body: string,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS)

  const onExternalAbort = () => controller.abort('external')
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timeoutId)
      throw new GeminiClientError('aborted', 'Request was aborted')
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body,
      signal: controller.signal,
    })
  } catch (err: unknown) {
    if (controller.signal.aborted) {
      if (controller.signal.reason === 'timeout') {
        throw new GeminiClientError('timeout', 'Gemini request timed out')
      }
      throw new GeminiClientError('aborted', 'Request was aborted')
    }
    throw new GeminiClientError(
      'network_error',
      err instanceof Error ? err.message : 'Network error',
    )
  } finally {
    window.clearTimeout(timeoutId)
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort)
    }
  }
}

export async function sendCoachTurn(req: CoachTurnRequest): Promise<CoachTurnResponse> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new GeminiClientError('missing_key', 'Gemini API key is not configured')
  }

  const url = getGenerateContentUrl(GEMINI_COACH_MODEL)
  const serializedBody = JSON.stringify(buildRequestBody(req))

  let response: Response | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetchWithTimeout(url, apiKey, serializedBody, req.signal)
      break
    } catch (err: unknown) {
      if (err instanceof GeminiClientError && err.code === 'network_error' && attempt === 0) {
        continue
      }
      throw err
    }
  }

  if (!response) {
    throw new GeminiClientError('network_error', 'No response received')
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GeminiClientError('invalid_key', 'Invalid or unauthorized Gemini API key')
    }
    if (response.status === 429) {
      consecutive429Count += 1
      if (consecutive429Count >= 2) {
        throw new GeminiClientError('rate_limited_rpd', 'Daily free-tier quota may be exhausted')
      }
      throw new GeminiClientError('rate_limited_rpm', 'Rate limit hit, wait before retrying', 45)
    }
    if (response.status === 400) {
      throw new GeminiClientError('bad_request', 'Invalid request sent to Gemini')
    }
    throw new GeminiClientError('network_error', `Gemini HTTP error: ${response.status}`)
  }

  consecutive429Count = 0

  const rawJson = (await response.json()) as GeminiRawResponse
  const candidate = rawJson.candidates?.[0]
  const finishReason = candidate?.finishReason

  // Runtime Safety #3: Always verify finishReason before parsing JSON
  if (!finishReason || finishReason !== 'STOP') {
    throw new GeminiClientError(
      'finish_reason_blocked',
      `Response did not complete cleanly (finishReason: ${finishReason ?? 'UNKNOWN'})`,
    )
  }

  const rawText = candidate?.content?.parts?.[0]?.text
  if (!rawText) {
    throw new GeminiClientError('invalid_json', 'Empty response text from Gemini')
  }

  let parsedUnknown: unknown
  try {
    parsedUnknown = JSON.parse(stripMarkdownFences(rawText))
  } catch {
    throw new GeminiClientError('invalid_json', 'Failed to parse JSON from Gemini response')
  }

  const validated = CoachTurnResponseSchema.safeParse(parsedUnknown)
  if (!validated.success) {
    throw new GeminiClientError('invalid_json', 'Gemini response failed Zod schema validation')
  }

  return validated.data
}
