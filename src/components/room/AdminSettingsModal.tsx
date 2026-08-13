import React, { useState } from 'react';
import { RoomDocument, RoomPlayer, Language, PlayerColor } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { updatePlayerConfig } from '../../services/gameService';
import { soundFx } from '../../utils/sound';
import { X, Check, Shield, User } from 'lucide-react';

interface AdminSettingsModalProps {
  room: RoomDocument;
  players: Record<string, RoomPlayer>;
  language: Language;
  onClose: () => void;
}

const COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  room,
  players,
  language,
  onClose,
}) => {
  const [editingPlayers, setEditingPlayers] = useState<Record<string, { displayName: string; color: PlayerColor }>>(() => {
    const init: Record<string, { displayName: string; color: PlayerColor }> = {};
    (Object.values(players) as RoomPlayer[]).forEach((p) => {
      init[p.uid] = { displayName: p.displayName, color: p.color };
    });
    return init;
  });
  const [saving, setSaving] = useState(false);

  const handleColorSelect = (uid: string, color: PlayerColor) => {
    soundFx.click();
    setEditingPlayers((prev) => ({
      ...prev,
      [uid]: { ...prev[uid], color },
    }));
  };

  const handleNameChange = (uid: string, name: string) => {
    setEditingPlayers((prev) => ({
      ...prev,
      [uid]: { ...prev[uid], displayName: name },
    }));
  };

  const handleSave = async () => {
    soundFx.click();
    setSaving(true);
    try {
      for (const [uid, config] of Object.entries(editingPlayers) as [string, { displayName: string; color: PlayerColor }][]) {
        await updatePlayerConfig(room.roomId, uid, {
          displayName: config.displayName.trim().slice(0, 20),
          color: config.color,
        });
      }
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="font-black text-lg bg-gradient-to-r from-white via-neutral-100 to-amber-200 bg-clip-text text-transparent">
              {getTranslation(language, 'adminControls')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Players Configuration */}
        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {(Object.values(players) as RoomPlayer[])
            .filter((p) => p.status === 'active')
            .map((player) => {
              const currentConfig = editingPlayers[player.uid] || {
                displayName: player.displayName,
                color: player.color,
              };

              return (
                <div
                  key={player.uid}
                  className="bg-black border border-neutral-800 p-3 rounded-xl flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                    <span>{player.slot}</span>
                    <span>•</span>
                    <span>{player.uid === room.adminUid ? 'Admin' : 'Player'}</span>
                  </div>

                  {/* Name Input */}
                  <input
                    type="text"
                    maxLength={20}
                    value={currentConfig.displayName}
                    onChange={(e) => handleNameChange(player.uid, e.target.value)}
                    className="bg-neutral-900 border border-neutral-750 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-400 font-medium"
                    placeholder="Player Name"
                  />

                  {/* Color Select */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-neutral-400">
                      {getTranslation(language, 'selectColor')}:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleColorSelect(player.uid, c)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-95 cursor-pointer ${
                            c === 'red'
                              ? 'bg-red-500'
                              : c === 'green'
                              ? 'bg-emerald-500'
                              : c === 'yellow'
                              ? 'bg-amber-400'
                              : 'bg-blue-500'
                          } ${
                            currentConfig.color === c
                              ? 'border-white scale-110 shadow-md ring-2 ring-white/50'
                              : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 text-sm font-semibold cursor-pointer transition-colors"
          >
            {getTranslation(language, 'cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-neutral-950 font-black text-sm shadow-lg shadow-amber-500/25 cursor-pointer transition-all active:scale-95"
          >
            {saving ? 'Saving...' : getTranslation(language, 'save')}
          </button>
        </div>
      </div>
    </div>
  );
};
