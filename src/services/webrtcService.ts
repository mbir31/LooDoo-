import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { VoiceSignal, VoiceSession } from '../types';

// Robust global STUN servers for peer-to-peer NAT traversal
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCVoiceManager {
  private roomId: string | null = null;
  private localUid: string | null = null;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private signalUnsubscribe: Unsubscribe | null = null;
  private sessionUnsubscribe: Unsubscribe | null = null;
  private isMuted: boolean = false;
  private isSpeaking: boolean = false;
  private lastSpeakingUpdate: number = 0;
  private analyserNode: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private audioCtx: AudioContext | null = null;
  
  public onSpeakingChange?: (isSpeaking: boolean) => void;
  public onPeerSpeakingChange?: (peerUid: string, isSpeaking: boolean) => void;
  public onConnectionStateChange?: (state: 'disconnected' | 'connecting' | 'connected' | 'error') => void;

  /**
   * Initializes and joins the WebRTC voice mesh for a room
   */
  public async joinVoice(roomId: string, localUid: string): Promise<boolean> {
    this.roomId = roomId;
    this.localUid = localUid;

    try {
      this.onConnectionStateChange?.('connecting');

      // 1. Request microphone stream with voice-optimized constraints
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });

      // 2. Setup real-time voice activity analyzer
      this.setupSpeakingDetector(this.localStream);

      // 3. Register active voice session in Firestore
      const sessionRef = doc(db, 'rooms', roomId, 'voiceSessions', localUid);
      await setDoc(sessionRef, {
        uid: localUid,
        enabled: true,
        isSpeaking: false,
        updatedAt: Date.now(),
      });

      // 4. Listen for other active peer sessions in the room
      this.subscribeToSessions();

      // 5. Listen for incoming WebRTC signals
      this.subscribeToSignals();

      this.onConnectionStateChange?.('connected');
      return true;
    } catch (err: any) {
      console.warn('Microphone access denied or WebRTC setup error:', err);
      this.onConnectionStateChange?.('error');
      return false;
    }
  }

  /**
   * Listen to active voice sessions to initiate peer connections
   */
  private subscribeToSessions() {
    if (!this.roomId || !this.localUid) return;

    const sessionsQuery = collection(db, 'rooms', this.roomId, 'voiceSessions');
    this.sessionUnsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data() as VoiceSession;
        const peerUid = data.uid;

        if (!peerUid || peerUid === this.localUid) return;

        if (change.type === 'added' || change.type === 'modified') {
          if (data.enabled) {
            // Lexicographical ordering to elect the offerer and avoid glare collisions
            if (this.localUid! < peerUid && !this.peerConnections.has(peerUid)) {
              await this.createOffer(peerUid);
            }
          } else {
            this.closePeer(peerUid);
          }
        } else if (change.type === 'removed') {
          this.closePeer(peerUid);
        }
      });
    });
  }

  /**
   * Listen to incoming signaling messages (Offer, Answer, ICE Candidate)
   */
  private subscribeToSignals() {
    if (!this.roomId || !this.localUid) return;

    const signalsQuery = query(
      collection(db, 'rooms', this.roomId, 'voiceSignals'),
      where('toUid', '==', this.localUid)
    );

    this.signalUnsubscribe = onSnapshot(signalsQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const signal = change.doc.data() as VoiceSignal;
          const signalDocRef = change.doc.ref;

          await this.handleIncomingSignal(signal);
          // Delete signal after processing to keep Firestore footprint lean
          deleteDoc(signalDocRef).catch(() => {});
        }
      });
    });
  }

  /**
   * Handles incoming WebRTC signal with ICE candidate queuing
   */
  private async handleIncomingSignal(signal: VoiceSignal) {
    const peerUid = signal.fromUid;
    if (!peerUid || peerUid === this.localUid) return;

    try {
      if (signal.type === 'OFFER') {
        const pc = this.getOrCreatePeerConnection(peerUid);
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
        
        // Process any ICE candidates that arrived before remote description was set
        await this.drainPendingCandidates(peerUid, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.sendSignal(peerUid, 'ANSWER', answer);
      } else if (signal.type === 'ANSWER') {
        const pc = this.peerConnections.get(peerUid);
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          await this.drainPendingCandidates(peerUid, pc);
        }
      } else if (signal.type === 'ICE_CANDIDATE') {
        const pc = this.peerConnections.get(peerUid);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.payload)).catch((e) => {
            console.warn('Could not add ICE candidate:', e);
          });
        } else {
          // Buffer candidate until remoteDescription is ready
          const pending = this.pendingCandidates.get(peerUid) || [];
          pending.push(signal.payload);
          this.pendingCandidates.set(peerUid, pending);
        }
      } else if (signal.type === 'BYE') {
        this.closePeer(peerUid);
      }
    } catch (err) {
      console.warn('Error processing WebRTC signal:', err);
    }
  }

  /**
   * Drain and add all buffered ICE candidates for a peer
   */
  private async drainPendingCandidates(peerUid: string, pc: RTCPeerConnection) {
    const candidates = this.pendingCandidates.get(peerUid);
    if (!candidates || candidates.length === 0) return;

    for (const cand of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('Error adding queued ICE candidate:', e);
      }
    }
    this.pendingCandidates.delete(peerUid);
  }

  /**
   * Create or retrieve RTCPeerConnection for a peer
   */
  private getOrCreatePeerConnection(peerUid: string): RTCPeerConnection {
    let pc = this.peerConnections.get(peerUid);
    if (pc) return pc;

    pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local microphone audio tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc!.addTrack(track, this.localStream!);
      });
    }

    // Emit local ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.roomId && this.localUid) {
        this.sendSignal(peerUid, 'ICE_CANDIDATE', event.candidate.toJSON());
      }
    };

    // Receive and bind remote audio stream
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        let audioEl = this.remoteAudioElements.get(peerUid);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          (audioEl as any).playsInline = true;
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          this.remoteAudioElements.set(peerUid, audioEl);
        }
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch((playErr) => {
          console.log('Audio autoplay awaiting user interaction:', playErr);
        });
      }
    };

    // Monitor connection lifecycle and trigger ICE restart if disconnected
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'failed') {
        pc.restartIce?.();
      }
    };

    this.peerConnections.set(peerUid, pc);
    return pc;
  }

  /**
   * Create and send SDP Offer to a peer
   */
  private async createOffer(peerUid: string) {
    try {
      const pc = this.getOrCreatePeerConnection(peerUid);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
      await this.sendSignal(peerUid, 'OFFER', offer);
    } catch (err) {
      console.warn('Failed to create WebRTC offer:', err);
    }
  }

  /**
   * Send signal message through Firestore
   */
  private async sendSignal(toUid: string, type: VoiceSignal['type'], payload: any) {
    if (!this.roomId || !this.localUid) return;
    const signalRef = doc(collection(db, 'rooms', this.roomId, 'voiceSignals'));
    const signal: VoiceSignal = {
      id: signalRef.id,
      fromUid: this.localUid,
      toUid,
      type,
      payload,
      createdAt: Date.now(),
    };
    await setDoc(signalRef, signal);
  }

  /**
   * Speaking indicator detector with volume threshold
   */
  private setupSpeakingDetector(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioCtx = new AudioCtx();
      
      // Auto-resume if in suspended state
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      source.connect(this.analyserNode);

      const bufferLength = this.analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!this.analyserNode || this.isMuted) {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            this.onSpeakingChange?.(false);
            this.syncSpeakingState(false);
          }
          this.animFrameId = requestAnimationFrame(checkVolume);
          return;
        }

        this.analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const isNowSpeaking = avg > 22;

        if (isNowSpeaking !== this.isSpeaking) {
          this.isSpeaking = isNowSpeaking;
          this.onSpeakingChange?.(isNowSpeaking);
          this.syncSpeakingState(isNowSpeaking);
        }

        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      this.animFrameId = requestAnimationFrame(checkVolume);
    } catch (e) {}
  }

  /**
   * Throttled sync of speaking state to Firestore
   */
  private async syncSpeakingState(isSpeaking: boolean) {
    const now = Date.now();
    if (now - this.lastSpeakingUpdate < 400 && isSpeaking) return;
    this.lastSpeakingUpdate = now;

    if (this.roomId && this.localUid) {
      try {
        const sessionRef = doc(db, 'rooms', this.roomId, 'voiceSessions', this.localUid);
        await setDoc(
          sessionRef,
          {
            uid: this.localUid,
            enabled: !this.isMuted,
            isSpeaking,
            updatedAt: now,
          },
          { merge: true }
        );
      } catch (err) {}
    }
  }

  /**
   * Toggle mic mute / unmute
   */
  public toggleMute(): boolean {
    if (!this.localStream) return true;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((t) => {
      t.enabled = !this.isMuted;
    });
    if (this.isMuted) {
      this.isSpeaking = false;
      this.onSpeakingChange?.(false);
      this.syncSpeakingState(false);
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Close a specific peer connection and cleanup audio element
   */
  private closePeer(peerUid: string) {
    const pc = this.peerConnections.get(peerUid);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerUid);
    }
    const audioEl = this.remoteAudioElements.get(peerUid);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
      this.remoteAudioElements.delete(peerUid);
    }
    this.pendingCandidates.delete(peerUid);
  }

  /**
   * Leave Voice Chat completely & clean up all resources
   */
  public async leaveVoice() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    this.remoteAudioElements.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    this.remoteAudioElements.clear();
    this.pendingCandidates.clear();

    if (this.signalUnsubscribe) {
      this.signalUnsubscribe();
      this.signalUnsubscribe = null;
    }

    if (this.sessionUnsubscribe) {
      this.sessionUnsubscribe();
      this.sessionUnsubscribe = null;
    }

    if (this.roomId && this.localUid) {
      const sessionRef = doc(db, 'rooms', this.roomId, 'voiceSessions', this.localUid);
      await deleteDoc(sessionRef).catch(() => {});
    }

    this.onConnectionStateChange?.('disconnected');
    this.roomId = null;
    this.localUid = null;
    this.isMuted = false;
    this.isSpeaking = false;
  }
}

export const voiceManager = new WebRTCVoiceManager();

