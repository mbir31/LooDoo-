import React, { useState } from 'react';
import { UserProfile, Language, TokenTheme } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { updateUserProfile, AVATAR_OPTIONS } from '../../services/authService';
import { soundFx } from '../../utils/sound';
import { X, User, Sparkles, Check, Music, Zap } from 'lucide-react';

interface EditProfileModalProps {
  user: UserProfile;
  language: Language;
  onUpdate: (updated: UserProfile) => void;
  onClose: () => void;
}

const TOKEN_SKINS: Array<{ id: TokenTheme; labelBn: string; labelEn: string; color: string; desc: string }> = [
  { id: 'classic', labelBn: 'রয়েল ক্লাসিক', labelEn: 'Royal Classic', color: 'from-amber-400 to-amber-600', desc: 'Glossy 3D Gold' },
  { id: 'wood', labelBn: 'কাঠের কারুকাজ', labelEn: 'Carved Wood', color: 'from-amber-800 to-yellow-950', desc: 'Handcrafted Antique' },
  { id: 'brass', labelBn: 'পিতলের মেটাল', labelEn: 'Royal Brass', color: 'from-yellow-400 to-amber-700', desc: 'Polished Metal' },
  { id: 'neon', labelBn: 'সাইবার নিওন', labelEn: 'Cyber Neon', color: 'from-cyan-400 to-fuchsia-500', desc: 'Futuristic Glow' },
  { id: 'marble', labelBn: 'সাদা মার্বেল', labelEn: 'White Marble', color: 'from-stone-100 to-stone-400', desc: 'Premium Stone' },
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  user,
  language,
  onUpdate,
  onClose,
}) => {
  const [name, setName] = useState(user.displayName);
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar);
  const [selectedSkin, setSelectedSkin] = useState<TokenTheme>(user.tokenSkin || 'classic');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    soundFx.click();
    setSaving(true);

    try {
      const cleanName = name.trim().slice(0, 20);
      await updateUserProfile(user.uid, {
        displayName: cleanName,
        avatar: selectedAvatar,
        tokenSkin: selectedSkin,
      });

      onUpdate({
        ...user,
        displayName: cleanName,
        avatar: selectedAvatar,
        tokenSkin: selectedSkin,
      });

      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <User className="w-4 h-4" />
            </div>
            <h3 className="font-black text-lg bg-gradient-to-r from-white via-neutral-100 to-amber-200 bg-clip-text text-transparent">
              {getTranslation(language, 'editProfile')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Avatar Selector (Emojis only) */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
              <span>{language === 'bn' ? 'ইমোজি প্রোফাইল ছবি বেছে নিন' : 'Choose Emoji Profile Photo'}</span>
              <span className="text-xl p-1 rounded-lg bg-black border border-neutral-800">{selectedAvatar}</span>
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-36 overflow-y-auto p-2 bg-black rounded-2xl border border-neutral-800">
              {AVATAR_OPTIONS.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => {
                    soundFx.click();
                    setSelectedAvatar(avatar);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer ${
                    selectedAvatar === avatar
                      ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/30 border-2 border-amber-400 scale-110 shadow-md shadow-amber-500/30 ring-2 ring-amber-400/30'
                      : 'bg-neutral-950 border border-neutral-800 hover:bg-neutral-900 hover:scale-105'
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {/* Token Skin Customizer */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'bn' ? 'ঘুঁটির ডিজাইন (Token Skin)' : 'Goti / Token Design Skin'}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TOKEN_SKINS.map((skin) => (
                <button
                  key={skin.id}
                  type="button"
                  onClick={() => {
                    soundFx.click();
                    setSelectedSkin(skin.id);
                  }}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    selectedSkin === skin.id
                      ? 'bg-amber-950/40 border-amber-400 shadow-md'
                      : 'bg-black border-neutral-800 hover:bg-neutral-900'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${skin.color} shadow-md border-2 border-white/40 flex items-center justify-center`}>
                    {selectedSkin === skin.id && <Check className="w-4 h-4 text-neutral-950" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {language === 'bn' ? skin.labelBn : skin.labelEn}
                    </p>
                    <p className="text-[10px] text-neutral-400">{skin.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Display Name Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-400">
              {getTranslation(language, 'displayName')}
            </label>
            <input
              type="text"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-black border border-neutral-700/80 rounded-xl px-4 py-2.5 text-white font-semibold text-sm focus:outline-none focus:border-amber-400"
              placeholder="Your Name"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 text-sm font-semibold cursor-pointer transition-colors"
            >
              {getTranslation(language, 'cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-neutral-950 font-black text-sm shadow-lg shadow-amber-500/25 cursor-pointer transition-all active:scale-95"
            >
              {saving ? 'Saving...' : getTranslation(language, 'save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
