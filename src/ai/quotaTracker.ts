export type QuotaBucket = 'coach'

export const FREE_TIER_COACH_LIMITS = {
  rpm: 10,
  rpd: 250,
} as const

export interface CoachQuotaSnapshot {
  usedThisMinute: number
  limitPerMinute: number
  usedToday: number
  limitPerDay: number
  cooldownSeconds: number
}

interface DailyStorageData {
  date: string
  coach: number
}

const DAILY_STORAGE_KEY = 'speakup_daily_quota_v2'
const MINUTE_MS = 60_000

let minuteTimestamps: number[] = []
let cooldownUntil = 0
let memoryDailyFallback: DailyStorageData | null = null

const listeners = new Set<() => void>()

function getTodayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    // Restricted browser context
  }
  return null
}

function loadDailyCount(): DailyStorageData {
  const today = getTodayKey()
  const storage = getSafeLocalStorage()

  if (storage) {
    try {
      const raw = storage.getItem(DAILY_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DailyStorageData>
        if (parsed.date === today && typeof parsed.coach === 'number' && parsed.coach >= 0) {
          memoryDailyFallback = { date: today, coach: parsed.coach }
          return memoryDailyFallback
        }
      }
    } catch {
      // Ignore corrupted JSON and fall back cleanly
    }
  }

  if (memoryDailyFallback && memoryDailyFallback.date === today) {
    return memoryDailyFallback
  }

  memoryDailyFallback = { date: today, coach: 0 }
  return memoryDailyFallback
}

function saveDailyCount(data: DailyStorageData): void {
  const safeData: DailyStorageData = {
    date: data.date,
    coach: Math.max(0, Math.floor(data.coach)),
  }
  memoryDailyFallback = safeData

  const storage = getSafeLocalStorage()
  if (storage) {
    try {
      storage.setItem(DAILY_STORAGE_KEY, JSON.stringify(safeData))
    } catch {
      // Ignore storage quota or private-mode errors
    }
  }
}

function pruneOldTimestamps(now: number): void {
  minuteTimestamps = minuteTimestamps.filter((ts) => now - ts < MINUTE_MS)
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function recordQuotaUsage(_bucket: QuotaBucket = 'coach'): void {
  const now = Date.now()
  pruneOldTimestamps(now)
  minuteTimestamps.push(now)

  const daily = loadDailyCount()
  saveDailyCount({ date: daily.date, coach: daily.coach + 1 })
  notifyListeners()
}

export function triggerQuotaCooldown(_bucket: QuotaBucket, seconds: number): void {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(5, Math.ceil(seconds)) : 45
  const target = Date.now() + safeSeconds * 1000
  if (target > cooldownUntil) {
    cooldownUntil = target
    notifyListeners()
  }
}

export function getQuotaSnapshot(): CoachQuotaSnapshot {
  const now = Date.now()
  pruneOldTimestamps(now)
  const daily = loadDailyCount()

  return {
    usedThisMinute: minuteTimestamps.length,
    limitPerMinute: FREE_TIER_COACH_LIMITS.rpm,
    usedToday: daily.coach,
    limitPerDay: FREE_TIER_COACH_LIMITS.rpd,
    cooldownSeconds: Math.max(0, Math.ceil((cooldownUntil - now) / 1000)),
  }
}

export function subscribeQuota(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
