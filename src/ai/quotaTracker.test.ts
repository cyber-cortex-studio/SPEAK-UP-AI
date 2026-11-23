import { describe, expect, it } from 'vitest'
import { getQuotaSnapshot, recordQuotaUsage, triggerQuotaCooldown } from './quotaTracker'

describe('quotaTracker', () => {
  it('increments minute and daily usage and triggers cooldown countdown', () => {
    const before = getQuotaSnapshot()
    recordQuotaUsage('coach')
    const after = getQuotaSnapshot()

    expect(after.usedThisMinute).toBe(before.usedThisMinute + 1)
    expect(after.usedToday).toBe(before.usedToday + 1)

    triggerQuotaCooldown('coach', 30)
    const cooled = getQuotaSnapshot()
    expect(cooled.cooldownSeconds).toBeGreaterThan(0)
    expect(cooled.cooldownSeconds).toBeLessThanOrEqual(30)
  })
})
