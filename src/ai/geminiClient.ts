import { GEMINI_API_BASE, GEMINI_COACH_MODEL, getGenerateContentUrl } from './geminiConfig'
import {
  getGeminiApiKey,
  getGroqApiKey,
  getProviderPreference,
} from './keyVault'
import { __resetGroqCacheForTests, GroqClientError, sendGroqCoachTurn } from './groqClient'
import { recordQuotaUsage, triggerQuotaCooldown } from './quotaTracker'
import { parseCoachModelOutput } from './responseParser'
import type { CoachTurnResponse } from '../schemas/validators'

export type GeminiErrorCode =
  | 'missing_key'
  | 'invalid_key'
  | 'rate_limited_rpm'
  | 'rate_limited_rpd'
  | 'server_busy'
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

interface GeminiModelsListResponse {
  models?: Array<{
    name?: string
    supportedGenerationMethods?: string[]
  }>
}

interface GeminiErrorBody {
  error?: {
    message?: string
  }
}

const PRIMARY_TIMEOUT_MS = 12_000
const FALLBACK_TIMEOUT_MS = 7_000
const MAX_HISTORY_TURNS = 8
const DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000
const MODEL_COOLDOWN_MS = 90_000
const TEXT_MODEL_STORAGE_KEY = 'speakup_active_text_model_v4'
const AUDIO_MODEL_STORAGE_KEY = 'speakup_active_audio_model_v4'

const NON_CHAT_MODEL_KEYWORDS = [
  'embedding',
  'tts',
  'image',
  'imagen',
  'veo',
  'robotics',
  'computer-use',
  'native-audio',
  'live',
  'aqa',
  'customtools',
  'deep-research',
  'nano-banana',
  'bison',
  'gecko',
]

let consecutive429Count = 0
let cachedTextModel: string | null = null
let cachedAudioModel: string | null = null
let cachedAllModels: { models: string[]; fetchedAt: number } | null = null
const cooledDownGeminiModels = new Map<string, number>()

export function __resetModelCacheForTests(): void {
  consecutive429Count = 0
  cachedTextModel = null
  cachedAudioModel = null
  cachedAllModels = null
  cooledDownGeminiModels.clear()
  __resetGroqCacheForTests()
}

function isGemmaModel(modelId: string): boolean {
  return modelId.toLowerCase().startsWith('gemma-')
}

function isModelCooledDown(modelId: string): boolean {
  const until = cooledDownGeminiModels.get(modelId)
  if (!until) return false
  if (Date.now() >= until) {
    cooledDownGeminiModels.delete(modelId)
    return false
  }
  return true
}

function markModelCooledDown(modelId: string): void {
  cooledDownGeminiModels.set(modelId, Date.now() + MODEL_COOLDOWN_MS)
}

function getStorageKey(hasAudio: boolean): string {
  return hasAudio ? AUDIO_MODEL_STORAGE_KEY : TEXT_MODEL_STORAGE_KEY
}

function getSavedGeminiModel(hasAudio: boolean): string | null {
  const inMemory = hasAudio ? cachedAudioModel : cachedTextModel
  if (inMemory) {
    return inMemory
  }
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(getStorageKey(hasAudio))
      if (saved && saved.trim().length > 0) {
        const trimmed = saved.trim()
        if (!hasAudio || !isGemmaModel(trimmed)) {
          if (hasAudio) cachedAudioModel = trimmed
          else cachedTextModel = trimmed
          return trimmed
        }
      }
    } catch {
      // Ignore storage restriction
    }
  }
  return null
}

function saveActiveModel(model: string, hasAudio: boolean): void {
  if (hasAudio) cachedAudioModel = model
  else cachedTextModel = model

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(getStorageKey(hasAudio), model)
    } catch {
      // Ignore storage restriction
    }
  }
}

function clearActiveModel(hasAudio: boolean): void {
  if (hasAudio) cachedAudioModel = null
  else cachedTextModel = null

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(getStorageKey(hasAudio))
    } catch {
      // Ignore storage restriction
    }
  }
}

