import React from 'react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { usePWAInstall } from '../../utils/usePWAInstall';
import { InstallPwaModal } from './InstallPwaModal';
import { soundFx } from '../../utils/sound';
import { Download, Smartphone, CheckCircle, Sparkles } from 'lucide-react';

interface InstallPwaButtonProps {
  language: Language;
  variant?: 'compact' | 'prominent' | 'floating' | 'banner';
  className?: string;
}

export const InstallPwaButton: React.FC<InstallPwaButtonProps> = ({
  language,
  variant = 'prominent',
  className = '',
}) => {
  const {
    isInstalled,
    isIOS,
    showInstructionsModal,
    setShowInstructionsModal,
    triggerInstall,
  } = usePWAInstall();

  const handleInstallClick = async () => {
    soundFx.click();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(30);
      } catch {}
    }
    await triggerInstall();
  };

  // If already installed, we can render a subtle installed badge or null in compact mode
  if (isInstalled) {
    if (variant === 'compact') {
      return (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-1 rounded-xl">
          <CheckCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{getTranslation(language, 'appInstalled')}</span>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      {/* Variant 1: Compact Button (Ideal for Navigation Header or Toolbars) */}
      {variant === 'compact' && (
        <button
          id="install-pwa-compact-btn"
          onClick={handleInstallClick}
          className={`px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-400/80 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-amber-500/10 active:scale-95 ${className}`}
          title={getTranslation(language, 'installApp')}
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
          <span className="text-[11px] sm:text-xs whitespace-nowrap">
            {language === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install App'}
          </span>
        </button>
      )}

      {/* Variant 2: Dedicated Prominent Button (Ideal for Home Screen / Lobby) */}
      {variant === 'prominent' && (
        <button
          id="install-pwa-home-btn"
          onClick={handleInstallClick}
          className={`w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/20 to-amber-500/15 hover:from-amber-500/25 hover:to-orange-500/30 border border-amber-500/50 hover:border-amber-400 text-amber-200 hover:text-white flex items-center justify-between gap-3 cursor-pointer transition-all shadow-lg shadow-amber-500/10 active:scale-[0.99] group ${className}`}
        >
          <div className="flex items-center gap-2.5 text-left min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-0.5 shadow-md flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-black rounded-[10px] flex items-center justify-center text-sm">
                🎲
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black text-amber-300 group-hover:text-amber-200 truncate">
                  {getTranslation(language, 'installApp')}
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </div>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 truncate">
                {getTranslation(language, 'installAppDesc')}
              </span>
            </div>
          </div>

          <div className="px-2.5 py-1 rounded-xl bg-amber-400 text-neutral-950 font-black text-[11px] sm:text-xs flex items-center gap-1 shrink-0 shadow group-hover:bg-amber-300 transition-colors">
            <Download className="w-3 h-3" />
            <span>1-Tap</span>
          </div>
        </button>
      )}

      {/* Variant 3: Floating / Mini Banner */}
      {variant === 'banner' && (
        <div
          onClick={handleInstallClick}
          className={`cursor-pointer w-full p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 hover:bg-amber-900/40 text-amber-300 text-xs flex items-center justify-between gap-2 transition-all shadow-sm ${className}`}
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-[11px] sm:text-xs">
              {language === 'bn' ? 'হোম স্ক্রিনে লুডু অ্যাপ ইনস্টল করুন' : 'Install LooDoo App on Home Screen'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-black text-[10px] font-bold">
            Install
          </span>
        </div>
      )}

      {/* Step-by-step instruction modal when native beforeinstallprompt is not directly fired */}
      {showInstructionsModal && (
        <InstallPwaModal
          language={language}
          isIOS={isIOS}
          onClose={() => setShowInstructionsModal(false)}
        />
      )}
    </>
  );
};
