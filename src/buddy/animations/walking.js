// src/buddy/animations/walking.js
//
// WALK animation definition for Buddy — Phase 2 (real walk cycle).
//
// IMPORTANT: In Phase 2, the walk is driven by REAL ARTICULATED FRAMES, not
// by framer-motion transform loops. The 8 walk frames live in
// `public/buddy/walk/walk-1..8.png` (see src/buddy/assets/index.js). Each
// frame is a different walking pose (alternating legs, swinging arms), so
// pausing mid-walk shows a different pose — it is NOT a translated
// standing PNG.
//
// BuddyCharacter cycles these frames directly (via setInterval at
// WALK_FRAME_INTERVAL) during the walking phase. It does NOT use the
// `loops`/`occasional` fields below for walking — those are idle-only.
// This file is kept in the registry for completeness/documentation and for
// any future state that wants to layer a subtle transform on top of the
// frames (e.g. a celebration bounce), but the Phase 2 walk uses frames only.
//
// The facing (LEFT/RIGHT) is handled by BuddyCharacter via a scaleX flip
// on the frames — the frames are drawn facing RIGHT, so scaleX -1 makes
// the character face LEFT. This guarantees movement direction and facing
// direction always match (see movement.js facingForTarget).
//
// Frame timing is owned by movement.js:
//   WALK_FRAMES = 8
//   WALK_FRAME_INTERVAL = 90ms
//   WALK_CYCLES = 4
//   WALK_DURATION = 8 * 90 * 4 = 2880ms  (horizontal travel locks to this)

export const WALK_ANIMATION = {
  name: 'walking',
  // Frames are cycled by BuddyCharacter; no transform loops during walking
  // (the frames themselves contain the bob, sway, and step motion).
  loops: [],
  occasional: [],
  // Reference to the frame assets (informational; BuddyCharacter reads
  // these from src/buddy/assets/index.js directly).
  frames: 'walk-1..8.png (see assets)',
};

export default WALK_ANIMATION;
