/**
 * Tiny synthesized sound kit (Web Audio, no audio files) plus vibration.
 * Browsers only allow audio after a user gesture, so `unlockAudio` is wired to the first tap.
 */

export type SoundName =
  | 'rattle' // new round: dice shaking in the cup
  | 'bid' // someone raised
  | 'katzel' // someone called Katzel
  | 'chime' // it is your turn
  | 'tick' // last seconds of your turn / a hand revealed
  | 'slam' // Liar!
  | 'verdict' // the reveal verdict lands
  | 'dieOut' // a die pops out of the loser's cup and flies away
  | 'dieOutAndIn' // ...and a bonus die flies into the jump-in winner's cup
  | 'fanfare' // you won
  | 'pop'; // emoji reaction

const MUTED_KEY = 'perudo.muted';

let context: AudioContext | null = null;
let muted = localStorage.getItem(MUTED_KEY) === 'true';

export function isMuted(): boolean {
  return muted;
}

export function setMuted(nextMuted: boolean): void {
  muted = nextMuted;
  localStorage.setItem(MUTED_KEY, String(nextMuted));
}

/** Creates/resumes the audio context; must run inside a user gesture at least once. */
export function unlockAudio(): void {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
}

/** Short vibration on devices that support it (Android); silently unsupported on iOS. */
export function vibrate(pattern: number | number[]): void {
  if (!muted && 'vibrate' in navigator) navigator.vibrate(pattern);
}

export function playSound(name: SoundName): void {
  if (muted || context === null || context.state !== 'running') return;
  SOUNDS[name](context, context.currentTime);
}

const SOUNDS: Record<SoundName, (audio: AudioContext, at: number) => void> = {
  rattle: (audio, at) => {
    for (let index = 0; index < 7; index += 1) {
      noise(audio, at + index * 0.06 + Math.random() * 0.03, 0.035, 0.25, 2500 + Math.random() * 1500);
    }
  },
  bid: (audio, at) => tone(audio, { at, duration: 0.09, from: 620, to: 880, type: 'triangle', gain: 0.18 }),
  katzel: (audio, at) => {
    tone(audio, { at, duration: 0.12, from: 520, type: 'sine', gain: 0.2 });
    tone(audio, { at: at + 0.11, duration: 0.16, from: 780, type: 'sine', gain: 0.2 });
  },
  chime: (audio, at) => {
    tone(audio, { at, duration: 0.14, from: 880, type: 'sine', gain: 0.22 });
    tone(audio, { at: at + 0.13, duration: 0.24, from: 1320, type: 'sine', gain: 0.2 });
  },
  tick: (audio, at) => tone(audio, { at, duration: 0.04, from: 1500, type: 'square', gain: 0.06 }),
  slam: (audio, at) => {
    tone(audio, { at, duration: 0.35, from: 140, to: 45, type: 'sine', gain: 0.6 });
    noise(audio, at, 0.18, 0.5, 600);
  },
  verdict: (audio, at) => {
    noise(audio, at, 0.35, 0.3, 5000);
    tone(audio, { at, duration: 0.3, from: 330, to: 220, type: 'triangle', gain: 0.2 });
  },
  dieOut: (audio, at) => {
    tone(audio, { at, duration: 0.12, from: 300, to: 900, type: 'sine', gain: 0.18 }); // pop out
    whoosh(audio, at + 0.1);
    tone(audio, { at: at + 0.75, duration: 0.25, from: 180, to: 70, type: 'sine', gain: 0.45 }); // gone
  },
  dieOutAndIn: (audio, at) => {
    SOUNDS.dieOut(audio, at);
    whoosh(audio, at + 0.2);
    [523, 659, 784].forEach((frequency, index) =>
      tone(audio, { at: at + 0.95 + index * 0.09, duration: 0.18, from: frequency, type: 'triangle', gain: 0.18 }),
    );
  },
  fanfare: (audio, at) => {
    [523, 659, 784, 1047].forEach((frequency, index) =>
      tone(audio, { at: at + index * 0.13, duration: 0.2, from: frequency, type: 'triangle', gain: 0.2 }),
    );
    [523, 659, 784, 1047].forEach((frequency) =>
      tone(audio, { at: at + 0.55, duration: 0.7, from: frequency, type: 'triangle', gain: 0.1 }),
    );
  },
  pop: (audio, at) => tone(audio, { at, duration: 0.07, from: 600, to: 1200, type: 'sine', gain: 0.12 }),
};

interface ToneOptions {
  at: number;
  duration: number;
  from: number;
  /** Optional pitch glide target. */
  to?: number;
  type: OscillatorType;
  gain: number;
}

function tone(audio: AudioContext, options: ToneOptions): void {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(options.from, options.at);
  if (options.to !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(options.to, options.at + options.duration);
  }
  envelope.gain.setValueAtTime(options.gain, options.at);
  envelope.gain.exponentialRampToValueAtTime(0.0001, options.at + options.duration);
  oscillator.connect(envelope).connect(audio.destination);
  oscillator.start(options.at);
  oscillator.stop(options.at + options.duration);
}

/** Air rushing past: a short noise burst whose filter sweeps upward. */
function whoosh(audio: AudioContext, at: number): void {
  noise(audio, at, 0.45, 0.12, 900, 3500);
}

/** A burst of band-passed white noise: the "clack" of dice and the crash of a slam. */
function noise(
  audio: AudioContext,
  at: number,
  duration: number,
  gain: number,
  frequency: number,
  sweepTo: number | null = null,
): void {
  const samples = Math.ceil(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, samples, audio.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < samples; index += 1) channel[index] = Math.random() * 2 - 1;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, at);
  if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + duration);
  const envelope = audio.createGain();
  envelope.gain.setValueAtTime(gain, at);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(envelope).connect(audio.destination);
  source.start(at);
}
