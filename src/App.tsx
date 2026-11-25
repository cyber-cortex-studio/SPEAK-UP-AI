import { useEffect, useState, type ComponentType } from 'react'
import { CoachIcon, HomeIcon, ProgressIcon, SettingsIcon } from './components/NavIcons'
import { UpdateBanner } from './components/UpdateBanner'
import { CoachScreen } from './screens/CoachScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { SettingsScreen } from './screens/SettingsScreen'

type Route = 'home' | 'coach' | 'progress' | 'settings'

const NAV_ITEMS: Array<{
  id: Route
  label: string
  Icon: ComponentType<{ className?: string }>
}> = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'coach', label: 'Coach', Icon: CoachIcon },
  { id: 'progress', label: 'Progress', Icon: ProgressIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
]

function parseRouteFromHash(): Route {
  const cleaned = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  if (cleaned === 'coach' || cleaned === 'progress' || cleaned === 'settings') {
    return cleaned
  }
  return 'home'
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRouteFromHash())
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = window.localStorage.getItem('speakup_theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '#/home'
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
    <div className="h-dvh w-full overflow-hidden flex justify-center bg-slate-200 dark:bg-black text-slate-900 dark:text-slate-100">
      {/* Strict Mobile-Only App Frame (Max 430px centered on all devices) */}
      <div className="h-dvh w-full max-w-[430px] flex flex-col bg-slate-50 dark:bg-slate-950 shadow-2xl border-x border-slate-200 dark:border-slate-800 relative overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between h-14 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <span className="text-base font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            SpeakUp AI
          </span>
          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className="min-h-12 min-w-12 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-amber-400"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-slate-700"
                aria-hidden="true"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>
        </header>

        {/* Scrollable Screen Content */}
        <main className="flex-1 overflow-y-auto">
          {route === 'home' && <HomeScreen />}
          {route === 'coach' && <CoachScreen />}
          {route === 'progress' && <ProgressScreen />}
          {route === 'settings' && <SettingsScreen />}
        </main>

        {/* Bottom Navigation */}
        <nav
          className="flex items-center justify-around border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pb-[env(safe-area-inset-bottom)] shrink-0"
          aria-label="Mobile Navigation"
        >
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = route === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => navigate(id)}
                className={`min-h-14 flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        <UpdateBanner />
      </div>
    </div>
  )
}
