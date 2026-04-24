import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GameLandingPage } from './components/LandingPage'
import './index.css'

function onEnter() {
  window.location.assign('/')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameLandingPage onEnter={onEnter} />
  </StrictMode>,
)
