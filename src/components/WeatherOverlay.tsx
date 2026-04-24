import { useMemo } from 'react'
import type { Weather } from '../types'

interface Props {
  weather: Weather
}

const RAIN_COUNT = 80

export function WeatherOverlay({ weather }: Props) {
  const streaks = useMemo(() => {
    return Array.from({ length: RAIN_COUNT }).map(() => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 0.5 + Math.random() * 0.6,
      height: 8 + Math.random() * 12,
    }))
  }, [])

  if (weather === 'sun') {
    return (
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        background: 'radial-gradient(circle at 70% 20%, rgba(255,200,120,0.18), transparent 50%), radial-gradient(circle at 30% 80%, rgba(255,160,80,0.08), transparent 60%)',
      }} />
    )
  }

  if (weather === 'fog') {
    return (
      <>
        <div className="pointer-events-none fixed inset-0 z-0 bg-zinc-300/10 backdrop-blur-[1.5px]" />
        <div className="pointer-events-none fixed inset-0 z-0" style={{
          background: 'linear-gradient(180deg, rgba(220,220,230,0.18) 0%, rgba(220,220,230,0.08) 50%, rgba(220,220,230,0.18) 100%)',
          animation: 'fog-drift 14s ease-in-out infinite',
        }} />
      </>
    )
  }

  // rain
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-slate-700/25" />
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {streaks.map((s, i) => (
          <span
            key={i}
            className="absolute bg-sky-200/60"
            style={{
              left: `${s.left}%`,
              width: '2px',
              height: `${s.height}px`,
              top: '-20px',
              animation: `rain-fall ${s.duration}s linear infinite`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-white"
        style={{ animation: 'thunder-flash 7s ease-in-out infinite' }} />
    </>
  )
}
