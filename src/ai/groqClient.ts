import type { CoachTurnResponse } from '../schemas/validators'
import { GROQ_API_BASE } from './keyVault'
import { recordQuotaUsage } from './quotaTracker'
import { parseCoachModelOutput } from './responseParser'

export interface GroqHistoryTurn {
  role: 'user' | 'model'
  text: string
}

export interface GroqCoachRequest {
  systemInstruction: string
  history: GroqHistoryTurn[]
  userText?: string
  userAudio?: {
    base64: string
    mimeType: string
  }
  signal?: AbortSignal
}

export type GroqFailureKind =
  | 'invalid_key'
  | 'rate_limited'
  | 'server_busy'
  | 'bad_request'
  | 'invalid_json'
  | 'timeout'
  | 'aborted'
  | 'network_error'

export class GroqClientError extends Error {
  readonly kind: GroqFailureKind

  constructor(kind: GroqFailureKind, message: string) {
    super(message)
    this.name = 'GroqClientError'
    this.kind = kind
  }
}

interface GroqModelsResponse {
  data?: Array<{
    id?: string
    active?: boolean
  }>
}

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

interface GroqErrorPayload {
  error?: {
    message?: string
    code?: string
  }
}

const REQUEST_TIMEOUT_MS = 12_000
const FALLBACK_TIMEOUT_MS = 8_000
const MAX_HISTORY_TURNS = 8
const DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000
const MODEL_COOLDOWN_MS = 90_000
const ACTIVE_GROQ_MODEL_KEY = 'speakup_active_groq_model_v1'

const NON_CHAT_GROQ_KEYWORDS = [
  'whisper',
  'tts',
  'playai',
  'orpheus',
  'guard',
  'safeguard',
  'prompt-guard',
  'embedding',
  'vision-preview',
  'compound',
]

let cachedGroqModel: string | null = null
let cachedGroqModelsList: { chat: string[]; whisper: string[]; fetchedAt: number } | null = null
const cooledDownGroqModels = new Map<string, number>()

export function __resetGroqCacheForTests(): void {
  cachedGroqModel = null
  cachedGroqModelsList = null
  cooledDownGroqModels.clear()
}

function isModelCooledDown(modelId: string): boolean {
  const until = cooledDownGroqModels.get(modelId)
  if (!until) return false
  if (Date.now() >= until) {
    cooledDownGroqModels.delete(modelId)
    return false
  }
  return true
}

function markModelCooledDown(modelId: string): void {
  cooledDownGroqModels.set(modelId, Date.now() + MODEL_COOLDOWN_MS)
}

function getSavedGroqModel(): string | null {
  if (cachedGroqModel) return cachedGroqModel
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(ACTIVE_GROQ_MODEL_KEY)
      if (saved && saved.trim().length > 0) {
        cachedGroqModel = saved.trim()
        return cachedGroqModel
      }
    } catch {
      // Ignore storage restriction
    }
  }
  return null
}

function saveGroqModel(modelId: string): void {
  cachedGroqModel = modelId
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ACTIVE_GROQ_MODEL_KEY, modelId)
    } catch {
      // Ignore storage restriction
    }
  }
}

function clearSavedGroqModel(): void {
  cachedGroqModel = null
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(ACTIVE_GROQ_MODEL_KEY)
    } catch {
      // Ignore storage restriction
    }
  }
}

function scoreGroqChatModel(modelId: string): number {
  const lower = modelId.toLowerCase()
  if (lower === 'llama-3.3-70b-versatile') return 1000
  if (lower === 'llama-3.1-8b-instant') return 980
  if (lower.includes('llama-4-scout') || lower.includes('llama-4-maverick')) return 960
  if (lower.includes('qwen') && !lower.includes('qwq')) return 940
  if (lower.includes('gpt-oss-20b')) return 930
  if (lower.includes('gpt-oss-120b')) return 920
  if (lower.includes('gemma')) return 900
  if (lower.includes('llama')) return 880
  return 750
}

