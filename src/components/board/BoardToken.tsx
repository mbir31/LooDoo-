import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { PlayerColor, PlayerSlot, TokenTheme, TokenZone } from '../../types';
import { getTokenGridCoordinates } from '../../game-engine/engine';
import { soundFx } from '../../utils/sound';
import { Zap, Crown, Sparkles } from 'lucide-react';

interface BoardTokenProps {
  uid: string;
  tokenId: number;
  slot: PlayerSlot;
  color: PlayerColor;
  theme: TokenTheme;
  zone: TokenZone;
  progress: number;
  coords: [number, number];
  isMovable: boolean;
  stackIndex: number;
  stackTotal: number;
  onClick: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

const COLOR_MAP: Record<
  PlayerColor,
  {
    tokenGradient: string;
    tokenBorder: string;
    shadowColor: string;
    homeFill: string;
  }
> = {
  red: {
    tokenGradient: 'from-rose-400 via-red-500 to-red-700',
    tokenBorder: 'border-red-800',
    shadowColor: 'rgba(239, 68, 68, 0.65)',
    homeFill: '#dc2626',
  },
  green: {
    tokenGradient: 'from-emerald-300 via-emerald-500 to-emerald-700',
    tokenBorder: 'border-emerald-800',
    shadowColor: 'rgba(16, 185, 129, 0.65)',
    homeFill: '#059669',
  },
  yellow: {
    tokenGradient: 'from-amber-200 via-amber-400 to-yellow-600',
    tokenBorder: 'border-amber-750 border-amber-800',
    shadowColor: 'rgba(245, 158, 11, 0.65)',
    homeFill: '#d97706',
  },
  blue: {
    tokenGradient: 'from-sky-300 via-blue-500 to-blue-700',
    tokenBorder: 'border-blue-800',
    shadowColor: 'rgba(59, 130, 246, 0.65)',
    homeFill: '#2563eb',
  },
};

export const BoardToken: React.FC<BoardTokenProps> = ({
  uid,
  tokenId,
  slot,
  color,
  theme,
  zone,
  progress,
  coords,
  isMovable,
  stackIndex,
  stackTotal,
  onClick,
  onHoverStart,
  onHoverEnd,
}) => {
  const prevPosRef = useRef<{ zone: TokenZone; progress: number; coords: [number, number] } | null>(null);
  const [animationState, setAnimationState] = useState<{
    key: number;
    lefts: string[];
    tops: string[];
    duration: number;
    isCaptureReturn: boolean;
  } | null>(null);

  const [row, col] = coords;
  const currentLeft = `${(col / 15) * 100}%`;
  const currentTop = `${(row / 15) * 100}%`;
  const cellPercent = `${(1 / 15) * 100}%`;

  const offsetX = stackTotal > 1 ? (stackIndex % 2 === 0 ? -3.5 : 3.5) : 0;
  const offsetY = stackTotal > 1 ? (stackIndex >= 2 ? 3.5 : -3.5) : 0;

  useEffect(() => {
    const prev = prevPosRef.current;
    prevPosRef.current = { zone, progress, coords };

    if (!prev) return; // First mount, stay at current position

    // Check if token actually moved
    if (prev.zone === zone && prev.progress === progress) {
      return;
    }

    // 1. Token Spawn from Yard to Track
    if (prev.zone === 'YARD' && (zone === 'TRACK' || progress === 0)) {
      const prevCoord = prev.coords;
      const targetCoord = coords;
      const lefts = [`${(prevCoord[1] / 15) * 100}%`, `${(targetCoord[1] / 15) * 100}%`];
      const tops = [`${(prevCoord[0] / 15) * 100}%`, `${(targetCoord[0] / 15) * 100}%`];

      soundFx.tokenSpawn();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([25, 30, 35]);
      }

      setAnimationState({
        key: Date.now(),
        lefts,
        tops,
        duration: 0.35,
        isCaptureReturn: false,
      });

      const timer = setTimeout(() => setAnimationState(null), 400);
      return () => clearTimeout(timer);
    }

    // 2. Token Captured and returning to Yard
    if (zone === 'YARD' && prev.zone !== 'YARD') {
      const prevCoord = prev.coords;
      const targetCoord = coords;
      const lefts = [`${(prevCoord[1] / 15) * 100}%`, `${(targetCoord[1] / 15) * 100}%`];
      const tops = [`${(prevCoord[0] / 15) * 100}%`, `${(targetCoord[0] / 15) * 100}%`];

      setAnimationState({
        key: Date.now(),
        lefts,
        tops,
        duration: 0.5,
        isCaptureReturn: true,
      });

      const timer = setTimeout(() => setAnimationState(null), 550);
      return () => clearTimeout(timer);
    }

    // 3. Normal Forward Tile-by-Tile Glide Path (Progress increase)
    if (progress > prev.progress && prev.progress >= 0) {
      const waypoints: [number, number][] = [];
      const steps = progress - prev.progress;

      for (let p = prev.progress; p <= progress; p++) {
        let stepZone: TokenZone = 'TRACK';
        if (p >= 56) stepZone = 'HOME';
        else if (p >= 51) stepZone = 'HOME_PATH';
        waypoints.push(getTokenGridCoordinates(slot, tokenId, stepZone, p));
      }

      if (waypoints.length > 1) {
        const lefts = waypoints.map((w) => `${(w[1] / 15) * 100}%`);
        const tops = waypoints.map((w) => `${(w[0] / 15) * 100}%`);
        const duration = Math.min(1.2, Math.max(0.28, steps * 0.13));

        soundFx.tokenMoveSequence(steps);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(Array(steps).fill(12));
        }

        setAnimationState({
          key: Date.now(),
          lefts,
          tops,
          duration,
          isCaptureReturn: false,
        });

        const timer = setTimeout(() => setAnimationState(null), duration * 1000 + 50);
        return () => clearTimeout(timer);
      }
    }

    // Fallback: smooth spring glide directly from prevCoords to newCoords
    const lefts = [`${(prev.coords[1] / 15) * 100}%`, currentLeft];
    const tops = [`${(prev.coords[0] / 15) * 100}%`, currentTop];
    setAnimationState({
      key: Date.now(),
      lefts,
      tops,
      duration: 0.35,
      isCaptureReturn: false,
    });
    const timer = setTimeout(() => setAnimationState(null), 400);
    return () => clearTimeout(timer);
  }, [zone, progress, slot, tokenId, coords, currentLeft, currentTop]);

  // Render Visual Token Skin
  const renderDesign = () => {
    const colorStyles = COLOR_MAP[color] || COLOR_MAP.red;

    if (theme === 'wood') {
      return (
        <div className="w-full h-full rounded-full border-2 border-amber-950 bg-gradient-to-br from-amber-700 via-amber-850 to-amber-950 shadow-inner flex items-center justify-center p-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:4px_4px] opacity-40" />
          <div className="w-4 h-4 rounded-full bg-amber-600/90 border border-amber-400/80 shadow-inner flex items-center justify-center">
            <div
              className={`w-2 h-2 rounded-full ${
                color === 'red'
                  ? 'bg-red-500'
                  : color === 'green'
                  ? 'bg-emerald-500'
                  : color === 'yellow'
                  ? 'bg-amber-400'
                  : 'bg-blue-500'
              }`}
            />
          </div>
        </div>
      );
    }

    if (theme === 'brass') {
      return (
        <div className="w-full h-full rounded-full border-2 border-yellow-700 bg-gradient-to-br from-amber-200 via-yellow-500 to-amber-800 shadow-inner flex items-center justify-center p-1 relative overflow-hidden">
          <div className="absolute top-0.5 left-1.5 right-1.5 h-1/3 bg-white/60 rounded-full blur-[0.5px]" />
          <div className="w-4 h-4 rounded-full bg-gradient-to-b from-yellow-100 to-amber-600 border border-yellow-300 shadow-md flex items-center justify-center">
            <div
              className={`w-2 h-2 rounded-full shadow-inner ${
                color === 'red'
                  ? 'bg-red-600'
                  : color === 'green'
                  ? 'bg-emerald-600'
                  : color === 'yellow'
                  ? 'bg-yellow-400'
                  : 'bg-blue-600'
              }`}
            />
          </div>
        </div>
      );
    }

    if (theme === 'neon') {
      return (
        <div
          className={`w-full h-full rounded-full border-2 ${colorStyles.tokenBorder} bg-neutral-950 shadow-[0_0_12px_currentColor] flex items-center justify-center p-1 relative overflow-hidden`}
          style={{ color: colorStyles.homeFill }}
        >
          <div
            className={`w-4 h-4 rounded-full bg-gradient-to-br ${colorStyles.tokenGradient} border-2 border-white shadow-[0_0_10px_#fff] flex items-center justify-center`}
          >
            <Zap className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
      );
    }

    if (theme === 'marble') {
      return (
        <div className="w-full h-full rounded-full border-2 border-stone-400 bg-gradient-to-br from-stone-50 via-stone-200 to-stone-400 shadow-inner flex items-center justify-center p-1 relative overflow-hidden">
          <div className="absolute top-0.5 left-1.5 right-1.5 h-1/3 bg-white/80 rounded-full blur-[0.5px]" />
          <div
            className={`w-4 h-4 rounded-full bg-gradient-to-br ${colorStyles.tokenGradient} border border-white shadow-md flex items-center justify-center`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow" />
          </div>
        </div>
      );
    }

    // Classic Glossy 3D Gold / Enamel Theme (Default)
    return (
      <div
        className={`w-full h-full rounded-full border-2 ${colorStyles.tokenBorder} bg-gradient-to-br ${colorStyles.tokenGradient} shadow-inner flex items-center justify-center p-1 relative overflow-hidden`}
      >
        <div className="absolute top-0.5 left-1.5 right-1.5 h-1/3 bg-white/45 rounded-full blur-[0.5px]" />
        <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-gradient-to-b from-white/90 via-white/50 to-transparent border border-white/80 shadow-md flex items-center justify-center">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white shadow" />
        </div>
      </div>
    );
  };

  const isGliding = animationState !== null;

  return (
    <motion.div
      key={`${uid}-${tokenId}-${animationState?.key || 'static'}`}
      id={`token-${uid}-${tokenId}`}
      className="absolute z-20 flex items-center justify-center cursor-pointer pointer-events-auto touch-manipulation"
      style={{
        width: cellPercent,
        height: cellPercent,
      }}
      animate={{
        left: isGliding ? animationState.lefts : currentLeft,
        top: isGliding ? animationState.tops : currentTop,
        x: offsetX,
        y: offsetY,
        scale: isGliding
          ? [1, 1.28, 1.18, 1.28, 1]
          : isMovable
          ? [1, 1.25, 1]
          : 1,
        rotate: isGliding && animationState.isCaptureReturn ? [0, -180, -360] : 0,
      }}
      transition={
        isGliding
          ? {
              left: { duration: animationState.duration, ease: 'easeInOut' },
              top: { duration: animationState.duration, ease: 'easeInOut' },
              scale: { duration: animationState.duration, ease: 'easeInOut' },
              rotate: { duration: animationState.duration, ease: 'easeOut' },
            }
          : {
              left: { type: 'spring', damping: 26, stiffness: 320 },
              top: { type: 'spring', damping: 26, stiffness: 320 },
              scale: isMovable
                ? { repeat: Infinity, duration: 1.1, ease: 'easeInOut' }
                : { duration: 0.2 },
              layout: { type: 'spring', stiffness: 400, damping: 28 },
            }
      }
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={onClick}
    >
      {/* 3D Realistic Pawn / Goti Token Body */}
      <div
        className={`relative w-[90%] h-[90%] rounded-full flex items-center justify-center transition-all ${
          isGliding
            ? 'shadow-[0_12px_24px_rgba(0,0,0,0.65)] scale-110'
            : isMovable
            ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-black shadow-[0_0_22px_rgba(251,191,36,1)] cursor-pointer animate-pulse'
            : ''
        }`}
        style={{
          filter: isGliding
            ? 'drop-shadow(0 14px 10px rgba(0, 0, 0, 0.6))'
            : 'drop-shadow(0 5px 5px rgba(0, 0, 0, 0.45))',
        }}
      >
        {renderDesign()}

        {/* Stack counter badge if multiple tokens on same cell */}
        {stackTotal > 1 && stackIndex === 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-neutral-950 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full border border-white shadow-lg z-30">
            {stackTotal}
          </span>
        )}
      </div>
    </motion.div>
  );
};
