import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { GameDocument, RoomPlayer, Language, PlayerColor } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { Clock, Sparkles, AlertCircle, Trophy, Swords } from 'lucide-react';
import { handleTurnTimeout } from '../../services/gameService';

interface TurnIndicatorProps {
  game: GameDocument;
  players: Record<string, RoomPlayer>;
  myUid: string;
  language: Language;
}

const COLOR_TEXT: Record<PlayerColor, string> = {
  red: 'text-red-500',
  green: 'text-emerald-500',
  yellow: 'text-amber-400',
  blue: 'text-blue-500',
};

export const TurnIndicator: React.FC<TurnIndicatorProps> = ({
  game,
  players,
  myUid,
  language,
}) => {
  const [timeLeft, setTimeLeft] = useState(30);

  const currentPlayer = players[game.currentPlayerUid];
  const isMyTurn = game.currentPlayerUid === myUid;
  const playerColor = currentPlayer?.color || 'red';

  useEffect(() => {
    const checkTimer = () => {
      const remaining = Math.max(0, Math.ceil((game.turnExpiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);

      // Auto trigger timeout pass if turn expired by >2s and this user is current player or admin
      if (remaining === 0 && game.status !== 'GAME_OVER') {
        handleTurnTimeout(game.roomId, game.gameId).catch(() => {});
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [game.turnExpiresAt, game.roomId, game.gameId, game.status]);

  const totalTime = 30;
  const progressPercent = Math.min(100, Math.max(0, (timeLeft / totalTime) * 100));

  // Determine message icon
  const msgType = game.turnMessage?.type || 'info';

  return (
    <div className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 shadow-lg flex flex-col gap-2">
      {/* Top Row: Turn Info & Timer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl sm:text-2xl">{currentPlayer?.avatar || '👤'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`font-black text-sm sm:text-base truncate ${COLOR_TEXT[playerColor]}`}
              >
                {isMyTurn
                  ? getTranslation(language, 'yourTurn')
                  : getTranslation(language, 'waitingForTurn', {
                      name: currentPlayer?.displayName || 'Player',
                    })}
              </span>
            </div>
          </div>
        </div>

        {/* Turn Timer Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
            timeLeft <= 5
              ? 'bg-red-950/80 border-red-500 text-red-400 animate-pulse'
              : 'bg-neutral-900 border-neutral-750 text-neutral-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{timeLeft}s</span>
        </div>
      </div>

      {/* Timer Progress Bar */}
      <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full transition-all duration-300 ${
            timeLeft <= 5 ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-500 to-amber-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Game Turn Announcement Message */}
      {game.turnMessage && (
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
            msgType === 'penalty'
              ? 'bg-red-950/60 text-red-300 border border-red-800/60'
              : msgType === 'capture'
              ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
              : msgType === 'six'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
              : msgType === 'win'
              ? 'bg-amber-900/60 text-amber-200 border border-amber-700'
              : 'bg-stone-800/60 text-stone-300'
          }`}
        >
          {msgType === 'penalty' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {msgType === 'capture' && <Swords className="w-4 h-4 text-amber-400 shrink-0" />}
          {msgType === 'six' && <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />}
          {msgType === 'win' && <Trophy className="w-4 h-4 text-amber-400 shrink-0" />}
          <span className="truncate">
            {language === 'bn' ? game.turnMessage.bn : game.turnMessage.en}
          </span>
        </div>
      )}
    </div>
  );
};
