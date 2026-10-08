// src/buddy/animations/idle.js
//
// IDLE animation definition for Buddy.
//
// Design goals (from the spec):
//   - breathe SUBTLY (very small vertical scale, slow)
//   - tiny natural body movement (micro sway)
//   - OCCASIONALLY shift weight (rare, holds, then returns — NOT a loop)
//   - remain mostly still
//   - NOT a constant bounce / float / shake / teleport
//
// The animation is split into two layers so they can be combined cleanly
// inside BuddyCharacter.jsx:
//
//   1. `loops` — continuous, slow, looping motions applied to nested
//      wrappers around the character image.
//      - breathe:  subtle vertical expansion/contraction (chest breathing)
//      - sway:     tiny rotational sway (like a person shifting balance)
//
//   2. `occasional` — rare one-shot events scheduled at random intervals.
//      - weightShift: lean slightly to one side, hold, return to center.
//        Side alternates so it never drifts in one direction.
//
// UNITS (important — read before editing):
//   - `loops[i].transition` is passed VERBATIM to framer-motion, so its
//     `duration` is in SECONDS (framer-motion's convention).
//   - `occasional[i].every` and `.hold` are used with setTimeout, so they
//     are in MILLISECONDS.
//   - `occasional[i].enterDuration` and `.exitDuration` are ALSO in
//     MILLISECONDS. BuddyCharacter divides them by 1000 before passing
//     to framer-motion's `transition.duration` (which needs seconds).
//     They double as the setTimeout delay after the exit pose, so keeping
//     them in ms keeps the scheduling math consistent.
//
// All magnitudes are deliberately small. The transform-origin is set to
// 'bottom center' on the character wrapper so breathing/sway pivot from
// the feet (where the character is planted), not the middle.

export const IDLE_ANIMATION = {
  name: 'idle',

  // Continuous looping motions. Each entry is a framer-motion `animate`
  // target paired with a `transition`. BuddyCharacter applies these to
  // nested <motion.div> wrappers, innermost first.
  loops: [
    {
      key: 'breathe',
      animate: {
        // Very small breathing. scaleY grows ~1.2% on inhale, scaleX
        // contracts a touch (chest expands vertically as it fills).
        scaleY: [1, 1.012, 1],
        scaleX: [1, 0.994, 1],
      },
      transition: {
        duration: 4.6, // seconds (framer-motion native)
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
    {
      key: 'sway',
      animate: {
        // Tiny rotational sway. ±0.35deg — barely perceptible but alive.
        rotate: [-0.35, 0.35, -0.35],
      },
      transition: {
        duration: 7.2, // seconds (framer-motion native)
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  ],

  // Rare one-shot events. BuddyCharacter schedules the next occurrence
  // at a random delay within `every` (ms). `hold` is how long the pose is
  // held (ms) before easing back to neutral.
  occasional: [
    {
      key: 'weightShift',
      every: [9000, 16000], // ms — 9–16s between shifts
      hold: 2600,            // ms — hold the lean for 2.6s
      // The pose to ease INTO during the shift. `side` is resolved by the
      // component to +1 / -1 (alternating) so it never drifts one way.
      pose: (side) => ({
        // ~6px nudge horizontally + ~0.8deg tilt
        x: side * 6,
        rotate: side * 0.8,
      }),
      // Neutral pose to return to after the hold.
      neutral: { x: 0, rotate: 0 },
      // Durations in MILLISECONDS (see "UNITS" note at the top of this file).
      // We use named eases — framer-motion v12's cubic-bezier array handling
      // is finicky for extreme curves, and named eases are robust + readable.
      enterDuration: 1100,
      exitDuration: 1300,
      enterEase: 'easeOut',  // settle into the lean
      exitEase: 'easeInOut', // ease smoothly back to center
    },
  ],
};

export default IDLE_ANIMATION;
