import { GEMINI_COACH_MODEL, getModelInfoUrl } from './geminiConfig'

const STORAGE_KEY = 'speakup_gemini_api_key'

export type KeyStorageMode = 'session' | 'local' | 'none'

export interface KeyTestResult {
  valid: boolean
  reason?: 'empty' | 'invalid_key' | 'network_error' | 'timeout'
}

export function getApiKey(): string | null {
  const sessionKey = window.sessionStorage.getItem(STORAGE_KEY)
  if (sessionKey && sessionKey.trim().length > 0) {
    return sessionKey.trim()
  }
  const localKey = window.localStorage.getItem(STORAGE_KEY)
  if (localKey && localKey.trim().length > 0) {
    return localKey.trim()
  }
  return null
}

export function getKeyStorageMode(): KeyStorageMode {
  if (window.sessionStorage.getItem(STORAGE_KEY)) {
    return 'session'
  }
  if (window.localStorage.getItem(STORAGE_KEY)) {
    return 'local'
  }
  return 'none'
}

export function saveApiKey(rawKey: string, rememberOnDevice: boolean): void {
  const trimmed = rawKey.trim()
  if (!trimmed) {
    throw new Error('API key cannot be empty')
  }
  clearApiKey()
  if (rememberOnDevice) {
    window.localStorage.setItem(STORAGE_KEY, trimmed)
  } else {
    window.sessionStorage.setItem(STORAGE_KEY, trimmed)
  }
}

export function clearApiKey(): void {
  window.sessionStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(STORAGE_KEY)
}

export async function testApiKey(rawKey: string): Promise<KeyTestResult> {
  const trimmed = rawKey.trim()
  if (!trimmed) {
    return { valid: false, reason: 'empty' }
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(getModelInfoUrl(GEMINI_COACH_MODEL), {
      method: 'GET',
      headers: {
        'x-goog-api-key': trimmed,
      },
      signal: controller.signal,
    })

    if (response.ok) {
      return { valid: true }
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return { valid: false, reason: 'invalid_key' }
    }
    return { valid: false, reason: 'network_error' }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { valid: false, reason: 'timeout' }
    }
    return { valid: false, reason: 'network_error' }
  } finally {
    window.clearTimeout(timeoutId)
  }
}
