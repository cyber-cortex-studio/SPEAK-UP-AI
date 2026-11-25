import { useState } from 'react'
import type { SpeechRate } from '../ai/androidSpeech'
import type { StuckChip } from '../schemas/validators'

interface StuckChipsDrawerProps {
  chips: StuckChip[]
  selectedRate: SpeechRate
  speakingMessageId: string | null
  onPlayChip: (chipId: string, text: string, rate: SpeechRate) => void
  onUseChip: (text: string) => void
  disabled?: boolean
}

const LEVEL_STYLES: Record<StuckChip['level'], { label: string; badgeClass: string }> = {
  easy: {
    label: 'Easy',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  natural: {
    label: 'Natural',
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  smart: {
    label: 'Smart',
    badgeClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
}

export function StuckChipsDrawer({
  chips,
  selectedRate,
  speakingMessageId,
  onPlayChip,
  onUseChip,
  disabled = false,
}: StuckChipsDrawerProps) {
  const [openForKey, setOpenForKey] = useState<string | null>(null)

  if (chips.length === 0) {
    return null
  }

  const chipsKey = chips.map((c) => c.english).join('|')
  const isOpen = openForKey === chipsKey

  const toggleDrawer = () => {
    setOpenForKey((prev) => (prev === chipsKey ? null : chipsKey))
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        disabled={disabled}
        onClick={toggleDrawer}
        aria-expanded={isOpen}
        className="w-full min-h-10 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
      >
        <span>
          {isOpen
            ? 'Hide Reply Ideas (বন্ধ করো)'
            : 'Stuck? Show 3 Ideas (আটকে গেছ? ৩টি আইডিয়া দেখো)'}
        </span>
        <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 flex flex-col gap-2">
          {chips.map((chip, idx) => {
            const chipId = `stuck_chip_${idx}_${chip.level}`
            const isPlaying = speakingMessageId === chipId
            const meta = LEVEL_STYLES[chip.level]

            return (
              <div
                key={`${chip.level}_${idx}`}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs flex flex-col gap-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPlayChip(chipId, chip.english, selectedRate)}
                      className="min-h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                    >
                      {isPlaying ? 'Stop' : `Listen (${selectedRate}x)`}
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onUseChip(chip.english)
                        setOpenForKey(null)
                      }}
                      className="min-h-7 px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                    >
                      Fill
                    </button>
                  </div>
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                  {chip.english}
                </p>
                {chip.bangla && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {chip.bangla}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
