export type QuotaBucket = 'coach' | 'tts'

export interface BucketLimits {
  rpm: number
  rpd: number
}

export const FREE_TIER_ESTIMATES: Record<QuotaBucket, BucketLimits> = {
  coach: { rpm: 10, rpd: 250 },
  tts: { rpm: 3, rpd: 50 },
}

export interface BucketSnapshot {
  usedThisMinute: number
  limitPerMinute: number
  usedToday: number
  limitPerDay: number
  cooldownSeconds: number
}

export interface QuotaSnapshot {
  coach: BucketSnapshot
  tts: BucketSnapshot
}

interface DailyStorageData {
  date: string
  coach: number
  tts: number
}

const DAILY_STORAGE_KEY = 'speakup_daily_quota_v1'
const MINUTE_MS = 60_000

const minuteTimestamps: Record<QuotaBucket, number[]> = {
  coach: [],
  tts: [],
}

const cooldownUntil: Record<QuotaBucket, number> = {
  coach: 0,
  tts: 0,
}

const listeners = new Set<() => void>()

function getTodayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function loadDailyCounts(): DailyStorageData {
  const today = getTodayKey()
  try {
    const raw = window.localStorage.getItem(DAILY_STORAGE_KEY)
    if (!raw) {
      return { date: today, coach: 0, tts: 0 }
    }
    const parsed = JSON.parse(raw) as Partial<DailyStorageData>
    if (parsed.date !== today) {
      return { date: today, coach: 0, tts: 0 }
    }
    return {
      date: today,
      coach: typeof parsed.coach === 'number' ? parsed.coach : 0,
      tts: typeof parsed.tts === 'number' ? parsed.tts : 0,
    }
  } catch {
    return { date: today, coach: 0, tts: 0 }
  }
}

function saveDailyCounts(data: DailyStorageData): void {
  try {
    window.localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

function pruneOldTimestamps(bucket: QuotaBucket, now: number): void {
  minuteTimestamps[bucket] = minuteTimestamps[bucket].filter((ts) => now - ts < MINUTE_MS)
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function recordQuotaUsage(bucket: QuotaBucket): void {
  const now = Date.now()
  pruneOldTimestamps(bucket, now)
  minuteTimestamps[bucket].push(now)

  const daily = loadDailyCounts()
  daily[bucket] += 1
  saveDailyCounts(daily)
  notifyListeners()
}

export function triggerQuotaCooldown(bucket: QuotaBucket, seconds: number): void {
  const target = Date.now() + Math.max(5, seconds) * 1000
  if (target > cooldownUntil[bucket]) {
    cooldownUntil[bucket] = target
    notifyListeners()
  }
}

export function getQuotaSnapshot(): QuotaSnapshot {
  const now = Date.now()
  pruneOldTimestamps('coach', now)
  pruneOldTimestamps('tts', now)

  const daily = loadDailyCounts()

  const buildBucket = (bucket: QuotaBucket): BucketSnapshot => ({
    usedThisMinute: minuteTimestamps[bucket].length,
    limitPerMinute: FREE_TIER_ESTIMATES[bucket].rpm,
    usedToday: daily[bucket],
    limitPerDay: FREE_TIER_ESTIMATES[bucket].rpd,
    cooldownSeconds: Math.max(0, Math.ceil((cooldownUntil[bucket] - now) / 1000)),
  })

  return {
    coach: buildBucket('coach'),
    tts: buildBucket('tts'),
  }
}

export function subscribeQuota(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