function scoreModelCandidate(modelId: string): number {
  const lower = modelId.toLowerCase()

  if (lower === 'gemini-2.5-flash-lite') return 1000
  if (lower === 'gemini-2.0-flash-lite') return 985
  if (lower === 'gemini-2.0-flash') return 970
  if (lower === 'gemini-2.5-flash') return 955
  if (lower === 'gemini-flash-lite-latest') return 940
  if (lower === 'gemini-flash-latest') return 925

  if (lower.startsWith('gemini-') && lower.includes('flash')) {
    const isPreview = lower.includes('preview') || lower.includes('exp') || lower.includes('thinking')
    if (!isPreview) return lower.includes('lite') ? 915 : 900
    return lower.includes('lite') ? 850 : 835
  }

  if (lower.startsWith('gemma-')) {
    if (lower.includes('27b')) return 890
    if (lower.includes('12b')) return 880
    if (lower.includes('9b') || lower.includes('4b')) return 865
    return 840
  }

  if (lower.startsWith('gemini-')) {
    return 780
  }

  return 650
}

function isServerBusyStatus(status: number): boolean {
  return status === 500 || status === 502 || status === 503 || status === 504
}

async function discoverAllGeminiModels(
  apiKey: string,
  hasAudio: boolean,
  signal?: AbortSignal,
): Promise<string[]> {
  const now = Date.now()
  let allCandidates: string[]

  if (cachedAllModels && now - cachedAllModels.fetchedAt < DISCOVERY_CACHE_TTL_MS) {
    allCandidates = cachedAllModels.models
  } else {
    const listUrl = `${GEMINI_API_BASE}?pageSize=100`
    const res = await fetchWithTimeout(listUrl, apiKey, undefined, FALLBACK_TIMEOUT_MS, signal)
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new GeminiClientError('invalid_key', 'Invalid or unauthorized Gemini API key')
      }
      return [GEMINI_COACH_MODEL]
    }

    const data = (await res.json()) as GeminiModelsListResponse
    const models = data.models ?? []

    allCandidates = models
      .filter(
        (m) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent'),
      )
      .map((m) => (m.name ?? '').replace(/^models\//, '').trim())
      .filter((id) => {
        if (!id) return false
        const lower = id.toLowerCase()
        return !NON_CHAT_MODEL_KEYWORDS.some((kw) => lower.includes(kw))
      })

    allCandidates.sort((a, b) => scoreModelCandidate(b) - scoreModelCandidate(a))
    if (allCandidates.length === 0) {
      allCandidates = [GEMINI_COACH_MODEL]
    }
    cachedAllModels = { models: allCandidates, fetchedAt: now }
  }

  return allCandidates.filter((id) => !(hasAudio && isGemmaModel(id)))
}

function buildRequestBody(
  req: CoachTurnRequest,
  compatMode: boolean,
  model: string,
): Record<string, unknown> {
  const recentHistory = req.history.slice(-MAX_HISTORY_TURNS)
  const rawContents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> =
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

  rawContents.push({ role: 'user', parts: currentParts })

  if (rawContents.length > 0 && rawContents[0]?.role === 'model') {
    rawContents.unshift({ role: 'user', parts: [{ text: 'Start the conversation.' }] })
  }

  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = []
  for (const turn of rawContents) {
    const prev = contents[contents.length - 1]
    if (prev && prev.role === turn.role) {
      prev.parts.push(...turn.parts)
    } else {
      contents.push({ role: turn.role, parts: [...turn.parts] })
    }
  }

  if (compatMode) {
    const firstTurn = contents[0]
    if (firstTurn) {
      firstTurn.parts.unshift({
        text: `[COACH INSTRUCTIONS]\n${req.systemInstruction}\n\nIMPORTANT: Reply with ONLY a valid JSON object matching the schema above.\n[END INSTRUCTIONS]\n`,
      })
    }
    return {
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 500,
      },
    }
  }

  return {
    systemInstruction: {
      parts: [{ text: req.systemInstruction }],
    },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      maxOutputTokens: 500,
      ...(model.toLowerCase().includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  }
}

