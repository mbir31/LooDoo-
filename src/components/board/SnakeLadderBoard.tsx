import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RoomPlayer, PlayerSlot, PlayerColor, Language } from '../../types';
import { soundFx } from '../../utils/sound';
import { Crown, Sparkles, Trophy } from 'lucide-react';

interface SnakeLadderBoardProps {
  playerPositions: Record<string, number>; // uid -> 1..100
  players: Record<string, RoomPlayer>;
  playerOrder: string[];
  currentPlayerUid: string;
  myUid: string;
  language: Language;
  onTileClick?: (tileNumber: number) => void;
  lastEvent?: {
    type: 'LADDER' | 'SNAKE' | 'NORMAL';
    from: number;
    to: number;
    uid: string;
  } | null;
}

// Classical Bangladeshi Snake & Ladder Map
export const SNAKES_MAP: Record<number, number> = {
  98: 79,
  95: 75,
  93: 73,
  87: 36,
  64: 60,
  62: 19,
  54: 34,
  17: 7,
};

export const LADDERS_MAP: Record<number, number> = {
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  51: 67,
  72: 91,
  80: 99,
};

// Bengali Numerals converter
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export function toBengaliNumber(num: number): string {
  return num
    .toString()
    .split('')
    .map((d) => BN_DIGITS[parseInt(d, 10)] || d)
    .join('');
}

// Map tile index 1..100 to grid row and column (0..9)
// Row 0 is Top (tiles 91..100 or 100..91)
// Row 9 is Bottom (tiles 1..10)
export function getTileGridPosition(tile: number): { row: number; col: number } {
  const t = Math.max(1, Math.min(100, tile));
  const rowFromBottom = Math.floor((t - 1) / 10);
  const row = 9 - rowFromBottom;
  const indexInRow = (t - 1) % 10;

  // Even rows from bottom (0, 2, 4, 6, 8) go Left to Right
  // Odd rows from bottom (1, 3, 5, 7, 9) go Right to Left
  const col = rowFromBottom % 2 === 0 ? indexInRow : 9 - indexInRow;

  return { row, col };
}

