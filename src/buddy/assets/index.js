// src/buddy/assets/index.js
//
// Central place for Buddy's static asset paths.
//
// Phase 1:
//   BUDDY_CHARACTER_PNG — the original front-facing transparent Buddy, used
//   for the INITIAL idle (before the character has ever turned to walk).
//
// Phase 2 (real walk cycle):
//   BUDDY_STAND_RIGHT_PNG — a side-profile STANDING idle pose (facing RIGHT).
//     Used as the post-walk idle. Facing LEFT is achieved by flipping
//     scaleX to -1 in BuddyCharacter. Same dimensions as the walk frames.
//   WALK_FRAMES — 4 side-profile walking poses (facing RIGHT), cycled at
//     WALK_FRAME_INTERVAL during the walking phase. Facing LEFT is achieved
//     by flipping scaleX. Each frame is a different pose (alternating
//     legs/arms), so pausing mid-walk shows a different pose.
//
// Phase 3A (greeting):
//   GREET_FRAMES — the one-shot greeting frame sequence (9 entries). Frames
//     1 and 9 reuse the front-facing idle PNG (BUDDY_CHARACTER_PNG); frames
//     6 and 7 reuse the wave frames (greet-4, greet-5). The 5 unique
//     generated frames are greet-2 (arm rising), greet-3 (arm raised),
//     greet-4 (wave A), greet-5 (wave B), greet-8 (arm lowering). All are
//     front-facing, 1254x1254, matching the idle PNG's scale and foot
//     position so the idle↔greeting transition is seamless.

export const BUDDY_CHARACTER_PNG = '/buddy/buddy-character.png';

export const BUDDY_STAND_RIGHT_PNG = '/buddy/stand-right.png';

// Phase 3C: the lying-down sleeping pose. A transparent horizontal PNG of
// Buddy lying on his back, eyes closed, peaceful sleeping expression.
// Used during the LYING_DOWN / SLEEPING / WAKING phases on the bed.
export const BUDDY_LYING_PNG = '/buddy/sleep/lying.png';

export const WALK_FRAMES = [
  '/buddy/walk/walk-1.png',
  '/buddy/walk/walk-2.png',
  '/buddy/walk/walk-3.png',
  '/buddy/walk/walk-4.png',
];

// The one-shot greeting sequence. The wave alternates clearly:
//   idle → arm rising → arm raised (centered) →
//   wave-A (tilted) → centered → wave-B (tilted) → centered →
//   wave-A (tilted) → centered → wave-B (tilted) → centered →
//   arm lowering → idle
// The centered frame (greet-3) is inserted BETWEEN each wave tilt so the
// side-to-side hand movement is obvious — the hand goes center→side→center
// →opposite→center, reading as a real human wave, not a held pose.
export const GREET_FRAMES = [
  BUDDY_CHARACTER_PNG,       // 1. idle (pause before)
  '/buddy/greet/greet-2.png', // 2. arm rising
  '/buddy/greet/greet-3.png', // 3. arm raised (centered / neutral)
  '/buddy/greet/greet-4.png', // 4. wave A (tilted right)
  '/buddy/greet/greet-3.png', // 5. centered (return to neutral)
  '/buddy/greet/greet-5.png', // 6. wave B (tilted left)
  '/buddy/greet/greet-3.png', // 7. centered (return to neutral)
  '/buddy/greet/greet-4.png', // 8. wave A (tilted right)
  '/buddy/greet/greet-3.png', // 9. centered (return to neutral)
  '/buddy/greet/greet-5.png', // 10. wave B (tilted left)
  '/buddy/greet/greet-3.png', // 11. centered (return to neutral)
  '/buddy/greet/greet-8.png', // 12. arm lowering
  BUDDY_CHARACTER_PNG,       // 13. idle (settle)
];

// The one-shot celebration sequence. The key moment is BOTH hands raised +
// a small hop (frame 5), held briefly to read as "YES! 🎉".
//   idle → anticipation → both arms rising → both arms raised →
//   both arms raised + hop → held pose → body comes down →
//   both arms lowering → idle
export const CELEBRATE_FRAMES = [
  BUDDY_CHARACTER_PNG,             // 1. idle (pause before)
  '/buddy/celebrate/celebrate-2.png', // 2. anticipation (crouch)
  '/buddy/celebrate/celebrate-3.png', // 3. both arms rising
  '/buddy/celebrate/celebrate-4.png', // 4. both arms fully raised
  '/buddy/celebrate/celebrate-5.png', // 5. both arms raised + hop (key)
  '/buddy/celebrate/celebrate-6.png', // 6. celebration pose held
  '/buddy/celebrate/celebrate-7.png', // 7. body comes down (landing)
  '/buddy/celebrate/celebrate-8.png', // 8. both arms lowering
  BUDDY_CHARACTER_PNG,             // 9. idle (settle)
];

export default BUDDY_CHARACTER_PNG;
