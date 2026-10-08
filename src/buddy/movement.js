// src/buddy/movement.js
//
// Phase 2 movement constants + helpers.
//
// This is the single source of truth that keeps the movement-aware pieces
// in sync:
//   - BuddyContext   (orchestrates turn → walk → idle using TURN_DURATION /
//                     WALK_DURATION)
//   - BuddyCharacter (cycles the 8 real walk frames at WALK_FRAME_INTERVAL;
//                     WALK_DURATION MUST be an integer multiple of
//                     WALK_FRAMES * WALK_FRAME_INTERVAL so the cycle loops
//                     cleanly during the walk — no sliding, no stutter)
//   - page.tsx       (the playground positions Buddy horizontally and
//                     animates the travel over WALK_DURATION)
//
// Changing any timing here keeps everything consistent.

import { BuddyPosition, BuddyFacing } from './types.js';

// Horizontal positions in the playground, expressed as a `left` CSS
// percentage of the playground width. 50% is dead center.
//
// HOME is toward the RIGHT, AWAY is toward the LEFT, with enough distance
// between them that the movement is obvious. The playground clamps these
// on narrow viewports so Buddy never overflows (see page.tsx).
//
// Phase 3C adds BED — a normalized continuous X (not a percentage). The bed
// is placed FURTHER LEFT than AWAY, outside the normal HOME↔AWAY walk path,
// so it doesn't interfere with walking. Buddy walks to BED when sleeping.
// BED_X is normalized like currentX (used by the context), where +1 = HOME,
// -1 = AWAY. BED_X = -1.85 is well left of AWAY, still on screen.
export const POSITION_LEFT_PERCENT = {
  [BuddyPosition.HOME]: 82, // right side
  [BuddyPosition.AWAY]: 18, // left side
};

export function positionLeftPercent(position) {
  return POSITION_LEFT_PERCENT[position] ?? 50;
}

// The facing Buddy must have to walk toward a target position.
// AWAY and BED are on the LEFT, so walking TO them requires facing LEFT.
// HOME is on the RIGHT, so walking TO home requires facing RIGHT.
// This guarantees movement direction and facing direction always match.
export function facingForTarget(target) {
  return target === BuddyPosition.AWAY || target === BuddyPosition.BED
    ? BuddyFacing.LEFT
    : BuddyFacing.RIGHT;
}

// Turn the facing value into the horizontal scaleX multiplier used by the
// character renderer. RIGHT = +1 (normal), LEFT = -1 (mirrored).
// The walk frames and the side-standing pose are drawn facing RIGHT, so
// flipping scaleX to -1 makes them face LEFT.
export function facingScaleX(facing) {
  return facing === BuddyFacing.LEFT ? -1 : 1;
}

// --- Walk-cycle timing (milliseconds) -----------------------------------
// The walk is a REAL 4-frame cycle (see public/buddy/walk/walk-1..4.png).
// Each frame is a genuinely distinct pose: contact (legs wide, body low),
// passing (legs crossing, body high), contact-mirror, passing-mirror.
// BuddyCharacter cycles through the 4 frames at WALK_FRAME_INTERVAL.
// WALK_DURATION is an exact multiple of (WALK_FRAMES * WALK_FRAME_INTERVAL)
// so the cycle loops an integer number of times during one walk, and the
// horizontal travel (driven by WALK_DURATION in page.tsx) stays perfectly
// in sync with the step animation — no sliding, no drift.
//
//   WALK_FRAMES         = 4 (genuinely distinct poses)
//   WALK_FRAME_INTERVAL = 130ms  (~7.7fps frame swap — slow enough to read
//                                 each pose clearly)
//   WALK_CYCLES         = 6
//   WALK_DURATION       = 4 * 130 * 6 = 3120ms
//
// 6 cycles over ~3.1s reads as a natural, readable walk. Each pose shows
// for 130ms (clearly visible). The cycle ends exactly on frame 4→1, so
// there's no half-frame stutter at the end.
export const WALK_FRAMES = 4;
export const WALK_FRAME_INTERVAL = 130;
export const WALK_CYCLES = 6;
export const WALK_DURATION = WALK_FRAMES * WALK_FRAME_INTERVAL * WALK_CYCLES; // 3120ms

// Turn duration. Short enough to feel snappy, long enough to read as a
// deliberate "turn around" rather than an instant flip. The character
// renderer swaps the image (front↔side, or side→side) at the midpoint
// (scaleX=0, invisible) so the swap is seamless.
export const TURN_DURATION = 480;

// Orient duration — the turn TOWARD THE USER after arriving at the
// destination. Same mechanic as TURN_DURATION (scaleX animates from the
// walk facing → 0 → +1 for front-facing), but slightly longer because the
// final pose (front-facing idle) is the "rest" state and the turn should
// feel like a relaxed "settling" rather than a snappy combat-style turn.
// The image swaps from the side-stand pose to the front-facing Phase-1 PNG
// at the midpoint (scaleX=0, invisible) so it's seamless.
export const ORIENT_DURATION = 560;

