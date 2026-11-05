/** Honour the OS "reduce motion" setting: skip shakes, tumbles, staged reveals and confetti. */
export const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
