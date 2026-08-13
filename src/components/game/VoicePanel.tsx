import React, { useState, useEffect } from 'react';
import { voiceManager } from '../../services/webrtcService';
import { Language } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { soundFx } from '../../utils/sound';
import { Mic, MicOff, Volume2, Radio, AlertCircle } from 'lucide-react';

interface VoicePanelProps {
  roomId: string;
  myUid: string;
  language: Language;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  roomId,
  myUid,
  language,
}) => {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connState, setConnState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    voiceManager.onSpeakingChange = (speaking) => {
      setIsSpeaking(speaking);
    };

    voiceManager.onConnectionStateChange = (state) => {
      setConnState(state);
      if (state === 'connected') {
        setIsInVoice(true);
        setErrorMessage(null);
      } else if (state === 'disconnected') {
        setIsInVoice(false);
        setIsSpeaking(false);
      } else if (state === 'error') {
        setIsInVoice(false);
        setErrorMessage(getTranslation(language, 'micDenied'));
      }
    };

    return () => {
      voiceManager.leaveVoice();
    };
  }, [language]);

  const handleToggleVoice = async () => {
    soundFx.click();
    if (isInVoice) {
      await voiceManager.leaveVoice();
      setIsInVoice(false);
    } else {
      setErrorMessage(null);
      const success = await voiceManager.joinVoice(roomId, myUid);
      if (!success) {
        setErrorMessage(getTranslation(language, 'micDenied'));
      }
    }
  };

  const handleToggleMute = () => {
    soundFx.click();
    const muted = voiceManager.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 shadow">
        {/* Voice Join/Leave button */}
        <button
          id="toggle-voice-btn"
          onClick={handleToggleVoice}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
            isInVoice
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-neutral-950 font-black'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isInVoice ? 'animate-pulse text-red-400' : ''}`} />
          <span>
            {isInVoice
              ? getTranslation(language, 'disableVoice')
              : getTranslation(language, 'enableVoice')}
          </span>
        </button>

        {/* Mic Mute / Unmute Button (if in voice) */}
        {isInVoice && (
          <button
            id="toggle-mute-btn"
            onClick={handleToggleMute}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isMuted
                ? 'bg-neutral-900 text-neutral-400 border-neutral-700'
                : isSpeaking
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/30 animate-pulse'
                : 'bg-neutral-900 text-emerald-400 border-emerald-500/40'
            }`}
            title={isMuted ? getTranslation(language, 'unmuteMic') : getTranslation(language, 'muteMic')}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        {/* Status Indicator */}
        <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 ml-auto">
          {isInVoice ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              {isSpeaking
                ? getTranslation(language, 'speaking')
                : getTranslation(language, 'voiceConnected')}
            </span>
          ) : (
            <span className="text-neutral-500">
              {getTranslation(language, 'voiceNote')}
            </span>
          )}
        </div>
      </div>

      {/* Mic Permission Warning */}
      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/50 border border-amber-800/60 px-3 py-1.5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
