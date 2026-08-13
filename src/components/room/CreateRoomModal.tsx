import React, { useState } from 'react';
import { UserProfile, Language, RoomSettings, GameMode } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { createRoom } from '../../services/gameService';
import { soundFx } from '../../utils/sound';
import { X, PlusCircle, Users, Clock, Loader2, Sparkles, Shield, Zap } from 'lucide-react';

interface CreateRoomModalProps {
  user: UserProfile;
  language: Language;
  onRoomCreated: (roomId: string, roomCode: string, gameMode?: GameMode) => void;
  onClose: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  user,
  language,
  onRoomCreated,
  onClose,
}) => {
  const [gameMode, setGameMode] = useState<GameMode>('CLASSIC');
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4);
  const [turnTimeout, setTurnTimeout] = useState<number>(30);
  const [strictThreeSix, setStrictThreeSix] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    soundFx.click();
    setLoading(true);
    setError(null);

    try {
      const customSettings: Partial<RoomSettings> = {
        maxPlayers,
        turnTimeoutSeconds: turnTimeout,
        strictThreeSixRule: strictThreeSix,
        gameMode,
        tokensToWin: gameMode === 'RUSH' ? 2 : 4,
      };

      const result = await createRoom(user, maxPlayers, customSettings);
      onRoomCreated(result.roomId, result.roomCode, gameMode);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500/20 via-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <PlusCircle className="w-4 h-4" />
            </div>
            <h3 className="font-black text-lg bg-gradient-to-r from-white via-neutral-100 to-amber-200 bg-clip-text text-transparent">
              {getTranslation(language, 'createRoom')}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-neutral-900 disabled:opacity-50 text-neutral-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {/* Game Mode Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{getTranslation(language, 'gameMode')}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  soundFx.click();
                  setGameMode('CLASSIC');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  gameMode === 'CLASSIC'
                    ? 'bg-amber-950/40 border-amber-400 text-white shadow-md'
                    : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <p className="font-black text-xs text-white">{getTranslation(language, 'modeClassic')}</p>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">{getTranslation(language, 'modeClassicDesc')}</p>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  soundFx.click();
                  setGameMode('RUSH');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  gameMode === 'RUSH'
                    ? 'bg-rose-950/40 border-rose-400 text-white shadow-md'
                    : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-rose-400" />
                  <p className="font-black text-xs text-white">{getTranslation(language, 'modeRush')}</p>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">{getTranslation(language, 'modeRushDesc')}</p>
              </button>
            </div>
          </div>

          {/* Max Players Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>{getTranslation(language, 'playerSlots')}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    soundFx.click();
                    setMaxPlayers(num as 2 | 3 | 4);
                  }}
                  className={`py-2.5 rounded-xl font-black text-sm border transition-all cursor-pointer disabled:opacity-60 ${
                    maxPlayers === num
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-black border-neutral-800 text-neutral-300 hover:bg-neutral-900'
                  }`}
                >
                  {num} {language === 'bn' ? 'খেলোয়াড়' : 'Players'}
                </button>
              ))}
            </div>
          </div>

          {/* Turn Timeout Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{getTranslation(language, 'turnTimeRemaining')}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[20, 30, 45].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    soundFx.click();
                    setTurnTimeout(sec);
                  }}
                  className={`py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer disabled:opacity-60 ${
                    turnTimeout === sec
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-neutral-950 border-cyan-400'
                      : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-900'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/50 border border-red-800 p-2.5 rounded-xl">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-800 text-neutral-300 text-sm font-semibold cursor-pointer transition-colors"
            >
              {getTranslation(language, 'cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-emerald-600 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{getTranslation(language, 'creatingRoom')}</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>{getTranslation(language, 'createRoom')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
