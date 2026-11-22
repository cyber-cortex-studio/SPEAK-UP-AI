export function PrivacyScreen() {
  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Data &amp; Privacy</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          AI disclosures, JSON backup/restore, and granular local deletion controls will live here.
        </p>
      </div>
    </div>
  )
}
