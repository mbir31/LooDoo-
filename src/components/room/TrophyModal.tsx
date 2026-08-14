import React from 'react';
import { UserProfile, Language } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { calculateLevel, ALL_TROPHIES } from '../../utils/progression';
import { soundFx } from '../../utils/sound';
import { X, Trophy, Award, Flame, Zap, Crown, Check, Lock, Swords, Sparkles } from 'lucide-react';

interface TrophyModalProps {
  user: UserProfile;
  language: Language;
  onClose: () => void;
}

export const TrophyModal: React.FC<TrophyModalProps> = ({ user, language, onClose }) => {
  const stats = user.stats || {
    wins: 0,
    matchesPlayed: 0,
    sixesRolled: 0,
    capturesMade: 0,
    winStreak: 0,
    longestStreak: 0,
    xp: 0,
    level: 1,
    trophies: [],
  };

  const levelInfo = calculateLevel(stats.xp || 0);
  const earnedTrophies = new Set(stats.trophies || []);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-4 h-4" />
            </div>
            <h3 className="font-black text-lg bg-gradient-to-r from-white via-neutral-100 to-amber-200 bg-clip-text text-transparent">
              {language === 'bn' ? 'অর্জন ও ট্রফি (Trophies)' : 'Trophies & Badges'}
            </h3>
          </div>
          <button
            onClick={() => {
              soundFx.click();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level Rank Banner */}
        <div className="relative rounded-2xl bg-gradient-to-br from-amber-950/40 via-black to-neutral-950 border-2 border-amber-500/40 p-4 shadow-xl flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center text-2xl shadow-lg border-2 border-white/40">
                {user.avatar || '👑'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-amber-400 text-neutral-950 text-[10px] font-black uppercase">
                    Level {levelInfo.level}
                  </span>
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <h4 className="font-black text-base text-white mt-0.5">
                  {language === 'bn' ? levelInfo.titleBn : levelInfo.titleEn}
                </h4>
              </div>
            </div>

            {/* Win Streak Badge */}
            {(stats.winStreak || 0) > 0 && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-500/20 border border-orange-500/50 text-orange-300">
                <Flame className="w-4 h-4 text-orange-400 fill-orange-400 animate-bounce" />
                <span className="text-xs font-black">{stats.winStreak} Streak</span>
              </div>
            )}
          </div>

          {/* XP Progress Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-semibold text-neutral-400">
              <span>XP: {levelInfo.currentXp}</span>
              <span>Next Level: {levelInfo.nextLevelXp} XP</span>
            </div>
            <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${levelInfo.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-black border border-neutral-800 p-2.5 rounded-xl text-center">
            <p className="text-[10px] text-neutral-400">{language === 'bn' ? 'ম্যাচ' : 'Matches'}</p>
            <p className="text-base font-black text-white">{stats.matchesPlayed || 0}</p>
          </div>
          <div className="bg-black border border-neutral-800 p-2.5 rounded-xl text-center">
            <p className="text-[10px] text-neutral-400">{language === 'bn' ? 'জয়' : 'Wins'}</p>
            <p className="text-base font-black text-amber-400">{stats.wins || 0}</p>
          </div>
          <div className="bg-black border border-neutral-800 p-2.5 rounded-xl text-center">
            <p className="text-[10px] text-neutral-400">{language === 'bn' ? 'ছক্কা' : 'Sixes'}</p>
            <p className="text-base font-black text-emerald-400">{stats.sixesRolled || 0}</p>
          </div>
          <div className="bg-black border border-neutral-800 p-2.5 rounded-xl text-center">
            <p className="text-[10px] text-neutral-400">{language === 'bn' ? 'কাটাকাটি' : 'Captures'}</p>
            <p className="text-base font-black text-rose-400">{stats.capturesMade || 0}</p>
          </div>
        </div>

        {/* Trophy Showcase List */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-300">
              {language === 'bn' ? 'ট্রফি সংগ্রহশালা' : 'Trophies Collected'}
            </span>
            <span className="text-xs font-mono text-amber-400 font-bold">
              {earnedTrophies.size} / {ALL_TROPHIES.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1">
            {ALL_TROPHIES.map((t) => {
              const isUnlocked = earnedTrophies.has(t.id);

              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                    isUnlocked
                      ? 'bg-neutral-900/90 border-amber-500/50 shadow-md shadow-amber-500/10'
                      : 'bg-black/60 border-neutral-800/80 opacity-60'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md border ${
                      isUnlocked
                        ? `bg-gradient-to-br ${t.badgeColor} border-white/40`
                        : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                    }`}
                  >
                    {isUnlocked ? t.icon : '🔒'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-white truncate">
                        {language === 'bn' ? t.titleBn : t.titleEn}
                      </p>
                      {isUnlocked ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                          <Check className="w-3 h-3" />
                          {language === 'bn' ? 'অর্জিত' : 'Unlocked'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold">
                          <Lock className="w-3 h-3" />
                          {language === 'bn' ? 'লকড' : 'Locked'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-2">
                      {language === 'bn' ? t.descBn : t.descEn}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => {
            soundFx.click();
            onClose();
          }}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-black text-sm shadow-lg shadow-amber-500/25 cursor-pointer hover:brightness-110 active:scale-95 transition-all"
        >
          {language === 'bn' ? 'ঠিক আছে' : 'Got It'}
        </button>
      </div>
    </div>
  );
};
