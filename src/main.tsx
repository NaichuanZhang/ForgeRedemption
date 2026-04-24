import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { GameLandingPage } from './components/LandingPage'
import './index.css'

function isLandingPath(): boolean {
  const normalized = window.location.pathname.replace(/\/$/, '') || '/'
  return normalized === '/landing'
}

function Root() {
  if (isLandingPath()) {
    return <GameLandingPage onEnter={() => { window.location.assign('/') }} />
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
