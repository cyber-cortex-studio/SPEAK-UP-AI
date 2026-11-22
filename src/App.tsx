import { useEffect, useState } from 'react'
import { CoachScreen } from './screens/CoachScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { PrivacyScreen } from './screens/PrivacyScreen'
import { UpdateBanner } from './components/UpdateBanner'

type Route = 'coach' | 'progress' | 'settings' | 'privacy'

const NAV_ITEMS: Array<{ id: Route; label: string; shortLabel: string }> = [
  { id: 'coach', label: 'Coach', shortLabel: 'Coach' },
  { id: 'progress', label: 'Progress', shortLabel: 'Progress' },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings' },
  { id: 'privacy', label: 'Data & Privacy', shortLabel: 'Privacy' },
]

function parseRouteFromHash(): Route {
  const cleaned = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  if (cleaned === 'progress' || cleaned === 'settings' || cleaned === 'privacy') {
    return cleaned
  }
  return 'coach'
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRouteFromHash())
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = window.localStorage.getItem('speakup_theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '#/coach'
    }
    const handleHashChange = () => setRoute(parseRouteFromHash())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      window.localStorage.setItem('speakup_theme', 'dark')
    } else {
      root.classList.remove('dark')
      window.localStorage.setItem('speakup_theme', 'light')
    }
  }, [isDark])

  const navigate = (target: Route) => {
    window.location.hash = `#/${target}`
  }

  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col md:flex-row bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <span className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            SpeakUp AI
          </span>
          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className="min-h-12 min-w-12 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Toggle theme"
          >
            {isDark ? 'Light' : 'Dark'}
          </button>
        </div>

        <nav className="mt-4 flex flex-col gap-2" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const active = route === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`min-h-12 w-full rounded-xl px-4 text-left text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Mobile Top Bar */}
        <header className="flex md:hidden items-center justify-between h-14 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <span className="text-base font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            SpeakUp AI
          </span>
          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className="min-h-12 min-w-12 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium"
            aria-label="Toggle theme"
          >
            {isDark ? 'Light' : 'Dark'}
          </button>
        </header>

        {/* Scrollable Screen Content */}
        <main className="flex-1 overflow-y-auto">
          {route === 'coach' && <CoachScreen />}
          {route === 'progress' && <ProgressScreen />}
          {route === 'settings' && <SettingsScreen />}
          {route === 'privacy' && <PrivacyScreen />}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav
          className="flex md:hidden items-center justify-around border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pb-[env(safe-area-inset-bottom)] shrink-0"
          aria-label="Mobile Navigation"
        >
          {NAV_ITEMS.map((item) => {
            const active = route === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`min-h-12 flex-1 flex items-center justify-center text-xs font-semibold transition-colors ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {item.shortLabel}
              </button>
            )
          })}
        </nav>
      </div>

      <UpdateBanner />
    </div>
  )
}