function scoreGroqWhisperModel(modelId: string): number {
  const lower = modelId.toLowerCase()
  if (lower === 'whisper-large-v3-turbo') return 1000
  if (lower === 'whisper-large-v3') return 950
  return 800
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort('timeout'), timeoutMs)

  const onExternalAbort = () => controller.abort('external')
  if (externalSignal) {
    if (externalSignal.aborted) {
      globalThis.clearTimeout(timeoutId)
      throw new GroqClientError('aborted', 'Request was aborted')
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } catch (err: unknown) {
    if (controller.signal.aborted) {
      if (controller.signal.reason === 'timeout') {
        throw new GroqClientError('timeout', 'Groq request timed out')
      }
      throw new GroqClientError('aborted', 'Request was aborted')
    }
    throw new GroqClientError(
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

async function discoverGroqModels(
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ chat: string[]; whisper: string[] }> {
  const now = Date.now()
  if (cachedGroqModelsList && now - cachedGroqModelsList.fetchedAt < DISCOVERY_CACHE_TTL_MS) {
    return {
      chat: cachedGroqModelsList.chat,
      whisper: cachedGroqModelsList.whisper,
    }
  }

  const res = await fetchWithTimeout(
    `${GROQ_API_BASE}/models`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    FALLBACK_TIMEOUT_MS,
    signal,
  )

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new GroqClientError('invalid_key', 'Invalid or unauthorized Groq API key')
    }
    return {
      chat: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
      whisper: ['whisper-large-v3-turbo', 'whisper-large-v3'],
    }
  }

  const payload = (await res.json()) as GroqModelsResponse
  const rawModels = (payload.data ?? [])
    .filter((m) => m.active !== false && typeof m.id === 'string' && m.id.trim().length > 0)
    .map((m) => (m.id ?? '').trim())

  const whisper = rawModels
    .filter((id) => id.toLowerCase().includes('whisper'))
    .sort((a, b) => scoreGroqWhisperModel(b) - scoreGroqWhisperModel(a))

  const chat = rawModels
    .filter((id) => {
      const lower = id.toLowerCase()
      return !NON_CHAT_GROQ_KEYWORDS.some((kw) => lower.includes(kw))
    })
    .sort((a, b) => scoreGroqChatModel(b) - scoreGroqChatModel(a))

  const finalChat =
    chat.length > 0 ? chat : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
  const finalWhisper =
    whisper.length > 0 ? whisper : ['whisper-large-v3-turbo', 'whisper-large-v3']

  cachedGroqModelsList = {
    chat: finalChat,
    whisper: finalWhisper,
    fetchedAt: now,
  }

  return { chat: finalChat, whisper: finalWhisper }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType || 'audio/webm' })
}

function getAudioFilename(mimeType: string): string {
  const lower = mimeType.toLowerCase()
  if (lower.includes('mp4') || lower.includes('m4a')) return 'recording.m4a'
  if (lower.includes('ogg')) return 'recording.ogg'
  if (lower.includes('wav')) return 'recording.wav'
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'recording.mp3'
  return 'recording.webm'
}

