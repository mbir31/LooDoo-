import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { GameHistoryRecord, Language } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { X, Trophy, History, Calendar, Clock, Medal } from 'lucide-react';

interface RoomHistoryModalProps {
  roomId: string;
  language: Language;
  onClose: () => void;
}

export const RoomHistoryModal: React.FC<RoomHistoryModalProps> = ({
  roomId,
  language,
  onClose,
}) => {
  const [historyList, setHistoryList] = useState<GameHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const q = query(
          collection(db, 'rooms', roomId, 'history'),
          orderBy('playedAt', 'desc'),
          limit(10)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => d.data() as GameHistoryRecord);
        setHistoryList(list);
      } catch (e) {
        console.error('Failed to load history:', e);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [roomId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <History className="w-4 h-4" />
            </div>
            <h3 className="font-black text-lg bg-gradient-to-r from-white via-neutral-100 to-amber-200 bg-clip-text text-transparent">
              {getTranslation(language, 'myRooms')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="py-12 text-center text-neutral-500 text-sm">
              Loading match history...
            </div>
          ) : historyList.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-sm italic">
              No completed matches in this room yet.
            </div>
          ) : (
            historyList.map((item) => (
              <div
                key={item.gameId}
                className="bg-black border border-neutral-800 p-3.5 rounded-2xl flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-sm text-white">
                      {item.winnerName}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      Winner
                    </span>
                  </div>

                  <span className="text-xs text-neutral-500 font-mono">
                    {Math.floor(item.durationSeconds / 60)}m {item.durationSeconds % 60}s
                  </span>
                </div>

                {/* Players involved */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-400 mt-1">
                  {item.players.map((p) => (
                    <span
                      key={p.uid}
                      className="px-2 py-1 bg-neutral-900 rounded-lg border border-neutral-800"
                    >
                      {p.displayName} ({p.tokensHome}/4)
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
