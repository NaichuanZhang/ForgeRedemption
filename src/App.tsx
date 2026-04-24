import { Route, Routes, useNavigate } from 'react-router-dom'
import { GamePage } from './pages/GamePage'
import { TechExplainerPage } from './pages/TechExplainerPage'
import { GameLandingPage } from './components/LandingPage'

function LandingRoute() {
  const navigate = useNavigate()
  return <GameLandingPage onEnter={() => navigate('/')} />
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<GamePage />} />
      <Route path="/landing" element={<LandingRoute />} />
      <Route path="/tech-explainer" element={<TechExplainerPage />} />
    </Routes>
  )
}
