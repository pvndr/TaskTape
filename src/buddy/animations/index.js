// src/buddy/animations/index.js
//
// Animation registry.
//
// Maps a BuddyState -> its animation definition. BuddyCharacter looks up
// the current animation here, falling back to IDLE for any missing state.
//
// PHASE 1: `idle`.
// PHASE 2: `walking`.
//
// To add a new state in a future phase:
//   1. Create src/buddy/animations/<state>.js exporting e.g. WALK_ANIMATION.
//   2. Import it here and add it to ANIMATION_REGISTRY below.
//   3. Add the state to IMPLEMENTED_STATES in src/buddy/types.js so it is
//      considered "runnable" (otherwise setState falls back to idle).
//
// Each animation definition should expose at minimum:
//   { name, loops: [...], occasional: [...] }
// so BuddyCharacter can drive it without knowing the specifics.

import { BuddyState, BuddyPhase } from '../types';
import IDLE_ANIMATION from './idle';
import WALK_ANIMATION from './walking';

// Future phases will import + register these:
// import GREETING_ANIMATION from './greeting';
// import CELEBRATING_ANIMATION from './celebrating';
// import SLEEPING_ANIMATION from './sleeping';
// import REMINDER_ANIMATION from './reminder';
// import FOCUSED_ANIMATION from './focused';

export const ANIMATION_REGISTRY = {
  [BuddyState.IDLE]: IDLE_ANIMATION,
  [BuddyState.WALKING]: WALK_ANIMATION,

  // [BuddyState.GREETING]: GREETING_ANIMATION,
  // [BuddyState.CELEBRATING]: CELEBRATING_ANIMATION,
  // [BuddyState.SLEEPING]: SLEEPING_ANIMATION,
  // [BuddyState.REMINDER]: REMINDER_ANIMATION,
  // [BuddyState.FOCUSED]: FOCUSED_ANIMATION,
};

// Look up the animation for a high-level BuddyState, falling back to IDLE.
export function getAnimationForState(state) {
  return ANIMATION_REGISTRY[state] || ANIMATION_REGISTRY[BuddyState.IDLE];
}

// Look up the animation for a detailed movement phase. The TURNING phase
// reuses the IDLE loops (breathing + sway keep running during the turn so
// the character doesn't freeze); the facing layer handles the visual flip.
// This is the lookup BuddyCharacter uses in Phase 2.
export function getAnimationForPhase(phase) {
  if (phase === BuddyPhase.WALKING) return WALK_ANIMATION;
  return IDLE_ANIMATION; // idle + turning both use idle loops
}
