// src/buddy/BuddyCharacter.jsx
//
// Renders the Buddy character with the animation that matches the current
// movement phase.
//
// PHASE 2 — REAL WALK CYCLE:
// The walk is now an actual 8-frame cycle (see public/buddy/walk/walk-1..8.png).
// Each frame is a different walking pose (alternating legs, swinging arms).
// During the walking phase, BuddyCharacter cycles through the 8 frames at
// WALK_FRAME_INTERVAL, synchronized to the playground's horizontal travel
// (WALK_DURATION is an exact multiple of the cycle so there's no sliding).
// Pausing mid-walk shows a DIFFERENT pose — it is NOT a translated standing
// PNG.
//
// Image selection by (viewMode, phase):
//   viewMode='front', phase=idle        → front-facing Phase-1 PNG (initial)
//   viewMode='side',  phase=idle        → side-profile standing pose (facing
//                                         the current facing, flipped if left)
//   viewMode='side',  phase=turning    → side-profile standing pose (or the
//                                         front PNG before the first turn's
//                                         midpoint swap), with scaleX
//                                         animating [old, 0, new] over
//                                         TURN_DURATION. The image swaps at
//                                         the midpoint (scaleX=0, invisible)
//                                         so the swap is seamless.
//   viewMode='side',  phase=walking    → cycle walk frames 1..8 (flipped if
//                                         facing left)
//
// Facing: the walk frames and side-standing pose are drawn facing RIGHT.
// Facing LEFT is achieved by flipping scaleX to -1. This guarantees the
// character VISIBLY faces the direction it moves:
//   walking LEFT  → frames flipped (scaleX -1), moves LEFT
//   walking RIGHT → frames as-is (scaleX +1), moves RIGHT
//
// Layer stack (outermost → innermost):
//   occasional (weight shift, idle only)  ← world space
//   facing    (scaleX flip; animates during turn) ← flips everything inside
//   loops     (breathe + sway; idle/turning only; empty during walking)
//   <img src={current frame} />
//
// All pivots use transformOrigin 'bottom center' so feet stay planted.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useBuddy } from './BuddyContext';
import { getAnimationForPhase } from './animations';
import {
  BUDDY_CHARACTER_PNG,
  BUDDY_STAND_RIGHT_PNG,
  BUDDY_LYING_PNG,
  WALK_FRAMES,
  GREET_FRAMES,
  CELEBRATE_FRAMES,
} from './assets';
import { BuddyPhase, BuddyFacing } from './types';
import {
  facingScaleX,
  TURN_DURATION,
  ORIENT_DURATION,
  WALK_FRAME_INTERVAL,
  GREET_FRAME_DURATIONS,
  CELEBRATE_FRAME_DURATIONS,
  SLEEP_BREATHE,
  SULK_DURATION,
} from './movement';

