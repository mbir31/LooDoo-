import React, { useState } from 'react';
import { UserProfile, Language } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { joinRoom } from '../../services/gameService';
import { soundFx } from '../../utils/sound';
import { X, LogIn, KeyRound, Loader2 } from 'lucide-react';

interface JoinRoomModalProps {
  user: UserProfile;
  language: Language;
  initialCode?: string;
  onJoined: (roomId: string) => void;
  onClose: () => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  user,
  language,
  initialCode = '',
  onJoined,
  onClose,
}) => {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const cleanCode = code.trim();
    if (!cleanCode) return;

    soundFx.click();
    setLoading(true);
    setError(null);

    try {
      const result = await joinRoom(cleanCode, user);
      onJoined(result.roomId);
    } catch (err: any) {
      if (err.message === 'errorRoomNotFound') {
        setError(getTranslation(language, 'errorRoomNotFound'));
      } else if (err.message === 'errorRoomFull') {
        setError(getTranslation(language, 'errorRoomFull'));
      } else {
        setError(err.message || 'Failed to join room');
      }
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <LogIn className="w-4 h-4" />
            </div>
            <h3 className="font-black text-lg bg-gradient-to-r from-white via-neutral-100 to-emerald-200 bg-clip-text text-transparent">
              {getTranslation(language, 'joinRoom')}
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

        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>{getTranslation(language, 'roomCode')}</span>
            </label>
            <input
              type="text"
              maxLength={10}
              disabled={loading}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="bg-black border border-neutral-700/80 rounded-xl px-4 py-3 text-center text-xl sm:text-2xl font-mono font-black tracking-widest text-amber-400 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-400 disabled:opacity-60"
              placeholder="enter room number"
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/50 border border-red-800 p-2.5 rounded-xl">
              {error}
            </div>
          )}

          {/* Buttons */}
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
              disabled={loading || !code.trim()}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-neutral-950 font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{getTranslation(language, 'joiningRoom')}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{getTranslation(language, 'join')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
