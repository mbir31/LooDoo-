import React, { useState, useEffect } from 'react';
import { voiceManager } from '../../services/webrtcService';
import { Language } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { soundFx } from '../../utils/sound';
import { Mic, MicOff, Radio, PhoneOff, AlertCircle } from 'lucide-react';

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
  const [, setConnState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
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

  const handleTurnOnVoice = async () => {
    soundFx.click();
    if (isInVoice) return;
    setErrorMessage(null);
    const success = await voiceManager.joinVoice(roomId, myUid);
    if (!success) {
      setErrorMessage(getTranslation(language, 'micDenied'));
    }
  };

  const handleTurnOffVoice = async () => {
    soundFx.click();
    if (!isInVoice) return;
    await voiceManager.leaveVoice();
    setIsInVoice(false);
    setIsSpeaking(false);
  };

  const handleToggleMute = () => {
    soundFx.click();
    const muted = voiceManager.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 shadow">
        {/* Toggle On & Off Voice Buttons Side-by-Side */}
        <div className="flex items-center gap-1.5">
          {/* Turn ON Voice button */}
          <button
            id="turn-on-voice-btn"
            onClick={handleTurnOnVoice}
            disabled={isInVoice}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
              isInVoice
                ? 'bg-emerald-500 text-neutral-950 font-black shadow-emerald-500/20 ring-1 ring-emerald-400'
                : 'bg-neutral-900 hover:bg-neutral-800 text-emerald-400 border border-emerald-500/40'
            }`}
            title={getTranslation(language, 'enableVoice')}
          >
            <Radio className={`w-3.5 h-3.5 ${isInVoice ? 'animate-pulse' : ''}`} />
            <span>{getTranslation(language, 'turnOnVoice')}</span>
          </button>

          {/* Turn OFF Voice button */}
          <button
            id="turn-off-voice-btn"
            onClick={handleTurnOffVoice}
            disabled={!isInVoice}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
              !isInVoice
                ? 'bg-neutral-900 text-neutral-500 border border-neutral-800 opacity-80 cursor-default'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 hover:border-red-400 font-bold'
            }`}
            title={getTranslation(language, 'disableVoice')}
          >
            <PhoneOff className="w-3.5 h-3.5 text-red-400" />
            <span>{getTranslation(language, 'turnOffVoice')}</span>
          </button>

          {/* Mic Mute / Unmute Button (if in voice) */}
          {isInVoice && (
            <button
              id="toggle-mute-btn"
              onClick={handleToggleMute}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isMuted
                  ? 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:bg-neutral-800'
                  : isSpeaking
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/30 animate-pulse'
                  : 'bg-neutral-900 text-emerald-400 border-emerald-500/40 hover:bg-neutral-800'
              }`}
              title={isMuted ? getTranslation(language, 'unmuteMic') : getTranslation(language, 'muteMic')}
            >
              {isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Status Indicator */}
        <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 ml-auto">
          {isInVoice ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {isSpeaking
                ? getTranslation(language, 'speaking')
                : getTranslation(language, 'voiceConnected')}
            </span>
          ) : (
            <span className="text-neutral-500">
              {getTranslation(language, 'voiceDisconnected')}
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