async function transcribeWithGroqWhisper(
  apiKey: string,
  userAudio: { base64: string; mimeType: string },
  whisperModels: string[],
  signal?: AbortSignal,
): Promise<string> {
  const blob = base64ToBlob(userAudio.base64, userAudio.mimeType)
  const filename = getAudioFilename(userAudio.mimeType)
  let lastError: GroqClientError | null = null

  for (const model of whisperModels) {
    const form = new FormData()
    form.append('file', blob, filename)
    form.append('model', model)
    form.append('response_format', 'json')

    let res: Response
    try {
      res = await fetchWithTimeout(
        `${GROQ_API_BASE}/audio/transcriptions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: form,
        },
        REQUEST_TIMEOUT_MS,
        signal,
      )
    } catch (err: unknown) {
      if (err instanceof GroqClientError && err.kind === 'timeout') {
        lastError = err
        continue
      }
      throw err
    }

    if (res.ok) {
      const data = (await res.json()) as { text?: string }
      const text = (data.text ?? '').trim()
      if (text.length > 0) {
        return text
      }
      return '[Unclear audio]'
    }

    if (res.status === 401 || res.status === 403) {
      throw new GroqClientError('invalid_key', 'Invalid or unauthorized Groq API key')
    }
    if (res.status === 429) {
      lastError = new GroqClientError('rate_limited', 'Groq transcription rate limit reached')
      continue
    }
    if (res.status >= 500) {
      lastError = new GroqClientError('server_busy', `Groq transcription HTTP ${res.status}`)
      continue
    }
    lastError = new GroqClientError('bad_request', `Groq transcription HTTP ${res.status}`)
  }

  throw lastError ?? new GroqClientError('server_busy', 'Could not transcribe audio with Groq')
}

function buildGroqMessages(
  systemInstruction: string,
  history: GroqHistoryTurn[],
  userText: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `${systemInstruction}\n\nIMPORTANT: Always return a valid JSON object matching the required schema.`,
    },
  ]

  const recentHistory = history.slice(-MAX_HISTORY_TURNS)
  for (const turn of recentHistory) {
    messages.push({
      role: turn.role === 'model' ? 'assistant' : 'user',
      content: turn.text,
    })
  }

  messages.push({
    role: 'user',
    content: userText,
  })

  return messages
}

async function postGroqChat(
  apiKey: string,
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  useJsonMode: boolean,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.4,
    max_tokens: 550,
  }
  if (useJsonMode) {
    body.response_format = { type: 'json_object' }
  }

  return fetchWithTimeout(
    `${GROQ_API_BASE}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
    signal,
  )
}

async function readGroqErrorMessage(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as GroqErrorPayload
    if (payload.error?.message) {
      return payload.error.message
    }
  } catch {
    // Ignore parse failure
  }
  return `Groq HTTP error: ${res.status}`
}

export async function sendGroqCoachTurn(
  apiKey: string,
  req: GroqCoachRequest,
): Promise<CoachTurnResponse> {
  const discovered = await discoverGroqModels(apiKey, req.signal)

  let resolvedUserText = (req.userText ?? '').trim()
  if (req.userAudio) {
    const transcript = await transcribeWithGroqWhisper(
      apiKey,
      req.userAudio,
      discovered.whisper,
      req.signal,
    )
    resolvedUserText = resolvedUserText
      ? `${resolvedUserText}\n(Spoken audio transcript: ${transcript})`
      : transcript
  }

  if (!resolvedUserText) {
    throw new GroqClientError('bad_request', 'Turn must include audio or text')
  }

  const savedModel = getSavedGroqModel()
  const uniqueModels: string[] = []
  const seen = new Set<string>()

  if (savedModel && !isModelCooledDown(savedModel)) {
    uniqueModels.push(savedModel)
    seen.add(savedModel)
  }
  for (const m of discovered.chat) {
    if (!seen.has(m) && !isModelCooledDown(m)) {
      uniqueModels.push(m)
      seen.add(m)
    }
  }
  for (const m of discovered.chat) {
    if (!seen.has(m)) {
      uniqueModels.push(m)
      seen.add(m)
    }
  }

  const messages = buildGroqMessages(req.systemInstruction, req.history, resolvedUserText)

  let sawRateLimit = false
  let sawServerBusy = false
  let lastErrorDetail = 'No available Groq model accepted the request'

  for (let i = 0; i < uniqueModels.length; i++) {
    const model = uniqueModels[i]
    if (!model) continue
    const timeoutMs = i === 0 ? REQUEST_TIMEOUT_MS : FALLBACK_TIMEOUT_MS

    let res: Response
    try {
      res = await postGroqChat(apiKey, model, messages, true, timeoutMs, req.signal)
    } catch (err: unknown) {
      if (err instanceof GroqClientError && err.kind === 'timeout') {
        sawServerBusy = true
        markModelCooledDown(model)
        continue
      }
      throw err
    }

    // If strict json_object validation fails (400), retry the same fast model in plain mode
    if (res.status === 400) {
      try {
        res = await postGroqChat(apiKey, model, messages, false, timeoutMs, req.signal)
      } catch (err: unknown) {
        if (err instanceof GroqClientError && err.kind === 'timeout') {
          sawServerBusy = true
          markModelCooledDown(model)
          continue
        }
        throw err
      }
    }

    if (res.ok) {
      const data = (await res.json()) as GroqChatResponse
      const content = data.choices?.[0]?.message?.content?.trim() ?? ''
      const parsed = content ? parseCoachModelOutput(content, resolvedUserText) : null
      if (parsed) {
        saveGroqModel(model)
        recordQuotaUsage('coach')
        return parsed
      }
      lastErrorDetail = 'Empty or unparseable reply from Groq model'
      continue
    }

    if (res.status === 401 || res.status === 403) {
      clearSavedGroqModel()
      throw new GroqClientError('invalid_key', 'Invalid or unauthorized Groq API key')
    }

    lastErrorDetail = await readGroqErrorMessage(res)
    if (res.status === 429) {
      sawRateLimit = true
      markModelCooledDown(model)
      clearSavedGroqModel()
      continue
    }
    if (res.status >= 500) {
      sawServerBusy = true
      markModelCooledDown(model)
      clearSavedGroqModel()
      continue
    }

    clearSavedGroqModel()
  }

  if (sawRateLimit && !sawServerBusy) {
    throw new GroqClientError('rate_limited', lastErrorDetail)
  }
  if (sawServerBusy) {
    throw new GroqClientError('server_busy', lastErrorDetail)
  }
  throw new GroqClientError('network_error', lastErrorDetail)
}
