import React from 'react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { X, BookOpen, Sparkles, AlertTriangle, Swords, Shield, Target, Trophy } from 'lucide-react';

interface HowToPlayModalProps {
  language: Language;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  language,
  onClose,
}) => {
  const rules = [
    {
      icon: Sparkles,
      color: 'text-amber-400',
      title: getTranslation(language, 'rule1Title'),
      desc: getTranslation(language, 'rule1Desc'),
    },
    {
      icon: Sparkles,
      color: 'text-emerald-400',
      title: getTranslation(language, 'rule2Title'),
      desc: getTranslation(language, 'rule2Desc'),
    },
    {
      icon: AlertTriangle,
      color: 'text-red-400',
      title: getTranslation(language, 'rule3Title'),
      desc: getTranslation(language, 'rule3Desc'),
      highlight: true,
    },
    {
      icon: Swords,
      color: 'text-amber-400',
      title: getTranslation(language, 'rule4Title'),
      desc: getTranslation(language, 'rule4Desc'),
    },
    {
      icon: Shield,
      color: 'text-blue-400',
      title: getTranslation(language, 'rule5Title'),
      desc: getTranslation(language, 'rule5Desc'),
    },
    {
      icon: Target,
      color: 'text-purple-400',
      title: getTranslation(language, 'rule6Title'),
      desc: getTranslation(language, 'rule6Desc'),
    },
    {
      icon: Trophy,
      color: 'text-amber-400',
      title: getTranslation(language, 'rule7Title'),
      desc: getTranslation(language, 'rule7Desc'),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="font-black text-lg bg-gradient-to-r from-white via-neutral-100 to-amber-200 bg-clip-text text-transparent">
              {getTranslation(language, 'howToPlayTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rules List */}
        <div className="flex flex-col gap-3 overflow-y-auto pr-1">
          {rules.map((rule, idx) => {
            const Icon = rule.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-2xl border border-neutral-850 bg-black flex items-start gap-3"
              >
                <div className={`p-2 rounded-xl bg-neutral-900 border border-neutral-800 shrink-0 ${rule.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <h4 className="text-sm font-bold text-white">
                    {rule.title}
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {rule.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-neutral-950 font-black text-sm shadow-lg shadow-amber-500/25 cursor-pointer transition-all active:scale-95"
        >
          {language === 'bn' ? 'বুঝেছি' : 'Got it'}
        </button>
      </div>
    </div>
  );
};
