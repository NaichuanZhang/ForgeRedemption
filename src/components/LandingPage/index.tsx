import { motion } from 'motion/react';
import './GameLandingPage.css';
import { DEFAULT_LOGO, DEFAULT_SPONSORS, DEFAULT_VIDEO } from './assets';

interface GameLandingPageProps {
  onEnter: () => void;
  logoSrc?: string;
  videoSrc?: string;
  sponsors?: string[];
}

const sponsorXPositions = [15.5, 33, 69, 85];
const sponsorYPositions = [2, 7, 5, 6.5]; // vh from bottom
const sponsorSizes = [152, 80, 107, 96]; // px

export function GameLandingPage({
  onEnter,
  logoSrc = DEFAULT_LOGO,
  videoSrc = DEFAULT_VIDEO,
  sponsors = DEFAULT_SPONSORS,
}: GameLandingPageProps) {
  return (
    <div className="relative h-screen w-screen bg-[#050505] overflow-hidden text-white font-sans">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#050505]"></div>
        {videoSrc ? (
          <video
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1c284e]/20 via-[#050505] animate-pulse opacity-80" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(28,40,78,0.4)_0%,_rgba(0,0,0,0)_85%)] pointer-events-none"></div>
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      </div>

      {/* Decorative Borders */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none border-[12px] md:border-[24px] border-black/20 z-30"></div>
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-30">
         <div className="absolute top-6 md:top-8 left-1/2 -translate-x-1/2 w-[1px] h-4 bg-white/20"></div>
         <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 w-[1px] h-4 bg-white/20"></div>
         <div className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-white/20"></div>
         <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-white/20"></div>
      </div>

      {/* Top Left: Logo */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute top-10 left-10 md:top-12 md:left-12 z-20"
      >
        <img 
          src={logoSrc} 
          alt="Game Logo" 
          className="w-48 md:w-64 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
          referrerPolicy="no-referrer"
        />
      </motion.div>

      {/* Bottom Center: CTA */}
      <div className="absolute bottom-[60px] md:bottom-[80px] left-1/2 -translate-x-1/2 z-20 text-center w-full px-4 flex flex-col items-center">
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
        >
          <button
            onClick={onEnter}
            className="group relative px-6 py-2 md:px-8 md:py-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white/90 border border-white/20 font-bold text-xs md:text-sm tracking-[0.2em] uppercase transition-all cursor-pointer rounded-full shadow-lg font-orbitron"
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-10 transition-opacity duration-300">
              <div className="w-full h-full bg-white"></div>
            </div>
            <span className="relative z-10 transition-transform block group-hover:-translate-y-px">Play</span>
          </button>
        </motion.div>
      </div>

      {/* Bottom Row: Sponsors */}
      <div className="absolute bottom-0 left-0 w-full h-32 md:h-36 z-20 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="relative w-full h-full"
        >
          {sponsors.map((src, index) => (
            <img
              key={index}
              src={src}
              alt={`Sponsor ${index + 1}`}
              style={{
                left: `${sponsorXPositions[index] ?? 0}vw`,
                bottom: `${sponsorYPositions[index] ?? 0}vh`,
                height: `${sponsorSizes[index] ?? 80}px`,
              }}
              className="absolute -translate-x-1/2 w-auto max-w-[min(20vw,240px)] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] opacity-60 hover:opacity-100 transition-opacity duration-500 pointer-events-auto"
              referrerPolicy="no-referrer"
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
