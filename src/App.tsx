import { Route, Routes } from 'react-router-dom'
import { GamePage } from './pages/GamePage'
import { TechExplainerPage } from './pages/TechExplainerPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<GamePage />} />
      <Route path="/tech-explainer" element={<TechExplainerPage />} />
    </Routes>
  )
}
