import React from 'react';
import { Language } from '../../types';
import { X, Share, PlusSquare, Smartphone, Check, Sparkles, Download, ArrowDown } from 'lucide-react';
import { soundFx } from '../../utils/sound';

interface InstallPwaModalProps {
  language: Language;
  isIOS: boolean;
  onClose: () => void;
}

export const InstallPwaModal: React.FC<InstallPwaModalProps> = ({
  language,
  isIOS,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-left relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center text-xl">
                🎲
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>{language === 'bn' ? 'লুডু অ্যাপ ইনস্টল করুন' : 'Install LooDoo App'}</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-xs text-neutral-400">
                {language === 'bn' ? 'হোম স্ক্রিনে ১-ট্যাপে যুক্ত করুন' : 'Add to your Home Screen in 1 step'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundFx.click();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Details */}
        <div className="flex flex-col gap-3 py-1">
          <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-200">
                {language === 'bn' ? 'সম্পূর্ণ ফুল-স্ক্রিন অ্যাপ অভিজ্ঞতা' : 'Native Full-Screen App Experience'}
              </p>
              <p className="text-[11px] text-neutral-400">
                {language === 'bn' ? 'ব্রাউজার বার ছাড়া দ্রুত ওপেন ও খেলুন' : 'No browser bars, instant launch & fast gameplay'}
              </p>
            </div>
          </div>

          {isIOS ? (
            /* iOS Safari Instructions */
            <div className="flex flex-col gap-2.5 bg-black/60 border border-neutral-800 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>iPhone / iPad (Safari)</span>
              </p>
              <ol className="text-xs text-neutral-300 flex flex-col gap-2 list-decimal list-inside">
                <li className="flex items-center gap-2">
                  <span className="font-bold text-amber-400">1.</span>
                  <span>{language === 'bn' ? 'সাফারির নিচে' : 'Tap Safari\'s'}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-white font-medium text-[11px]">
                    <Share className="w-3 h-3 text-sky-400" /> Share
                  </span>
                  <span>{language === 'bn' ? 'আইকনে চাপ দিন' : 'button'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold text-amber-400">2.</span>
                  <span>{language === 'bn' ? 'তালিকা থেকে' : 'Scroll down & tap'}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-white font-medium text-[11px]">
                    <PlusSquare className="w-3 h-3 text-emerald-400" /> Add to Home Screen
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold text-amber-400">3.</span>
                  <span>{language === 'bn' ? 'উপরে "Add" চাপলেই হোম স্ক্রিনে চলে আসবে!' : 'Tap "Add" in the top corner!'}</span>
                </li>
              </ol>
            </div>
          ) : (
            /* Android / Desktop Chrome Instructions */
            <div className="flex flex-col gap-2.5 bg-black/60 border border-neutral-800 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>Android / Chrome / Edge</span>
              </p>
              <ol className="text-xs text-neutral-300 flex flex-col gap-2 list-decimal list-inside">
                <li className="flex items-center gap-2">
                  <span className="font-bold text-amber-400">1.</span>
                  <span>{language === 'bn' ? 'ব্রাউজারের উপরের ডানদিকের (⋮) মেন্যুতে চাপুন' : 'Tap browser menu (⋮) in top right'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold text-amber-400">2.</span>
                  <span>{language === 'bn' ? 'নির্বাচন করুন' : 'Select'}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-white font-medium text-[11px]">
                    <Download className="w-3 h-3 text-amber-400" /> {language === 'bn' ? 'Install app / Add to Home screen' : 'Install app / Add to Home screen'}
                  </span>
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            soundFx.click();
            onClose();
          }}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:brightness-110 active:scale-98"
        >
          <Check className="w-4 h-4" />
          <span>{language === 'bn' ? 'বুঝেছি (Got It)' : 'Got It!'}</span>
        </button>
      </div>
    </div>
  );
};
