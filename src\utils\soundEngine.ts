/**
 * Cinematic Audio Engine — NASA Lunar Landing Page
 * --------------------------------------------------
 * Implements phase-synchronized ambient sound design and voice narration.
 *
 * All synthesis is done via the Web Audio API — zero external file dependencies.
 * Voice-over uses the browser's built-in SpeechSynthesis API (free, no license needed).
 *
 * Architecture:
 *  - Two independent gain buses: `ambientBus` and `uiBus`, both under `masterGain`
 *  - Narration handled entirely by window.speechSynthesis
 *  - Each phase has a dedicated `startPhaseAudio(phase)` method
 *  - `stopAll()` fades everything out gracefully and cancels speech
 *  - `ambientMuted` and `narrationMuted` are persisted in sessionStorage
 */

import { CinematicPhase } from '../types/mission';

// ─── SessionStorage keys ──────────────────────────────────────────────────────
const SS_AMBIENT = 'lunar_audio_ambient_muted';
const SS_NARRATION = 'lunar_audio_narration_muted';

// ─── Helper ───────────────────────────────────────────────────────────────────
function readBool(key: string, defaultVal: boolean): boolean {
  try {
    const v = sessionStorage.getItem(key);
    return v === null ? defaultVal : v === 'true';
  } catch {
    return defaultVal;
  }
}
function writeBool(key: string, val: boolean) {
  try { sessionStorage.setItem(key, String(val)); } catch { /* ignore */ }
}

