import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) {
    return null
  }

  return (
    <div
      role="alert"
      className="fixed bottom-16 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 rounded-2xl border border-emerald-500/40 bg-slate-900 text-slate-100 dark:bg-slate-800 p-4 shadow-lg flex items-center justify-between gap-3"
    >
      <div className="text-sm">
        <p className="font-semibold text-emerald-400">New Version Available</p>
        <p className="text-xs text-slate-300">Update now to get the latest lessons and fixes.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="min-h-12 px-3 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
        >
          Later
        </button>
        <button
          type="button"
          onClick={() => {
            void updateServiceWorker(true)
          }}
          className="min-h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
        >
          Update Now
        </button>
      </div>
    </div>
  )
}
