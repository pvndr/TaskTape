import { useState, useEffect, useRef, useCallback } from 'react';
import { BUDDY_STATES } from './types';

/**
 * Character Intent States
 */
export const CHARACTER_INTENT = {
  CHILLING: 'CHILLING',
  WANDERING: 'WANDERING',
  PAUSING: 'PAUSING',
  RETURNING_HOME: 'RETURNING_HOME',
  REACTING: 'REACTING'
};

/**
 * useBuddyMovement Hook
 * Implements purposeful, intent-driven companion behavior:
 * - Lives in an invisible bottom-right home space (~160-230px wide).
 * - Spends most time chilling at home with subtle breathing.
 * - Occasionally decides to wander 60-110px out toward the task area with discrete step bobbing.
 * - Stops, pauses to look at the tasks, then eventually walks back home.
 * - Reacts immediately to TaskTape events (always stops, faces task board, reacts).
 * - Follows React's strict Rules of Hooks (unconditional hook calls, zero setters inside updaters).
 */
export function useBuddyMovement(state, isTalking) {
  const [offsetX, setOffsetX] = useState(0); // 0 = resting home spot on right
  const [facing, setFacing] = useState('left'); // Faces inward toward tasks
  const [isMoving, setIsMoving] = useState(false);
  const [moveDuration, setMoveDuration] = useState(1800);
  const [intent, setIntent] = useState(CHARACTER_INTENT.CHILLING);
  const [subState, setSubState] = useState('idle'); // 'idle' | 'sway'

  const offsetXRef = useRef(0);
  const transitTimerRef = useRef(null);
  const cycleTimerRef = useRef(null);
  const returnTimerRef = useRef(null);
  const lookTimerRef = useRef(null);

  const clearAllTimers = useCallback(() => {
    if (transitTimerRef.current) {
      clearTimeout(transitTimerRef.current);
      transitTimerRef.current = null;
    }
    if (cycleTimerRef.current) {
      clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
    if (returnTimerRef.current) {
      clearTimeout(returnTimerRef.current);
      returnTimerRef.current = null;
    }
    if (lookTimerRef.current) {
      clearTimeout(lookTimerRef.current);
      lookTimerRef.current = null;
    }
  }, []);

  /**
   * Helper to execute a natural walking move with calculated duration based on distance.
   * State updates are executed top-level (NEVER inside another setState updater function).
   */
  const walkTo = useCallback(
    (targetX, onArrival = null) => {
      const currentX = offsetXRef.current;
      const distance = Math.abs(targetX - currentX);
      if (distance < 8) return; // Skip micro-shuffles

      // Face destination
      if (targetX > currentX) {
        setFacing('right');
      } else {
        setFacing('left');
      }

      // Natural walking speed (~42px/sec + 350ms accel/decel)
      const duration = Math.min(2400, Math.max(1400, Math.round(distance * 20 + 350)));
      setMoveDuration(duration);
      setIsMoving(true);
      setSubState('idle');

      offsetXRef.current = targetX;
      setOffsetX(targetX);

      if (transitTimerRef.current) clearTimeout(transitTimerRef.current);
      transitTimerRef.current = setTimeout(() => {
        setIsMoving(false);
        transitTimerRef.current = null;
        if (onArrival) onArrival();
      }, duration);
    },
    []
  );

  /**
   * Main Autonomous Companion Life Cycle
   */
  useEffect(() => {
    // If Buddy is talking or in a reaction state, stop movement immediately and face board
    if (state !== BUDDY_STATES.IDLE || isTalking) {
      clearAllTimers();
      setIsMoving(false);
      setSubState('idle');
      setIntent(CHARACTER_INTENT.REACTING);
      setFacing('left');
      return;
    }

    const scheduleNextIntent = () => {
      // Unhurried chill duration: 15s to 28s of doing nothing
      const chillDelay = Math.random() * 13000 + 15000;

      cycleTimerRef.current = setTimeout(() => {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;
        const roll = Math.random();

        // 1. Casual Glance/Sway in place (~25%)
        if (roll < 0.25) {
          setSubState('sway');
          setFacing('right'); // Glances slightly outward
          lookTimerRef.current = setTimeout(() => {
            setSubState('idle');
            setFacing('left'); // Settles back facing the board
            scheduleNextIntent();
          }, 2400);
          return;
        }

        // 2. Meaningful Walk toward the Task Area (~75%)
        // Real perceptible travel distance: 60-110px on desktop, 45-75px on mobile
        const wanderDistance = isDesktop
          ? Math.round(-Math.random() * 45 - 65)  // -65px to -110px
          : Math.round(-Math.random() * 30 - 45); // -45px to -75px

        setIntent(CHARACTER_INTENT.WANDERING);

        walkTo(wanderDistance, () => {
          // Arrived out at the destination:
          // Stop walking, face the board, and PAUSE to look at the tasks!
          setIntent(CHARACTER_INTENT.PAUSING);
          setFacing('left');

          // Pause and observe the tasks for 9s to 16s
          const pauseToLookDuration = Math.random() * 7000 + 9000;
          returnTimerRef.current = setTimeout(() => {
            // After observing, casually walk back HOME to the resting spot
            setIntent(CHARACTER_INTENT.RETURNING_HOME);

            walkTo(0, () => {
              // Arrived back home:
              setFacing('left'); // Turn back to face the board
              setIntent(CHARACTER_INTENT.CHILLING);
              // Settle into next chill cycle
              scheduleNextIntent();
            });
          }, pauseToLookDuration);
        });
      }, chillDelay);
    };

    scheduleNextIntent();

    return () => clearAllTimers();
  }, [state, isTalking, clearAllTimers, walkTo]);

  return {
    offsetX,
    facing,
    isMoving,
    moveDuration,
    intent,
    subState
  };
}