export const SnakeLadderBoard: React.FC<SnakeLadderBoardProps> = ({
  playerPositions,
  players,
  playerOrder,
  currentPlayerUid,
  myUid,
  language,
  onTileClick,
  lastEvent,
}) => {
  // Generate 100 tiles data
  const tiles = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= 100; i++) {
      const pos = getTileGridPosition(i);
      const isSnakeHead = Boolean(SNAKES_MAP[i]);
      const isSnakeTail = Object.values(SNAKES_MAP).includes(i);
      const isLadderBottom = Boolean(LADDERS_MAP[i]);
      const isLadderTop = Object.values(LADDERS_MAP).includes(i);

      arr.push({
        num: i,
        row: pos.row,
        col: pos.col,
        isSnakeHead,
        snakeTarget: SNAKES_MAP[i],
        isSnakeTail,
        isLadderBottom,
        ladderTarget: LADDERS_MAP[i],
        isLadderTop,
      });
    }
    return arr;
  }, []);

  return (
    <div className="relative w-full max-w-[500px] aspect-square mx-auto rounded-3xl p-2 sm:p-3 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border-4 border-amber-500/40 shadow-2xl shadow-amber-500/10 flex items-center justify-center select-none overflow-hidden">
      {/* 10x10 Grid Board Canvas */}
      <div className="relative w-full h-full rounded-2xl bg-neutral-900 grid grid-cols-10 grid-rows-10 gap-0.5 sm:gap-1 p-1 border-2 border-neutral-700/60 overflow-hidden shadow-inner">
        {tiles.map((tile) => {
          const isWinnerSquare = tile.num === 100;
          const isStartSquare = tile.num === 1;

          // Vibrant alternating authentic Bengali pattern
          let bgClass = 'bg-neutral-800/80';
          const sum = tile.row + tile.col;
          if (sum % 4 === 0) bgClass = 'bg-red-950/40 border-red-900/40';
          else if (sum % 4 === 1) bgClass = 'bg-emerald-950/40 border-emerald-900/40';
          else if (sum % 4 === 2) bgClass = 'bg-amber-950/40 border-amber-900/40';
          else bgClass = 'bg-blue-950/40 border-blue-900/40';

          if (isWinnerSquare) {
            bgClass = 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 border-amber-300 shadow-lg';
          } else if (isStartSquare) {
            bgClass = 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-400';
          }

          return (
            <div
              key={tile.num}
              onClick={() => onTileClick && onTileClick(tile.num)}
              className={`relative rounded-md sm:rounded-lg border border-neutral-700/40 flex flex-col justify-between p-0.5 sm:p-1 transition-all ${bgClass}`}
              style={{
                gridRow: tile.row + 1,
                gridColumn: tile.col + 1,
              }}
            >
              {/* Tile Number (Dual Bengali + English) */}
              <div className="flex items-center justify-between w-full leading-none">
                <span className={`text-[8px] sm:text-[10px] font-black ${isWinnerSquare ? 'text-neutral-950' : 'text-neutral-300'}`}>
                  {language === 'bn' ? toBengaliNumber(tile.num) : tile.num}
                </span>
                {isWinnerSquare && (
                  <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-neutral-950 fill-neutral-950" />
                )}
              </div>

              {/* Badges / Indicators */}
              <div className="flex items-center justify-center">
                {tile.isSnakeHead && (
                  <span className="text-[10px] sm:text-xs animate-bounce" title={`Snake slides down to ${tile.snakeTarget}`}>
                    🐍
                  </span>
                )}
                {tile.isLadderBottom && (
                  <span className="text-[10px] sm:text-xs animate-pulse" title={`Ladder climbs up to ${tile.ladderTarget}`}>
                    🪜
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* SVG Decorative Snake Curves and Wooden Ladders Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            <linearGradient id="snakeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
            <linearGradient id="ladderGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>

          {/* Render Ladders */}
          {Object.entries(LADDERS_MAP).map(([fromStr, to]) => {
            const from = parseInt(fromStr, 10);
            const startPos = getTileGridPosition(from);
            const endPos = getTileGridPosition(to);

            const x1 = (startPos.col + 0.5) * 10;
            const y1 = (startPos.row + 0.5) * 10;
            const x2 = (endPos.col + 0.5) * 10;
            const y2 = (endPos.row + 0.5) * 10;

            return (
              <g key={`ladder-${from}-${to}`} opacity="0.85">
                <line
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="url(#ladderGrad1)"
                  strokeWidth="3.5"
                  strokeDasharray="4 2"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Render Snakes */}
          {Object.entries(SNAKES_MAP).map(([headStr, tail]) => {
            const head = parseInt(headStr, 10);
            const startPos = getTileGridPosition(head);
            const endPos = getTileGridPosition(tail);

            const x1 = (startPos.col + 0.5) * 10;
            const y1 = (startPos.row + 0.5) * 10;
            const x2 = (endPos.col + 0.5) * 10;
            const y2 = (endPos.row + 0.5) * 10;

            const midX = (x1 + x2) / 2 + (head % 2 === 0 ? 8 : -8);
            const midY = (y1 + y2) / 2;

            return (
              <g key={`snake-${head}-${tail}`} opacity="0.9">
                <path
                  d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                  stroke="url(#snakeGrad1)"
                  strokeWidth="4.5"
                  fill="none"
                  strokeLinecap="round"
                  className="filter drop-shadow"
                />
                <circle cx={`${x1}%`} cy={`${y1}%`} r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
              </g>
            );
          })}
        </svg>

        {/* Player Tokens Floating Smoothly Over Tiles */}
        {playerOrder.map((uid, pIndex) => {
          const player = players[uid];
          if (!player) return null;

          const currentTile = playerPositions[uid] || 1;
          const pos = getTileGridPosition(currentTile);
          const isCurrent = uid === currentPlayerUid;
          const isMe = uid === myUid;

          // Offset tokens sharing the same square
          const sharedPlayersOnTile = playerOrder.filter((oUid) => (playerPositions[oUid] || 1) === currentTile);
          const offsetIndex = sharedPlayersOnTile.indexOf(uid);
          const totalShared = sharedPlayersOnTile.length;
          const offsetX = totalShared > 1 ? (offsetIndex - (totalShared - 1) / 2) * 8 : 0;
          const offsetY = totalShared > 1 ? (offsetIndex % 2 === 0 ? -4 : 4) : 0;

          const colorMap: Record<PlayerColor, { bg: string; ring: string; border: string }> = {
            red: { bg: 'from-rose-500 to-red-700', ring: 'ring-red-400', border: 'border-red-400' },
            green: { bg: 'from-emerald-500 to-teal-700', ring: 'ring-emerald-400', border: 'border-emerald-400' },
            yellow: { bg: 'from-amber-400 to-yellow-600', ring: 'ring-amber-300', border: 'border-amber-300' },
            blue: { bg: 'from-sky-400 to-blue-700', ring: 'ring-sky-300', border: 'border-sky-300' },
          };

          const pColor = colorMap[player.color || 'red'];

          return (
            <motion.div
              key={uid}
              layout
              transition={{
                type: 'spring',
                stiffness: 320,
                damping: 26,
              }}
              className="absolute z-20 pointer-events-none flex items-center justify-center"
              style={{
                left: `${pos.col * 10}%`,
                top: `${pos.row * 10}%`,
                width: '10%',
                height: '10%',
                transform: `translate(${offsetX}px, ${offsetY}px)`,
              }}
            >
              <motion.div
                animate={
                  isCurrent
                    ? {
                        scale: [1, 1.25, 1],
                        rotate: [0, -6, 6, 0],
                      }
                    : {}
                }
                transition={isCurrent ? { repeat: Infinity, duration: 1.6 } : {}}
                className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${pColor.bg} border-2 ${pColor.border} shadow-xl flex items-center justify-center text-xs sm:text-sm font-black text-white ${
                  isCurrent ? `ring-4 ${pColor.ring} shadow-lg shadow-amber-500/50` : ''
                }`}
              >
                <span>{player.avatar || '👤'}</span>
                {isMe && (
                  <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-full border border-black text-[7px] font-black text-black flex items-center justify-center">
                    ★
                  </span>
                )}
              </motion.div>
            </motion.div>
          );
        })}

        {/* Dynamic Celebration & Alerts Overlay for Ladder Climbing & Snake Biting */}
        <AnimatePresence>
          {lastEvent && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute inset-x-4 top-4 z-30 pointer-events-none flex justify-center"
            >
              {lastEvent.type === 'LADDER' && (
                <div className="bg-emerald-950/95 border-2 border-emerald-400 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-emerald-200 backdrop-blur-md">
                  <span className="text-xl">🪜</span>
                  <div className="text-left">
                    <p className="text-xs font-black text-white">
                      {language === 'bn' ? 'মই বেয়ে উপরে উঠলেন!' : 'Climbed up the Ladder!'}
                    </p>
                    <p className="text-[10px] text-emerald-300 font-mono">
                      {lastEvent.from} ➔ {lastEvent.to}
                    </p>
                  </div>
                </div>
              )}

              {lastEvent.type === 'SNAKE' && (
                <div className="bg-red-950/95 border-2 border-red-500 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-red-200 backdrop-blur-md">
                  <span className="text-xl">🐍</span>
                  <div className="text-left">
                    <p className="text-xs font-black text-white">
                      {language === 'bn' ? 'সাপের মুখে কাটা খেলেন!' : 'Bitten by a Snake!'}
                    </p>
                    <p className="text-[10px] text-red-300 font-mono">
                      {lastEvent.from} ➔ {lastEvent.to}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