async function fetchWithTimeout(
  url: string,
  apiKey: string,
  body?: string,
  timeoutMs = PRIMARY_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort('timeout'), timeoutMs)

  const onExternalAbort = () => controller.abort('external')
  if (externalSignal) {
    if (externalSignal.aborted) {
      globalThis.clearTimeout(timeoutId)
      throw new GeminiClientError('aborted', 'Request was aborted')
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const isPost = body !== undefined
    return await fetch(url, {
      method: isPost ? 'POST' : 'GET',
      headers: isPost
        ? {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          }
        : {
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
    globalThis.clearTimeout(timeoutId)
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort)
    }
  }
}

async function postToGeminiModel(
  model: string,
  apiKey: string,
  req: CoachTurnRequest,
  compatMode: boolean,
  timeoutMs: number,
): Promise<Response> {
  const url = getGenerateContentUrl(model)
  const serializedBody = JSON.stringify(buildRequestBody(req, compatMode, model))
  return fetchWithTimeout(url, apiKey, serializedBody, timeoutMs, req.signal)
}

async function readApiErrorDetail(response: Response): Promise<string> {
  try {
    const errJson = (await response.json()) as GeminiErrorBody
    if (errJson.error?.message) {
      return errJson.error.message
    }
  } catch {
    // Ignore parse failure
  }
  return `Gemini HTTP error: ${response.status}`
}

async function sendGeminiCoachTurn(
  apiKey: string,
  req: CoachTurnRequest,
): Promise<CoachTurnResponse> {
  const hasAudio = Boolean(req.userAudio)
  const discovered = await discoverAllGeminiModels(apiKey, hasAudio, req.signal)

  const savedModel = getSavedGeminiModel(hasAudio)
  const orderedModels: string[] = []
  const seen = new Set<string>()

  if (savedModel && !isModelCooledDown(savedModel)) {
    orderedModels.push(savedModel)
    seen.add(savedModel)
  }
  for (const m of discovered) {
    if (!seen.has(m) && !isModelCooledDown(m)) {
      orderedModels.push(m)
      seen.add(m)
    }
  }
  for (const m of discovered) {
    if (!seen.has(m)) {
      orderedModels.push(m)
      seen.add(m)
    }
  }

  let sawServerBusy = false
  let sawRateLimit = false
  let lastErrorDetail = 'No available Gemini model accepted the request'

  for (let i = 0; i < orderedModels.length; i++) {
    const model = orderedModels[i]
    if (!model) continue
    const timeoutMs = i === 0 ? PRIMARY_TIMEOUT_MS : FALLBACK_TIMEOUT_MS
    const defaultCompat = isGemmaModel(model)

    let response: Response
    try {
      response = await postToGeminiModel(model, apiKey, req, defaultCompat, timeoutMs)
    } catch (err: unknown) {
      if (err instanceof GeminiClientError && err.code === 'timeout') {
        sawServerBusy = true
        markModelCooledDown(model)
        continue
      }
      throw err
    }

    if (response.status === 400 && !defaultCompat) {
      try {
        response = await postToGeminiModel(model, apiKey, req, true, timeoutMs)
      } catch (err: unknown) {
        if (err instanceof GeminiClientError && err.code === 'timeout') {
          sawServerBusy = true
          markModelCooledDown(model)
          continue
        }
        throw err
      }
    }

    if (response.ok) {
      const rawJson = (await response.json()) as GeminiRawResponse
      const candidate = rawJson.candidates?.[0]
      const finishReason = candidate?.finishReason
      const rawText = candidate?.content?.parts?.[0]?.text ?? ''

      if (
        (finishReason === 'STOP' || finishReason === 'MAX_TOKENS') &&
        rawText.trim().length > 0
      ) {
        const parsed = parseCoachModelOutput(rawText, req.userText?.trim() ?? '')
        if (parsed) {
          saveActiveModel(model, hasAudio)
          consecutive429Count = 0
          recordQuotaUsage('coach')
          return parsed
        }
      }
      lastErrorDetail = 'Model returned an incomplete response'
      continue
    }

    if (response.status === 401 || response.status === 403) {
      clearActiveModel(hasAudio)
      throw new GeminiClientError('invalid_key', 'Invalid or unauthorized Gemini API key')
    }

    lastErrorDetail = await readApiErrorDetail(response)
    if (isServerBusyStatus(response.status)) {
      sawServerBusy = true
      markModelCooledDown(model)
      clearActiveModel(hasAudio)
      continue
    }
    if (response.status === 429) {
      sawRateLimit = true
      markModelCooledDown(model)
      clearActiveModel(hasAudio)
      continue
    }

    clearActiveModel(hasAudio)
  }

  if (sawRateLimit && !sawServerBusy) {
    consecutive429Count += 1
    if (consecutive429Count >= 2) {
      throw new GeminiClientError('rate_limited_rpd', 'Daily free-tier quota may be exhausted')
    }
    triggerQuotaCooldown('coach', 45)
    throw new GeminiClientError('rate_limited_rpm', 'Rate limit hit, wait before retrying', 45)
  }
  if (sawServerBusy) {
    throw new GeminiClientError(
      'server_busy',
      'AI servers are temporarily busy. Please try again in a few seconds.',
    )
  }
  throw new GeminiClientError('network_error', lastErrorDetail)
}

function mapGroqError(err: GroqClientError): GeminiClientError {
  if (err.kind === 'invalid_key') {
    return new GeminiClientError('invalid_key', err.message)
  }
  if (err.kind === 'rate_limited') {
    triggerQuotaCooldown('coach', 30)
    return new GeminiClientError('rate_limited_rpm', err.message, 30)
  }
  if (err.kind === 'server_busy') {
    return new GeminiClientError('server_busy', err.message)
  }
  if (err.kind === 'timeout') {
    return new GeminiClientError('timeout', err.message)
  }
  if (err.kind === 'aborted') {
    return new GeminiClientError('aborted', err.message)
  }
  if (err.kind === 'bad_request') {
    return new GeminiClientError('bad_request', err.message)
  }
  return new GeminiClientError('network_error', err.message)
}

export async function sendCoachTurn(req: CoachTurnRequest): Promise<CoachTurnResponse> {
  const groqKey = getGroqApiKey()
  const geminiKey = getGeminiApiKey()
  const pref = getProviderPreference()

  const providerOrder: Array<'groq' | 'gemini'> = []
  if (pref === 'groq') {
    if (groqKey) providerOrder.push('groq')
  } else if (pref === 'gemini') {
    if (geminiKey) providerOrder.push('gemini')
  } else {
    if (groqKey) providerOrder.push('groq')
    if (geminiKey) providerOrder.push('gemini')
  }

  if (providerOrder.length === 0) {
    throw new GeminiClientError(
      'missing_key',
      'No API key configured for the selected AI provider',
    )
  }

  let lastError: GeminiClientError | null = null

  for (const provider of providerOrder) {
    try {
      if (provider === 'groq' && groqKey) {
        return await sendGroqCoachTurn(groqKey, req)
      }
      if (provider === 'gemini' && geminiKey) {
        return await sendGeminiCoachTurn(geminiKey, req)
      }
    } catch (err: unknown) {
      if (err instanceof GeminiClientError) {
        if (err.code === 'aborted') throw err
        lastError = err
        continue
      }
      if (err instanceof GroqClientError) {
        if (err.kind === 'aborted') throw mapGroqError(err)
        lastError = mapGroqError(err)
        continue
      }
      lastError = new GeminiClientError(
        'network_error',
        err instanceof Error ? err.message : 'Unknown error',
      )
    }
  }

  throw lastError ?? new GeminiClientError('network_error', 'Could not reach AI Coach')
}
