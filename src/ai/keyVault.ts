import { GEMINI_API_BASE } from './geminiConfig'

const GEMINI_STORAGE_KEY = 'speakup_gemini_api_key'
const GROQ_STORAGE_KEY = 'speakup_groq_api_key'
const PROVIDER_PREF_KEY = 'speakup_ai_provider_pref'
const ALERT_KEY = 'speakup_key_security_alert'

export const GROQ_API_BASE = 'https://api.groq.com/openai/v1'

export type KeyStorageMode = 'session' | 'local' | 'none'
export type AiProviderPreference = 'auto' | 'groq' | 'gemini'

export interface KeyTestResult {
  valid: boolean
  reason?: 'empty' | 'invalid_key' | 'network_error' | 'timeout'
}

function readStoredKey(storageKey: string): string | null {
  if (typeof window === 'undefined') return null
  const sessionKey = window.sessionStorage.getItem(storageKey)
  if (sessionKey && sessionKey.trim().length > 0) {
    return sessionKey.trim()
  }
  const localKey = window.localStorage.getItem(storageKey)
  if (localKey && localKey.trim().length > 0) {
    return localKey.trim()
  }
  return null
}

function readStorageMode(storageKey: string): KeyStorageMode {
  if (typeof window === 'undefined') return 'none'
  if (window.sessionStorage.getItem(storageKey)) {
    return 'session'
  }
  if (window.localStorage.getItem(storageKey)) {
    return 'local'
  }
  return 'none'
}

function writeStoredKey(storageKey: string, rawKey: string, rememberOnDevice: boolean): void {
  const trimmed = rawKey.trim()
  if (!trimmed) {
    throw new Error('API key cannot be empty')
  }
  window.sessionStorage.removeItem(storageKey)
  window.localStorage.removeItem(storageKey)
  if (rememberOnDevice) {
    window.localStorage.setItem(storageKey, trimmed)
  } else {
    window.sessionStorage.setItem(storageKey, trimmed)
  }
  setKeySecurityAlert(false)
}

function removeStoredKey(storageKey: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(storageKey)
  window.localStorage.removeItem(storageKey)
}

// --- Gemini Key ---
export function getGeminiApiKey(): string | null {
  return readStoredKey(GEMINI_STORAGE_KEY)
}

export function getGeminiStorageMode(): KeyStorageMode {
  return readStorageMode(GEMINI_STORAGE_KEY)
}

export function saveGeminiApiKey(rawKey: string, rememberOnDevice: boolean): void {
  writeStoredKey(GEMINI_STORAGE_KEY, rawKey, rememberOnDevice)
}

export function clearGeminiApiKey(): void {
  removeStoredKey(GEMINI_STORAGE_KEY)
  setKeySecurityAlert(false)
}

// --- Groq Key ---
export function getGroqApiKey(): string | null {
  return readStoredKey(GROQ_STORAGE_KEY)
}

export function getGroqStorageMode(): KeyStorageMode {
  return readStorageMode(GROQ_STORAGE_KEY)
}

export function saveGroqApiKey(rawKey: string, rememberOnDevice: boolean): void {
  writeStoredKey(GROQ_STORAGE_KEY, rawKey, rememberOnDevice)
}

export function clearGroqApiKey(): void {
  removeStoredKey(GROQ_STORAGE_KEY)
  setKeySecurityAlert(false)
}

// --- Unified helpers (backward-compatible) ---
export function getApiKey(): string | null {
  return getGroqApiKey() ?? getGeminiApiKey()
}

export function hasAnyApiKey(): boolean {
  return Boolean(getGroqApiKey() || getGeminiApiKey())
}

export function getKeyStorageMode(): KeyStorageMode {
  const groqMode = getGroqStorageMode()
  const geminiMode = getGeminiStorageMode()
  if (groqMode === 'local' || geminiMode === 'local') return 'local'
  if (groqMode === 'session' || geminiMode === 'session') return 'session'
  return 'none'
}

export function saveApiKey(rawKey: string, rememberOnDevice: boolean): void {
  saveGeminiApiKey(rawKey, rememberOnDevice)
}

export function clearApiKey(): void {
  clearGeminiApiKey()
}

// --- Provider Preference ---
export function getProviderPreference(): AiProviderPreference {
  if (typeof window === 'undefined') return 'auto'
  const saved = window.localStorage.getItem(PROVIDER_PREF_KEY)
  if (saved === 'groq' || saved === 'gemini' || saved === 'auto') {
    return saved
  }
  return 'auto'
}

export function setProviderPreference(pref: AiProviderPreference): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROVIDER_PREF_KEY, pref)
}

// --- Security Alert ---
export function hasKeySecurityAlert(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ALERT_KEY) === '1'
}

export function setKeySecurityAlert(active: boolean): void {
  if (typeof window === 'undefined') return
  if (active) {
    window.localStorage.setItem(ALERT_KEY, '1')
  } else {
    window.localStorage.removeItem(ALERT_KEY)
  }
}

// --- Zero-Quota Key Verification ---
export async function testGeminiApiKey(rawKey: string): Promise<KeyTestResult> {
  const trimmed = rawKey.trim()
  if (!trimmed) {
    return { valid: false, reason: 'empty' }
  }

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(`${GEMINI_API_BASE}?pageSize=1`, {
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
    globalThis.clearTimeout(timeoutId)
  }
}

export async function testApiKey(rawKey: string): Promise<KeyTestResult> {
  return testGeminiApiKey(rawKey)
}

export async function testGroqApiKey(rawKey: string): Promise<KeyTestResult> {
  const trimmed = rawKey.trim()
  if (!trimmed) {
    return { valid: false, reason: 'empty' }
  }

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(`${GROQ_API_BASE}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${trimmed}`,
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
    globalThis.clearTimeout(timeoutId)
  }
}