// Tiny helper to pick a random delay inside [min, max].
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export default function BuddyCharacter({
  // Visual size hint (CSS). Sized by height so proportions are always
  // correct. min() keeps the character inside narrow viewports.
  height = 'min(58vh, 86vw)',
  className = '',
  maxHeight = null,
  lyingWidth = null,
}) {
  const { phase, facing, turnTarget, viewMode } = useBuddy();
  // The idle animation (breathing + sway + occasional weight shift) only
  // applies when NOT walking, greeting, celebrating, lying down, sleeping,
  // or waking. During those phases the frame sequence / pose IS the
  // animation. During orienting (turn toward user) the idle loops keep
  // running so the character doesn't freeze.
  const idleAnim = useMemo(() => getAnimationForPhase(BuddyPhase.IDLE), []);
  const useIdleLoops =
    phase !== BuddyPhase.WALKING &&
    phase !== BuddyPhase.GREETING &&
    phase !== BuddyPhase.CELEBRATING &&
    phase !== BuddyPhase.LYING_DOWN &&
    phase !== BuddyPhase.SLEEPING &&
    phase !== BuddyPhase.WAKING &&
    phase !== BuddyPhase.SULKING;

  // --- Walk frame cycling -------------------------------------------------
  // Advance through the 8 real walk frames at a fixed interval while the
  // phase is 'walking'. The interval and WALK_DURATION are chosen so an
  // integer number of cycles fits in one walk (no drift / sliding).
  const [frameIndex, setFrameIndex] = useState(0);
  useEffect(() => {
    if (phase !== BuddyPhase.WALKING) return;
    let cancelled = false;
    const iv = setInterval(() => {
      if (!cancelled) setFrameIndex((i) => (i + 1) % WALK_FRAMES.length);
    }, WALK_FRAME_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [phase]);

  // --- Greeting frame cycling (one-shot, per-frame durations) ------------
  // The greeting is a ONE-SHOT sequence (not a loop). Each frame has its own
  // duration (GREET_FRAME_DURATIONS), so we use a recursive setTimeout chain
  // instead of a fixed-interval setInterval. Advances greetIndex 0→N over
  // GREET_DURATION, then stops (the orchestrator dispatches GREET_END).
  const [greetIndex, setGreetIndex] = useState(0);
  // Reset greetIndex to 0 when entering the greeting phase (lint-safe
  // "adjust state during render" pattern).
  const [prevGreetPhase, setPrevGreetPhase] = useState(phase);
  if (phase !== prevGreetPhase) {
    setPrevGreetPhase(phase);
    if (phase === BuddyPhase.GREETING) setGreetIndex(0);
  }
  useEffect(() => {
    if (phase !== BuddyPhase.GREETING) return;
    let cancelled = false;
    let timer = null;
    function advance(idx) {
      if (cancelled || idx >= GREET_FRAMES.length) return;
      const dur = GREET_FRAME_DURATIONS[idx] || 200;
      timer = setTimeout(() => {
        if (cancelled) return;
        setGreetIndex(idx + 1);
        advance(idx + 1);
      }, dur);
    }
    advance(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase]);

  // --- Celebration frame cycling (one-shot, per-frame durations) ---------
  // Same mechanic as greeting: a recursive setTimeout chain advances
  // celebrateIndex 0→N over CELEBRATE_DURATION, then stops.
  const [celebrateIndex, setCelebrateIndex] = useState(0);
  const [prevCelebratePhase, setPrevCelebratePhase] = useState(phase);
  if (phase !== prevCelebratePhase) {
    setPrevCelebratePhase(phase);
    if (phase === BuddyPhase.CELEBRATING) setCelebrateIndex(0);
  }
  useEffect(() => {
    if (phase !== BuddyPhase.CELEBRATING) return;
    let cancelled = false;
    let timer = null;
    function advance(idx) {
      if (cancelled || idx >= CELEBRATE_FRAMES.length) return;
      const dur = CELEBRATE_FRAME_DURATIONS[idx] || 200;
      timer = setTimeout(() => {
        if (cancelled) return;
        setCelebrateIndex(idx + 1);
        advance(idx + 1);
      }, dur);
    }
    advance(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase]);

  // --- Turn / Orient: swap the image at the midpoint (scaleX=0, invisible) --
  // During the FIRST turn (front→side, phase=TURNING), the image swaps from
  // the front-facing Phase-1 PNG to the side-profile standing pose at the
  // midpoint. For subsequent turns (side→side) the image is already the
  // side-standing pose, so the swap is a no-op.
  //
  // During ORIENTING (side→front, the turn toward the user after arriving),
  // the image swaps from the side-stand pose to the front-facing PNG at the
  // midpoint — the reverse of the first turn.
  const [turnSwapped, setTurnSwapped] = useState(false);
  const [orientSwapped, setOrientSwapped] = useState(false);
  // Reset swap flags when leaving the corresponding phase, using the
  // lint-safe "adjust state during render" pattern (no setState-in-effect).
  const [prevPhase, setPrevPhase] = useState(phase);
  if (phase !== prevPhase) {
    setPrevPhase(phase);
    if (phase !== BuddyPhase.TURNING) setTurnSwapped(false);
    if (phase !== BuddyPhase.ORIENTING) setOrientSwapped(false);
  }
  useEffect(() => {
    if (phase === BuddyPhase.TURNING) {
      const t = setTimeout(() => setTurnSwapped(true), TURN_DURATION / 2);
      return () => clearTimeout(t);
    }
    if (phase === BuddyPhase.ORIENTING) {
      const t = setTimeout(() => setOrientSwapped(true), ORIENT_DURATION / 2);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase]);

  // --- Decide which image to show -----------------------------------------
  //   viewMode='front', idle              → front-facing Phase-1 PNG (initial)
  //   viewMode='side',  idle              → side-profile standing pose (flipped)
  //   viewMode='side',  turning          → before midpoint: front PNG (first
  //                                        turn) or side-stand; after: side-stand
  //   viewMode='side',  walking          → walk frame[frameIndex] (flipped if left)
  //   viewMode='side',  orienting        → before midpoint: side-stand; after:
  //                                        front-facing PNG (the turn-toward-user
  //                                        swap)
  //   greeting                           → GREET_FRAMES[greetIndex] (front-facing
  //                                        arm-raise/wave/lower sequence)
  //   celebrating                        → CELEBRATE_FRAMES[celebrateIndex]
  //                                        (front-facing both-hands-up + hop)
  //   lying_down / sleeping / waking     → BUDDY_LYING_PNG (the lying pose on
  //                                        the bed; the sleep breathe loop is
  //                                        applied during sleeping)
  let src;
  if (
    phase === BuddyPhase.LYING_DOWN ||
    phase === BuddyPhase.SLEEPING ||
    phase === BuddyPhase.WAKING
  ) {
    src = BUDDY_LYING_PNG;
  } else if (phase === BuddyPhase.GREETING) {
    const idx = Math.min(greetIndex, GREET_FRAMES.length - 1);
    src = GREET_FRAMES[idx];
  } else if (phase === BuddyPhase.CELEBRATING) {
    const idx = Math.min(celebrateIndex, CELEBRATE_FRAMES.length - 1);
    src = CELEBRATE_FRAMES[idx];
  } else if (phase === BuddyPhase.WALKING) {
    src = WALK_FRAMES[frameIndex];
  } else if (phase === BuddyPhase.ORIENTING) {
    src = orientSwapped ? BUDDY_CHARACTER_PNG : BUDDY_STAND_RIGHT_PNG;
  } else if (viewMode === 'front' && !(phase === BuddyPhase.TURNING && turnSwapped)) {
    src = BUDDY_CHARACTER_PNG;
  } else {
    src = BUDDY_STAND_RIGHT_PNG;
  }

  // --- Facing layer (scaleX) ----------------------------------------------
  // The walk frames and side-standing pose are drawn facing RIGHT.
  // LEFT facing = scaleX -1 (mirror). During turning, scaleX animates from
  // the current facing to the turn target via 0 (the "turn away" effect).
  // During orienting (turn toward user), scaleX animates from the current
  // walk facing (±1) → 0 → +1 (front-facing), so the character ends up
  // facing the user. During greeting, celebrating, and sleep phases the
  // character is front-facing (the frames/pose are front-facing), so
  // scaleX = +1 (no flip).
  const currentScaleX = facingScaleX(facing);
  const isTurning = phase === BuddyPhase.TURNING;
  const isOrienting = phase === BuddyPhase.ORIENTING;
  const isGreeting = phase === BuddyPhase.GREETING;
  const isCelebrating = phase === BuddyPhase.CELEBRATING;
  const isSleepingPhase =
    phase === BuddyPhase.LYING_DOWN ||
    phase === BuddyPhase.SLEEPING ||
    phase === BuddyPhase.WAKING;
  const turnTargetScaleX = turnTarget ? facingScaleX(turnTarget) : currentScaleX;
  const facingAnimate = isTurning
    ? { scaleX: [currentScaleX, 0, turnTargetScaleX] }
    : isOrienting
      ? { scaleX: [currentScaleX, 0, 1] } // turn toward user: side → front (+1)
      : isGreeting || isCelebrating || isSleepingPhase || phase === BuddyPhase.SULKING
        ? { scaleX: 1 } // greeting/celebrating/sleeping/sulking are front-facing — no flip
        : { scaleX: currentScaleX };
  const facingTransition = isTurning
    ? { duration: TURN_DURATION / 1000, ease: 'easeInOut' }
    : isOrienting
      ? { duration: ORIENT_DURATION / 1000, ease: 'easeInOut' }
      : { duration: 0 };

  // --- Occasional weight-shift (idle only) --------------------------------
  const [occasionalPose, setOccasionalPose] = useState({});
  const timerRef = useRef(null);
  const sideRef = useRef(1);

  // Reset occasional poses when the phase changes (lint-safe "adjust state
  // during render" pattern).
  const [prevKey, setPrevKey] = useState(phase);
  if (phase !== prevKey) {
    setPrevKey(phase);
    setOccasionalPose({});
  }

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (phase !== BuddyPhase.IDLE) return;

    const events = idleAnim?.occasional || [];
    if (events.length === 0) return;

    let cancelled = false;
    function scheduleNext() {
      if (cancelled) return;
      const ev = events[Math.floor(Math.random() * events.length)];
      const delay = randomBetween(ev.every[0], ev.every[1]);
      timerRef.current = setTimeout(() => fire(ev), delay);
    }
    function fire(ev) {
      if (cancelled) return;
      const side = sideRef.current;
      sideRef.current = -side;
      const enterPose = ev.pose ? ev.pose(side) : {};
      setOccasionalPose((prev) => ({ ...prev, [ev.key]: enterPose }));
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        setOccasionalPose((prev) => ({ ...prev, [ev.key]: ev.neutral }));
        timerRef.current = setTimeout(scheduleNext, ev.exitDuration || 800);
      }, ev.hold || 2000);
    }
    scheduleNext();
    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [idleAnim, phase]);

  const occasionalKey = idleAnim?.occasional?.[0]?.key;
  const currentOccasional =
    phase === BuddyPhase.IDLE ? occasionalPose[occasionalKey] || {} : {};
  const occasionalAnimate = {
    x: currentOccasional.x ?? 0,
    rotate: currentOccasional.rotate ?? 0,
  };
  const occasionalTransition = (() => {
    const ev = idleAnim?.occasional?.[0];
    if (!ev) return undefined;
    const isShifted =
      currentOccasional.x !== undefined && currentOccasional.x !== 0;
    const durMs = isShifted ? ev.enterDuration : ev.exitDuration;
    return {
      duration: durMs / 1000,
      ease: isShifted ? ev.enterEase : ev.exitEase,
    };
  })();

  // --- Idle loops (breathe + sway; idle/turning only) ---------------------
  // During walking, no framer-motion transform loops run — the 8 walk
  // frames ARE the animation. Adding a transform loop on top would conflict
  // with the frame's own poses.
  const loops = useIdleLoops ? idleAnim?.loops || [] : [];

  // The lying pose (sleep phases) is a horizontal image, so it needs
  // width-based sizing instead of height-based. We use a width that's
  // roughly 2× the standing height (since the lying pose is ~2:1 aspect
  // and shows the full body lying down).
  const isLyingPose =
    phase === BuddyPhase.LYING_DOWN ||
    phase === BuddyPhase.SLEEPING ||
    phase === BuddyPhase.WAKING;

  // --- Build the nested motion wrappers ----------------------------------
  let inner = (
    <motion.img
      key={src} // re-mount on src change so the frame swaps cleanly
      src={src}
      alt="Buddy"
      draggable={false}
      className="buddy-character__img select-none"
      style={
        isLyingPose
          ? {
              // Lying pose: horizontal — size by width to fit on the bed.
              // The bed is ~22% of the playground width, so the lying pose
              // should be roughly that wide. We use a width that scales
              // with the viewport but is capped so it doesn't overflow.
              // The standing pose is min(58vh, 86vw) tall; the lying pose
              // is ~2:1 aspect, so its width ≈ the standing height × 2, but
              // we cap it to keep it on the bed.
              width: lyingWidth || `min(40vh, 60vw)`,
              height: 'auto',
              display: 'block',
              filter: 'none',
              imageRendering: 'auto',
            }
          : {
              height,
              maxHeight: maxHeight ?? undefined,
              width: 'auto',
              display: 'block',
              filter: 'none',
              imageRendering: 'auto',
            }
      }
    />
  );

  // During SLEEPING, add the sleep breathe loop (very subtle vertical scale)
  // directly on top of the lying image. Calm and slow so it reads as
  // peaceful breathing, NOT bouncing.
  if (phase === BuddyPhase.SLEEPING) {
    inner = (
      <motion.div
        key="sleep-breathe"
        animate={SLEEP_BREATHE.animate}
        transition={{
          duration: SLEEP_BREATHE.duration,
          repeat: SLEEP_BREATHE.repeat,
          ease: SLEEP_BREATHE.ease,
        }}
        style={{
          display: 'inline-block',
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {inner}
      </motion.div>
    );
  }

  // During SULKING, add subtle playful droop and slight glance
  if (phase === BuddyPhase.SULKING) {
    inner = (
      <motion.div
        key="sulk-droop"
        animate={{
          y: [0, 4, 6, 6, 4, 0],
          rotate: [0, -1.2, -1.8, -1.8, -0.6, 0],
          scaleY: [1, 0.98, 0.965, 0.965, 0.98, 1],
        }}
        transition={{
          duration: SULK_DURATION / 1000,
          ease: 'easeInOut',
        }}
        style={{
          display: 'inline-block',
          transformOrigin: 'bottom center',
          willChange: 'transform',
        }}
      >
        {inner}
      </motion.div>
    );
  }

  // Apply idle loops innermost-first (only when useIdleLoops). During
  // walking, loops is empty, so this loop is skipped and the <img> is used
  // directly inside the facing layer (cycling frames).
  for (let i = 0; i < loops.length; i++) {
    const loop = loops[i];
    inner = (
      <motion.div
        key={loop.key}
        animate={loop.animate}
        transition={loop.transition}
        style={{
          display: 'inline-block',
          transformOrigin: 'bottom center',
          willChange: 'transform',
        }}
      >
        {inner}
      </motion.div>
    );
  }

  // Facing layer wraps everything inside (so the whole character flips).
  inner = (
    <motion.div
      key="facing"
      animate={facingAnimate}
      transition={facingTransition}
      style={{
        display: 'inline-block',
        transformOrigin: 'bottom center',
        willChange: 'transform',
      }}
    >
      {inner}
    </motion.div>
  );

  // Occasional layer wraps the facing layer (weight shift in world space).
  inner = (
    <motion.div
      key="occasional"
      animate={occasionalAnimate}
      transition={occasionalTransition}
      style={{
        display: 'inline-block',
        transformOrigin: 'bottom center',
        willChange: 'transform',
      }}
    >
      {inner}
    </motion.div>
  );

  return (
    <div
      className={`buddy-character ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        transformOrigin: 'bottom center',
        willChange: 'transform',
      }}
      aria-label="Buddy character"
      role="img"
    >
      {inner}
    </div>
  );
}
