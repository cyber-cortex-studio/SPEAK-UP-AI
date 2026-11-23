import type { KeyStorageMode } from '../ai/keyVault'
import { ChevronRightIcon, LockIcon, ShieldIcon } from './NavIcons'

interface DataPrivacyViewProps {
  storageMode: KeyStorageMode
  onBack: () => void
  onOpenKeyManager: () => void
}

export function DataPrivacyView({
  storageMode,
  onBack,
  onOpenKeyManager,
}: DataPrivacyViewProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <ShieldIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h2 className="text-base font-bold">Data &amp; Privacy</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              100% local &amp; private by design
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenKeyManager}
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3 text-left hover:border-emerald-500 cursor-pointer transition-colors"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">Gemini API Key (BYOK)</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {storageMode === 'none'
              ? 'Not connected yet — tap to set up'
              : 'Stored only on this phone — tap to change or clear'}
          </span>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-2.5">
        <h3 className="text-sm font-semibold">Privacy &amp; Security</h3>
        <ul className="flex flex-col gap-2 text-xs text-slate-600 dark:text-slate-400">
          <li>• Zero backend server: your API key and progress never touch our servers.</li>
          <li>• Zero audio storage: voice recordings are cleared from RAM immediately after each turn.</li>
          <li>• Local learning data: daily stats, mistake cards, and saved phrases stay inside your phone.</li>
        </ul>
      </section>

      <button
        type="button"
        onClick={() => {
          window.location.hash = '#/progress'
        }}
        className="w-full rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 flex items-center justify-between gap-3 text-left hover:bg-rose-500/10 cursor-pointer transition-colors"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">
            Manage or Delete My Data
          </span>
          <span className="text-xs text-rose-600/80 dark:text-rose-300/80">
            Open Progress tab to review or reset your local learning history
          </span>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-rose-500 shrink-0" />
      </button>

      <div className="rounded-2xl border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 p-4 flex items-center gap-3">
        <LockIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
          Your data stays on your device. You are in full control.
        </p>
      </div>
    </div>
  )
}