// --- Greeting (Phase 3A) timing (milliseconds) --------------------------
// The greeting is a one-shot frame sequence (NOT a loop). The wave clearly
// alternates: the hand goes center → side → center → opposite → center,
// repeated 3 times, so it reads as a real side-to-side wave (not a held
// pose). Each frame has its own duration.
//
// Frame sequence (13 total):
//   1.  idle (buddy-character.png)      — 300ms  (pause before raising)
//   2.  arm rising                      — 180ms
//   3.  arm raised (centered)           — 260ms  (neutral hold before wave)
//   4.  wave A (tilted right)           — 220ms
//   5.  centered                        — 160ms  (midpoint pass)
//   6.  wave B (tilted left)            — 220ms
//   7.  centered                        — 160ms
//   8.  wave A (tilted right)           — 220ms
//   9.  centered                        — 160ms
//   10. wave B (tilted left)            — 220ms
//   11. centered                        — 180ms  (settle before lowering)
//   12. arm lowering                     — 200ms
//   13. idle (buddy-character.png)      — 300ms  (settle)
//
// The tilted wave frames (220ms) are held slightly longer than the
// centered passes (160ms) so the side-to-side extremes are clearly
// readable, while the motion between them stays snappy.
export const GREET_FRAME_DURATIONS = [
  300, // 1. idle (pause before)
  180, // 2. arm rising
  260, // 3. arm raised (centered / neutral hold)
  220, // 4. wave A (tilted right)
  160, // 5. centered (midpoint pass)
  220, // 6. wave B (tilted left)
  160, // 7. centered (midpoint pass)
  220, // 8. wave A (tilted right)
  160, // 9. centered (midpoint pass)
  220, // 10. wave B (tilted left)
  180, // 11. centered (settle before lowering)
  200, // 12. arm lowering
  300, // 13. idle (settle)
];
export const GREET_DURATION = GREET_FRAME_DURATIONS.reduce((a, b) => a + b, 0); // 2880ms

// --- Celebration (Phase 3B) timing (milliseconds) -----------------------
// The celebration is a one-shot frame sequence (NOT a loop). The key moment
// is BOTH hands raised + a small hop, held briefly to read as "YES! 🎉".
//
// Frame sequence (9 total):
//   1. idle (buddy-character.png)      — 280ms  (pause before)
//   2. anticipation (crouch)          — 200ms
//   3. both arms rising               — 200ms
//   4. both arms fully raised         — 220ms
//   5. both arms raised + hop         — 320ms  (the key moment — held longer)
//   6. celebration pose held          — 320ms  (hold the "YES!")
//   7. body comes down (landing)      — 200ms
//   8. both arms lowering             — 220ms
//   9. idle (buddy-character.png)      — 280ms  (settle)
//
// The hop frame (5) is held a bit longer so the jump reads clearly, and
// the held pose (6) matches it so the celebration lingers. The hop is baked
// into frame 5's image (the character is airborne in that frame), so no
// translateY transform is needed — the frame itself shows the jump.
export const CELEBRATE_FRAME_DURATIONS = [
  280, // 1. idle (pause before)
  200, // 2. anticipation (crouch)
  200, // 3. both arms rising
  220, // 4. both arms fully raised
  320, // 5. both arms raised + hop (key moment)
  320, // 6. celebration pose held
  200, // 7. body comes down (landing)
  220, // 8. both arms lowering
  280, // 9. idle (settle)
];
export const CELEBRATE_DURATION = CELEBRATE_FRAME_DURATIONS.reduce((a, b) => a + b, 0); // 2240ms

// --- Sleep / Bed (Phase 3C) timing (milliseconds) ------------------------
// The bed is at a fixed position FURTHER LEFT than AWAY (outside the normal
// HOME↔AWAY walk path). BED_X is normalized like currentX (-1 = AWAY, +1 =
// HOME). -1.35 is left of AWAY (-1) but still on-screen given the playground
// clamp (offset ≈ pgWidth*0.32). The bed is placed at BED_X * offset from
// center.
export const BED_X = -1.05;

// How long the lying-down transition takes (standing → lying on the bed).
// The character swaps from the side-stand pose to the lying pose during
// this window (with a quick fade), then enters the SLEEPING phase.
export const LIE_DOWN_DURATION = 700;

// How long the wake transition takes (lying → standing). The character
// swaps from the lying pose back to a standing front-facing pose during
// this window, then returns to idle.
export const WAKE_DURATION = 800;

// The sleep breathing animation — a very subtle vertical scale applied to
// the lying pose while sleeping. Calm and slow so it reads as peaceful
// breathing, NOT bouncing. These are framer-motion transition values
// (seconds), used by BuddyCharacter's sleep breathe loop.
export const SLEEP_BREATHE = {
  duration: 3.2, // seconds per breathe cycle (slow, peaceful)
  repeat: Infinity,
  ease: 'easeInOut',
  // scaleY grows ~1.8% on inhale; scaleX contracts a touch.
  animate: { scaleY: [1, 1.018, 1], scaleX: [1, 0.994, 1] },
};

// --- Sulking / Disappointed (Phase 4B.5) timing (milliseconds) ----------
export const SULK_DURATION = 2200;

/**
 * Returns a time-of-day greeting phrase based on local time:
 *   Morning:   5:00 AM – 11:59 AM -> "Good morning da ☀️"
 *   Afternoon: 12:00 PM – 4:59 PM -> "Good afternoon da ☀️"
 *   Evening:   5:00 PM – 8:59 PM  -> "Good evening da 🌆"
 *   Night:     9:00 PM – 4:59 AM  -> "Good night da 🌙"
 */
export function getTimeOfDayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return 'Good morning da ☀️';
  }
  if (hour >= 12 && hour < 17) {
    return 'Good afternoon da ☀️';
  }
  if (hour >= 17 && hour < 21) {
    return 'Good evening da 🌆';
  }
  return 'Good night da 🌙';
}

// Promise helper used by the walkTo orchestrator in BuddyContext.
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

