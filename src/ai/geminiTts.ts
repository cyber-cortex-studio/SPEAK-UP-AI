import { GEMINI_TTS_MODEL, getGenerateContentUrl } from './geminiConfig'
import { getApiKey } from './keyVault'

export type SpeechRate = 0.75 | 1.0 | 1.2

export type TtsErrorCode = 'missing_key' | 'rate_limited' | 'aborted' | 'tts_failed'

export class TtsError extends Error {
  readonly code: TtsErrorCode

  constructor(code: TtsErrorCode, message: string) {
    super(message)
    this.name = 'TtsError'
    this.code = code
  }
}

interface GeminiTtsRawResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string
          data?: string
        }
      }>
    }
  }>
}

const MAX_TTS_CACHE_SIZE = 7
const TTS_TIMEOUT_MS = 20_000
const PCM_SAMPLE_RATE = 24_000
const PCM_NUM_CHANNELS = 1
const PCM_BITS_PER_SAMPLE = 16

const audioCache = new Map<string, string>()
let activeAudio: HTMLAudioElement | null = null

function buildCacheKey(providerVoiceId: string, text: string): string {
  return `${providerVoiceId}::${text.trim()}`
}

function getCachedUrl(key: string): string | null {
  const existing = audioCache.get(key)
  if (!existing) {
    return null
  }
  // Refresh LRU order
  audioCache.delete(key)
  audioCache.set(key, existing)
  return existing
}

function setCachedUrl(key: string, blobUrl: string): void {
  if (audioCache.has(key)) {
    const oldUrl = audioCache.get(key)
    if (oldUrl && oldUrl !== blobUrl) {
      URL.revokeObjectURL(oldUrl)
    }
    audioCache.delete(key)
  } else if (audioCache.size >= MAX_TTS_CACHE_SIZE) {
    const oldestKey = audioCache.keys().next().value
    if (oldestKey !== undefined) {
      const oldestUrl = audioCache.get(oldestKey)
      if (oldestUrl) {
        URL.revokeObjectURL(oldestUrl)
      }
      audioCache.delete(oldestKey)
    }
  }
  audioCache.set(key, blobUrl)
}

export function clearTtsCache(): void {
  stopSpeech()
  for (const url of audioCache.values()) {
    URL.revokeObjectURL(url)
  }
  audioCache.clear()
}

export function getTtsCacheSize(): number {
  return audioCache.size
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function pcmToWavBlob(pcmBytes: Uint8Array, sampleRate = PCM_SAMPLE_RATE): Blob {
  const dataLength = pcmBytes.byteLength
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  const byteRate = (sampleRate * PCM_NUM_CHANNELS * PCM_BITS_PER_SAMPLE) / 8
  const blockAlign = (PCM_NUM_CHANNELS * PCM_BITS_PER_SAMPLE) / 8

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, PCM_NUM_CHANNELS, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, PCM_BITS_PER_SAMPLE, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  new Uint8Array(buffer, 44).set(pcmBytes)
  return new Blob([buffer], { type: 'audio/wav' })
}

export function stopSpeech(): void {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.currentTime = 0
    activeAudio.onended = null
    activeAudio.onerror = null
    activeAudio = null
  }
}

export interface SpeakOptions {
  text: string
  providerVoiceId: string
  rate: SpeechRate
  signal?: AbortSignal
  onEnded?: () => void
}

async function fetchTtsAudioUrl(
  text: string,
  providerVoiceId: string,
  externalSignal?: AbortSignal,
): Promise<string> {
  const cacheKey = buildCacheKey(providerVoiceId, text)
  const cached = getCachedUrl(cacheKey)
  if (cached) {
    return cached
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    throw new TtsError('missing_key', 'Gemini API key is not configured')
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort('timeout'), TTS_TIMEOUT_MS)

  const onExternalAbort = () => controller.abort('external')
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timeoutId)
      throw new TtsError('aborted', 'TTS request was aborted')
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const response = await fetch(getGenerateContentUrl(GEMINI_TTS_MODEL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: providerVoiceId,
              },
            },
          },
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 429) {
        throw new TtsError('rate_limited', 'TTS quota limit reached')
      }
      throw new TtsError('tts_failed', `TTS HTTP error: ${response.status}`)
    }

    const raw = (await response.json()) as GeminiTtsRawResponse
    const base64Audio = raw.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    if (!base64Audio) {
      throw new TtsError('tts_failed', 'No audio data returned by Gemini TTS')
    }

    const pcmBytes = base64ToUint8Array(base64Audio)
    const wavBlob = pcmToWavBlob(pcmBytes)
    const blobUrl = URL.createObjectURL(wavBlob)
    setCachedUrl(cacheKey, blobUrl)
    return blobUrl
  } catch (err: unknown) {
    if (err instanceof TtsError) {
      throw err
    }
    if (controller.signal.aborted) {
      throw new TtsError('aborted', 'TTS request timed out or was aborted')
    }
    throw new TtsError('tts_failed', err instanceof Error ? err.message : 'TTS playback failed')
  } finally {
    window.clearTimeout(timeoutId)
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort)
    }
  }
}

export async function speakText(options: SpeakOptions): Promise<void> {
  const trimmed = options.text.trim()
  if (!trimmed) {
    return
  }

  stopSpeech()
  const blobUrl = await fetchTtsAudioUrl(trimmed, options.providerVoiceId, options.signal)

  if (options.signal?.aborted) {
    throw new TtsError('aborted', 'TTS playback aborted before start')
  }

  const audio = new Audio(blobUrl)
  audio.playbackRate = options.rate
  activeAudio = audio

  audio.onended = () => {
    if (activeAudio === audio) {
      activeAudio = null
    }
    options.onEnded?.()
  }

  audio.onerror = () => {
    if (activeAudio === audio) {
      activeAudio = null
    }
    options.onEnded?.()
  }

  try {
    await audio.play()
  } catch {
    if (activeAudio === audio) {
      activeAudio = null
    }
    throw new TtsError('tts_failed', 'Audio playback was blocked by the browser')
  }
}