// ─── Main Class ───────────────────────────────────────────────────────────────
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientBus: GainNode | null = null;   // feeds all continuous pads / drones
  private uiBus: GainNode | null = null;         // feeds short UI transients

  // State flags
  private initialized = false;
  private ambientMuted: boolean;
  private narrationMuted: boolean;

  // Currently playing phase layer — stopped & replaced on each new phase
  private phaseNodes: AudioNode[] = [];
  private phaseGain: GainNode | null = null;

  // Cosmic background drone (always running when ambient is on)
  private droneGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneLfo: OscillatorNode | null = null;

  // Narration timing
  private narrationUtterance: SpeechSynthesisUtterance | null = null;
  private narrationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Muted by default; restore from session on creation
    this.ambientMuted = readBool(SS_AMBIENT, true);
    this.narrationMuted = readBool(SS_NARRATION, true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /** Must be called after a user gesture. */
  public init() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Ambient bus — volume follows ambientMuted
      this.ambientBus = this.ctx.createGain();
      this.ambientBus.gain.setValueAtTime(this.ambientMuted ? 0 : 0.5, this.ctx.currentTime);
      this.ambientBus.connect(this.masterGain);

      // UI transient bus — not affected by ambient mute
      this.uiBus = this.ctx.createGain();
      this.uiBus.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.uiBus.connect(this.masterGain);

      this._startCosmicDrone();
    } catch (e) {
      console.warn('[SoundEngine] Web Audio not supported:', e);
    }
  }

  /** Stop everything immediately with a quick fade. Cancel speech. */
  public stopAll(fadeDuration = 0.4) {
    this._cancelSpeech();
    this._stopPhaseLayer(0.15);
    if (this.ctx && this.ambientBus) {
      const now = this.ctx.currentTime;
      this.ambientBus.gain.cancelScheduledValues(now);
      this.ambientBus.gain.setTargetAtTime(0, now, fadeDuration / 3);
    }
  }

  /** Restart ambient after a replay (re-opens gain). */
  public restartAmbient() {
    if (!this.ctx || !this.ambientBus) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    this.ambientBus.gain.cancelScheduledValues(now);
    this.ambientBus.gain.setTargetAtTime(this.ambientMuted ? 0 : 0.5, now, 0.3);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase-synchronized audio
  // ─────────────────────────────────────────────────────────────────────────

  public startPhaseAudio(phase: CinematicPhase) {
    if (!this.ctx || !this.ambientBus) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this._stopPhaseLayer(0.3);

    switch (phase) {
      case 'deep_space':
        this._playDeepSpacePad();
        break;
      case 'earth_reveal':
        this._playEarthSwell();
        this._startNarration(); // voice begins at earth_reveal (~1s in)
        break;
      case 'lunar_approach':
        this._playLunarApproachRumble();
        break;
      case 'lunar_surface':
        this._playRadarSweep();
        break;
      case 'site_targeting':
        this._playSiteConfirmation();
        break;
      case 'hero_active':
        this._playHeroImpact();
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ambient mute control
  // ─────────────────────────────────────────────────────────────────────────

  public setAmbientMuted(muted: boolean) {
    this.ambientMuted = muted;
    writeBool(SS_AMBIENT, muted);
    if (!this.ctx || !this.ambientBus) {
      if (!muted) this.init();
      return;
    }
    if (this.ctx.state === 'suspended' && !muted) this.ctx.resume();
    const now = this.ctx.currentTime;
    this.ambientBus.gain.cancelScheduledValues(now);
    this.ambientBus.gain.setTargetAtTime(muted ? 0 : 0.5, now, 0.2);
  }

  public getAmbientMuted(): boolean { return this.ambientMuted; }

  public toggleAmbient(): boolean {
    this.setAmbientMuted(!this.ambientMuted);
    if (!this.ambientMuted) this.playUiClick();
    return this.ambientMuted;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Narration mute control
  // ─────────────────────────────────────────────────────────────────────────

  public setNarrationMuted(muted: boolean) {
    this.narrationMuted = muted;
    writeBool(SS_NARRATION, muted);
    if (muted) {
      this._cancelSpeech();
    }
  }

  public getNarrationMuted(): boolean { return this.narrationMuted; }

  public toggleNarration(): boolean {
    const nextState = !this.narrationMuted;
    this.setNarrationMuted(nextState);
    if (!nextState) {
      this.playUiClick();
      // If user un-muted narration, start narration from the beginning
      this._startNarration();
    }
    return this.narrationMuted;
  }

  /** Explicitly replay the documentary voice narration from the beginning */
  public replayNarration() {
    this.narrationMuted = false;
    writeBool(SS_NARRATION, false);
    this.playUiClick();
    this._startNarration();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Legacy API (preserved for existing callers in App.tsx / HUD)
  // ─────────────────────────────────────────────────────────────────────────

  /** @deprecated Use setAmbientMuted / toggleAmbient */
  public setMuted(muted: boolean) { this.setAmbientMuted(muted); }
  /** @deprecated */
  public getMuted(): boolean { return this.ambientMuted; }
  /** @deprecated */
  public toggleMute(): boolean { return this.toggleAmbient(); }

  public playTelemetryBeep(freq = 1480, duration = 0.08) {
    this._uiTone('sine', freq, freq * 1.3, duration, 0.055);
  }

  public playTargetAcquired() {
    if (!this.ctx || !this.uiBus) return;
    const now = this.ctx.currentTime;
    [880, 1320, 1760].forEach((freq, i) => {
      this._uiTone('triangle', freq, freq, 0.12, 0.07, now + i * 0.07);
    });
  }

  public playThrusterBurst() {
    if (!this.ctx || !this.uiBus) return;
    this._noiseTransient(450, 1.8, 0.4, 0.11);
  }

  public playUiClick() {
    this._uiTone('sine', 2400, 800, 0.04, 0.065);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase layer implementations
  // ─────────────────────────────────────────────────────────────────────────

  /** 0–1s: Subtle deep-space atmospheric pad — filtered noise + gentle LFO tremolo */
  private _playDeepSpacePad() {
    if (!this.ctx || !this.ambientBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.8);

    // Two detuned sine pads for a gentle interstellar shimmer
    const freqs = [73.4, 110.0, 146.8]; // D2, A2, D3
    freqs.forEach(f => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.33, now);
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start(now);
      this.phaseNodes.push(osc);
    });

    // Very slow tremolo
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.15, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.06, now);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start(now);
    this.phaseNodes.push(lfo);

    gain.connect(this.ambientBus);
    this.phaseGain = gain;
  }

  /** 1–2s: Gentle orchestral-ish swell — detuned triangle oscillators fading in */
  private _playEarthSwell() {
    if (!this.ctx || !this.ambientBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.9);

    // "String swell" — multiple detuned triangle waves
    const base = 220; // A3
    const detunes = [0, 7, 14, -7, 24]; // cents
    detunes.forEach(d => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(base, now);
      osc.detune.setValueAtTime(d, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, now);
      osc.connect(g);
      g.connect(gain);
      osc.start(now);
      this.phaseNodes.push(osc);
    });

    // Warm low pad underneath
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, now); // A1
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.35, now);
    sub.connect(subG);
    subG.connect(gain);
    sub.start(now);
    this.phaseNodes.push(sub);

    gain.connect(this.ambientBus);
    this.phaseGain = gain;
  }

  /** 2–5s: Building low-frequency cinematic rumble — sub bass crescendo + rising filter */
  private _playLunarApproachRumble() {
    if (!this.ctx || !this.ambientBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = 3.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.6);
    gain.gain.linearRampToValueAtTime(0.45, now + duration); // crescendo

    // Sub rumble — noise through low-pass filter with rising cutoff
    const bufSize = ctx.sampleRate * (duration + 0.5);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(60, now);
    filter.frequency.linearRampToValueAtTime(260, now + duration); // filter opens up
    filter.Q.setValueAtTime(4, now);

    noise.connect(filter);
    filter.connect(gain);
    noise.start(now);
    this.phaseNodes.push(noise);

    // Pulsing sawtooth thruster tone
    const thr = ctx.createOscillator();
    thr.type = 'sawtooth';
    thr.frequency.setValueAtTime(38, now);
    thr.frequency.linearRampToValueAtTime(55, now + duration);
    const thrFilter = ctx.createBiquadFilter();
    thrFilter.type = 'lowpass';
    thrFilter.frequency.setValueAtTime(90, now);
    const thrG = ctx.createGain();
    thrG.gain.setValueAtTime(0.25, now);
    thr.connect(thrFilter);
    thrFilter.connect(thrG);
    thrG.connect(gain);
    thr.start(now);
    this.phaseNodes.push(thr);

    gain.connect(this.ambientBus);
    this.phaseGain = gain;
  }

  /** 5–7s: Radar sweep pulses — band-pass noise bursts every ~0.5s */
  private _playRadarSweep() {
    if (!this.ctx || !this.ambientBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.3);

    // Schedule 4 radar pulses
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.5;
      const bufSize = Math.floor(ctx.sampleRate * 0.12);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < bufSize; j++) d[j] = Math.random() * 2 - 1;

      const ns = ctx.createBufferSource();
      ns.buffer = buf;

      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(1800 + i * 120, t);
      f.Q.setValueAtTime(12, t);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.9, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      ns.connect(f);
      f.connect(g);
      g.connect(gain);
      ns.start(t);
      this.phaseNodes.push(ns);
    }

    // Quiet underlying electronic hum
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(432, now);
    const humG = ctx.createGain();
    humG.gain.setValueAtTime(0.08, now);
    hum.connect(humG);
    humG.connect(gain);
    hum.start(now);
    this.phaseNodes.push(hum);

    gain.connect(this.ambientBus);
    this.phaseGain = gain;
  }

  /** 7–9s: Site confirmation — 3 clean sine tones in ascending sequence */
  private _playSiteConfirmation() {
    if (!this.ctx || !this.uiBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [523.25, 659.25, 783.99].forEach((freq, i) => { // C5, E5, G5 — confident major triad
      const t = now + i * 0.11;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g);
      g.connect(this.uiBus!);
      osc.start(t);
      osc.stop(t + 0.25);
    });

    // Also fire playTargetAcquired for a satisfying layered feel
    setTimeout(() => this.playTargetAcquired(), 350);
  }

  /**
   * Hero active: soft sub-bass cinematic impact (thud) →
   *              sustained calm ambient pad
   */
  private _playHeroImpact() {
    if (!this.ctx || !this.ambientBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Short impact thud — noise burst through very low-pass filter
    const bufSize = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const impactNoise = ctx.createBufferSource();
    impactNoise.buffer = buf;
    const impactFilter = ctx.createBiquadFilter();
    impactFilter.type = 'lowpass';
    impactFilter.frequency.setValueAtTime(80, now);
    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(0.5, now);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    impactNoise.connect(impactFilter);
    impactFilter.connect(impactGain);
    impactGain.connect(this.ambientBus);
    impactNoise.start(now);

    // 2. Calm ambient pad fades in after the thud
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + 0.5);
    gain.gain.linearRampToValueAtTime(0.18, now + 2.0);

    const padFreqs = [55, 82.4, 110, 164.8]; // A1, E2, A2, E3
    padFreqs.forEach(f => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + 0.5);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.25, now);
      osc.connect(og);
      og.connect(gain);
      osc.start(now + 0.5);
      this.phaseNodes.push(osc);
    });

    gain.connect(this.ambientBus);
    this.phaseGain = gain;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Background cosmic drone (always-on ambient layer)
  // ─────────────────────────────────────────────────────────────────────────

  private _startCosmicDrone() {
    if (!this.ctx || !this.ambientBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    this.droneGain = ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.22, now);

    // F1 sawtooth (43.65 Hz)
    this.droneOsc1 = ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.setValueAtTime(43.65, now);

    // C2 sine (65.41 Hz)
    this.droneOsc2 = ctx.createOscillator();
    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.setValueAtTime(65.41, now);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(130, now);
    lp.Q.setValueAtTime(3.5, now);

    // Breathing LFO
    this.droneLfo = ctx.createOscillator();
    this.droneLfo.frequency.setValueAtTime(0.08, now);
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(35, now);
    this.droneLfo.connect(lfoG);
    lfoG.connect(lp.frequency);

    this.droneOsc1.connect(lp);
    this.droneOsc2.connect(lp);
    lp.connect(this.droneGain);
    this.droneGain.connect(this.ambientBus);

    this.droneOsc1.start(now);
    this.droneOsc2.start(now);
    this.droneLfo.start(now);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Narration
  // ─────────────────────────────────────────────────────────────────────────

  private _startNarration() {
    if (this.narrationMuted) return;
    if (!window.speechSynthesis) return;

    this._cancelSpeech();

    // Natural documentary pacing synchronized with 8-10s lunar journey
    this.narrationTimer = setTimeout(() => {
      this._speakLine(
        "The Moon's south pole holds extraordinary possibilities.",
        () => {
          this.narrationTimer = setTimeout(() => {
            this._speakLine(
              "But choosing where to land is no simple task.",
              () => {
                this.narrationTimer = setTimeout(() => {
                  this._speakLine(
                    "Before we land, we need to understand the terrain.",
                    null
                  );
                }, 1000);
              }
            );
          }, 1100);
        }
      );
    }, 300);
  }

  private _speakLine(text: string, onEnd: (() => void) | null) {
    if (this.narrationMuted) return;
    if (!window.speechSynthesis) return;

    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.84;
    u.pitch = 0.88;
    u.volume = 0.92;
    u.lang = 'en-US';

    // Pick a natural documentary voice (English US/GB preferred)
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => /natural|david|george|mark|daniel|guy|male/i.test(v.name) && /en/i.test(v.lang)) ||
      voices.find(v => /en[-_]?(US|GB)/i.test(v.lang)) ||
      voices.find(v => v.lang.startsWith('en'));
    if (preferred) u.voice = preferred;

    if (onEnd) u.onend = onEnd;
    this.narrationUtterance = u;
    window.speechSynthesis.speak(u);
  }

  private _cancelSpeech() {
    if (this.narrationTimer) {
      clearTimeout(this.narrationTimer);
      this.narrationTimer = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.narrationUtterance = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Fade-out & disconnect the current phase layer. */
  private _stopPhaseLayer(fadeSec = 0.3) {
    if (!this.ctx || !this.phaseGain) return;
    const now = this.ctx.currentTime;
    this.phaseGain.gain.cancelScheduledValues(now);
    this.phaseGain.gain.setTargetAtTime(0, now, fadeSec / 3);
    // Disconnect after fade completes
    const pgRef = this.phaseGain;
    setTimeout(() => { try { pgRef.disconnect(); } catch { /* ok */ } }, fadeSec * 1000 + 100);
    this.phaseGain = null;
    // Stop tracked oscillators & buffers
    this.phaseNodes.forEach(node => {
      try { (node as OscillatorNode | AudioBufferSourceNode).stop(); } catch { /* ok */ }
      try { node.disconnect(); } catch { /* ok */ }
    });
    this.phaseNodes = [];
  }

  /** Short envelope sine/triangle tone on the UI bus. */
  private _uiTone(
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    duration: number,
    gainPeak: number,
    startAt?: number
  ) {
    if (!this.ctx || !this.uiBus) return;
    const ctx = this.ctx;
    const t = startAt ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + duration);
    }
    g.gain.setValueAtTime(gainPeak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(this.uiBus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** Filtered noise burst on the UI bus (thruster / impact). */
  private _noiseTransient(filterFreq: number, Q: number, duration: number, gainPeak: number) {
    if (!this.ctx || !this.uiBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(filterFreq, now);
    f.Q.setValueAtTime(Q, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainPeak, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(f);
    f.connect(g);
    g.connect(this.uiBus);
    src.start(now);
  }
}

export const soundEngine = new SoundEngine();
