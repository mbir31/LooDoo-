import React from 'react';
import { UserProfile, Language } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { soundFx, isSoundEnabled, setSoundEnabled, folkMusicEngine } from '../../utils/sound';
import { Volume2, VolumeX, Globe, User, LogIn, Sparkles, BookOpen, Music } from 'lucide-react';

interface HeaderProps {
  user: UserProfile | null;
  language: Language;
  onLanguageToggle: () => void;
  onEditProfile: () => void;
  onGoogleSignIn: () => void;
  onHowToPlay: () => void;
  roomCode?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  language,
  onLanguageToggle,
  onEditProfile,
  onGoogleSignIn,
  onHowToPlay,
  roomCode,
}) => {
  const [soundOn, setSoundOn] = React.useState(isSoundEnabled());
  const [musicOn, setMusicOn] = React.useState(folkMusicEngine.isPlayingState());

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    soundFx.click();
  };

  const handleToggleMusic = () => {
    soundFx.click();
    const isNowPlaying = folkMusicEngine.toggle();
    setMusicOn(isNowPlaying);
  };

  return (
    <header className="w-full bg-black/95 backdrop-blur-md border-b border-neutral-900 px-2 sm:px-4 py-1.5 flex items-center justify-between z-30 sticky top-0 gap-1.5">
      {/* Minimized Ultra-Compact Brand Badge */}
      <div className="flex items-center gap-1.5 shrink-0" title="LooDoo : লুডু">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-red-500/80 via-amber-500/80 to-emerald-500/80 p-0.5 shadow-sm flex items-center justify-center">
          <div className="w-full h-full bg-black rounded-[6px] flex items-center justify-center font-black text-amber-400 text-xs sm:text-sm select-none">
            🎲
          </div>
        </div>
        <span className="hidden md:inline font-black text-xs tracking-tight bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
          LooDoo
        </span>
      </div>

      {/* Right Controls - Space-Optimized and fully visible */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-x-auto no-scrollbar py-0.5">
        {/* Procedural Bangla Folk Music Engine Toggle */}
        <button
          id="folk-music-toggle-btn"
          onClick={handleToggleMusic}
          className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all cursor-pointer shrink-0 ${
            musicOn
              ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-sm animate-pulse'
              : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
          }`}
          title={musicOn ? 'Stop Folk Music' : 'Play Bangla Folk Music (ভাটিয়ালি/বাউল সুর)'}
        >
          <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Sound Toggle */}
        <button
          id="sound-toggle-btn"
          onClick={handleToggleSound}
          className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-white hover:border-emerald-500/40 hover:bg-neutral-900 transition-all cursor-pointer shrink-0"
          title={getTranslation(language, 'soundEffects')}
        >
          {soundOn ? (
            <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500" />
          )}
        </button>

        {/* Rules Button */}
        <button
          id="how-to-play-header-btn"
          onClick={() => {
            soundFx.click();
            onHowToPlay();
          }}
          className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-white hover:border-amber-500/40 hover:bg-neutral-900 transition-all cursor-pointer shrink-0"
          title={getTranslation(language, 'howToPlay')}
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
        </button>

        {/* Language Switcher (Bangla / English) */}
        <button
          id="language-toggle-btn"
          onClick={() => {
            soundFx.click();
            onLanguageToggle();
          }}
          className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/40 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition-all flex items-center gap-1 cursor-pointer shadow-sm shrink-0"
          title="Toggle Language"
        >
          <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>{language === 'bn' ? 'বাং' : 'EN'}</span>
        </button>

        {/* User Profile Pill or Sign in button */}
        {user ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              id="user-profile-btn"
              onClick={() => {
                soundFx.click();
                onEditProfile();
              }}
              className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-lg sm:rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-400 hover:bg-neutral-900 transition-all cursor-pointer shadow-sm shrink-0"
            >
              <span className="text-sm sm:text-base">{user.avatar || '👤'}</span>
              <span className="text-[11px] sm:text-xs font-bold text-white max-w-[60px] xs:max-w-[80px] sm:max-w-[120px] truncate">
                {user.displayName}
              </span>
            </button>

            {user.isAnonymous && (
              <button
                id="google-signin-btn"
                onClick={() => {
                  soundFx.click();
                  onGoogleSignIn();
                }}
                className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/40 text-blue-300 text-[11px] sm:text-xs font-bold hover:brightness-125 transition-all cursor-pointer shrink-0"
                title={getTranslation(language, 'googleLogin')}
              >
                <LogIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Sign in</span>
              </button>
            )}
          </div>
        ) : (
          <button
            id="header-google-signin-btn"
            onClick={() => {
              soundFx.click();
              onGoogleSignIn();
            }}
            className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-neutral-950 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0"
            title={getTranslation(language, 'googleLogin')}
          >
            <LogIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{language === 'bn' ? 'লগইন' : 'Sign in'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
