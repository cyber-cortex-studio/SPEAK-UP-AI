export type QuotaBucket = 'coach'

export const FREE_TIER_COACH_LIMITS = {
  rpm: 10,
  rpd: 250,
}

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

const listeners = new Set<() => void>()

function getTodayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function loadDailyCount(): DailyStorageData {
  const today = getTodayKey()
  try {
    const raw = window.localStorage.getItem(DAILY_STORAGE_KEY)
    if (!raw) {
      return { date: today, coach: 0 }
    }
    const parsed = JSON.parse(raw) as Partial<DailyStorageData>
    if (parsed.date !== today) {
      return { date: today, coach: 0 }
    }
    return {
      date: today,
      coach: typeof parsed.coach === 'number' ? parsed.coach : 0,
    }
  } catch {
    return { date: today, coach: 0 }
  }
}

function saveDailyCount(data: DailyStorageData): void {
  try {
    window.localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
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
  daily.coach += 1
  saveDailyCount(daily)
  notifyListeners()
}

export function triggerQuotaCooldown(_bucket: QuotaBucket, seconds: number): void {
  const target = Date.now() + Math.max(5, seconds) * 1000
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
