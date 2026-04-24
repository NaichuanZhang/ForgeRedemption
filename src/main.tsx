import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { GameLandingPage } from './components/LandingPage'
import './index.css'

// Lazy so `/landing` never loads App → useGameState → insforge (which throws if env is missing).
const App = lazy(() => import('./App').then((m) => ({ default: m.App })))

function isLandingPath(): boolean {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  let pathname = window.location.pathname.replace(/\/$/, '') || '/'
  if (base && pathname.startsWith(base)) {
    pathname = pathname.slice(base.length).replace(/\/$/, '') || '/'
  }
  return pathname === '/landing'
}

function Root() {
  if (isLandingPath()) {
    return <GameLandingPage onEnter={() => { window.location.assign('/') }} />
  }
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-900 text-zinc-400">
          Loading…
        </div>
      }
    >
      <App />
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
