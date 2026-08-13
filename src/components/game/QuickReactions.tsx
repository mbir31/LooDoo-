import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, ReactionEvent } from '../../types';
import { sendReaction } from '../../services/gameService';
import { soundFx } from '../../utils/sound';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Smile, Volume2, Sparkles, MessageSquare } from 'lucide-react';

interface QuickReactionsProps {
  roomId: string;
  user: UserProfile;
}

const EMOJI_LIST = ['👍', '😂', '😮', '❤️', '👏', '🎉', '🔥', '🎲', '😎', '💀', '😱', '👑'];

const BANGLA_TAUNTS = [
  { id: 'taunt1', emoji: '⚔️', textBn: 'ঘুঁটি কাটার ওস্তাদ আমি!', textEn: 'I am the capture master!' },
  { id: 'taunt2', emoji: '🎲', textBn: 'ছক্কা ছাড়া গতি নেই!', textEn: 'No progress without a six!' },
  { id: 'taunt3', emoji: '⚠️', textBn: 'একটু সাবধানে চালিস ভাই!', textEn: 'Play carefully brother!' },
  { id: 'taunt4', emoji: '🏆', textBn: 'জিতবো কিন্তু আজ আমিই!', textEn: 'Victory will be mine today!' },
  { id: 'taunt5', emoji: '😲', textBn: 'আরে ভাই কি চাল দিলেন!', textEn: 'What a move, brother!' },
  { id: 'taunt6', emoji: '🎯', textBn: 'এইবার তোর ঘুঁটি গেল!', textEn: 'Your token is doomed!' },
  { id: 'taunt7', emoji: '👑', textBn: 'লুডু খেলার রাজা আমি!', textEn: 'I am the King of Ludo!' },
  { id: 'taunt8', emoji: '🏃', textBn: 'পালাবি কোথায় এবার?', textEn: 'Where will you run now?' },
];

export const QuickReactions: React.FC<QuickReactionsProps> = ({ roomId, user }) => {
  const [activeReactions, setActiveReactions] = useState<Array<ReactionEvent & { key: string }>>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [tab, setTab] = useState<'emoji' | 'taunts'>('taunts');

  useEffect(() => {
    const q = query(
      collection(db, 'rooms', roomId, 'reactions'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as ReactionEvent;
          // Only show recent reactions (last 6 seconds)
          if (Date.now() - data.timestamp < 6000) {
            const reactionItem = { ...data, key: `${data.id}_${Date.now()}` };
            setActiveReactions((prev) => [...prev.slice(-4), reactionItem]);

            // If taunt attached, trigger audio taunt speech & synth flourish
            if (data.tauntTextBn) {
              soundFx.playTaunt(data.tauntTextBn);
            }

            setTimeout(() => {
              setActiveReactions((prev) => prev.filter((r) => r.key !== reactionItem.key));
            }, 3500);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [roomId]);

  const handleSendEmoji = async (emoji: string) => {
    soundFx.click();
    setShowPicker(false);
    await sendReaction(roomId, user, emoji);
  };

  const handleSendTaunt = async (t: typeof BANGLA_TAUNTS[0]) => {
    soundFx.click();
    setShowPicker(false);
    await sendReaction(roomId, user, t.emoji, {
      id: t.id,
      textBn: t.textBn,
      textEn: t.textEn,
    });
  };

  return (
    <>
      {/* Floating Reaction Animations & Bangla Speech Bubbles over board */}
      <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
        <AnimatePresence>
          {activeReactions.map((r, idx) => (
            <motion.div
              key={r.key}
              initial={{ y: 80, opacity: 0, scale: 0.6 }}
              animate={{ y: -110 - idx * 35, opacity: 1, scale: 1.15 }}
              exit={{ y: -190, opacity: 0, scale: 0.8 }}
              transition={{ duration: 3, ease: 'easeOut' }}
              className="absolute bg-neutral-900/95 border-2 border-amber-400/80 px-4 py-2 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.85)] flex flex-col items-center gap-1 backdrop-blur-md"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl animate-bounce">{r.emoji}</span>
                <span className="text-xs font-black text-amber-300 max-w-[120px] truncate">
                  {r.displayName}
                </span>
              </div>
              {r.tauntTextBn && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 rounded-lg border border-amber-400/40">
                  <Volume2 className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span className="text-xs font-bold text-amber-100 font-serif">
                    {r.tauntTextBn}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Emoji / Taunt Trigger & Popover Drawer */}
      <div className="relative">
        <button
          id="quick-reactions-btn"
          onClick={() => setShowPicker(!showPicker)}
          className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 border border-amber-400/60 text-white hover:brightness-110 transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold ring-1 ring-amber-300/30"
          title="Reactions & Voice Taunts"
        >
          <Sparkles className="w-4 h-4 text-amber-200" />
          <span className="hidden sm:inline">Taunts & Chat</span>
        </button>

        {showPicker && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="absolute bottom-12 right-0 w-[290px] sm:w-[320px] bg-neutral-900 border-2 border-neutral-700 rounded-2xl p-3 shadow-2xl z-40 flex flex-col gap-2.5 backdrop-blur-xl"
          >
            {/* Header Tabs */}
            <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => setTab('taunts')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  tab === 'taunts'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                বাংলা ডায়লগ (Voice)
              </button>
              <button
                type="button"
                onClick={() => setTab('emoji')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  tab === 'emoji'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                ইমোজি
              </button>
            </div>

            {/* Tab 1: Bangla Voice Taunts */}
            {tab === 'taunts' && (
              <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {BANGLA_TAUNTS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSendTaunt(t)}
                    className="w-full text-left p-2 rounded-xl bg-neutral-800/80 hover:bg-amber-950/60 border border-neutral-700 hover:border-amber-500/60 flex items-center gap-2.5 transition-all text-xs font-medium text-neutral-200 hover:text-amber-200 group cursor-pointer"
                  >
                    <span className="text-lg group-hover:scale-125 transition-transform">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-xs truncate">{t.textBn}</p>
                      <p className="text-[10px] text-neutral-400 truncate">{t.textEn}</p>
                    </div>
                    <Volume2 className="w-3.5 h-3.5 text-neutral-500 group-hover:text-amber-400" />
                  </button>
                ))}
              </div>
            )}

            {/* Tab 2: Standard Emojis */}
            {tab === 'emoji' && (
              <div className="grid grid-cols-6 gap-2">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendEmoji(emoji)}
                    className="w-10 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center text-xl transition-transform hover:scale-125 active:scale-90 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </>
  );
};

