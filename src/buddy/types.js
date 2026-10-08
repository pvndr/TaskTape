// src/buddy/types.js
//
// Buddy state machine — single source of truth for the character's
// behavioural states, plus the Phase 2 movement primitives
// (position / facing / phase).
//
// PHASE 1: IDLE state.
// PHASE 2: WALKING state + the movement system (positions, facings, phases).
// The other states (greeting, celebrating, etc.) are declared here so the
// architecture is ready for future phases, but are NOT wired up yet.
//
// To add a new state in a future phase:
//   1. Add it to BuddyState below.
//   2. Create src/buddy/animations/<state>.js exporting its motion config.
//   3. Register it in src/buddy/animations/index.js.
//   4. Add it to IMPLEMENTED_STATES so setState doesn't fall back to idle.
//   5. Add a control button in the dev panel if you want to trigger it.

export const BuddyState = Object.freeze({
  IDLE: 'idle',
  WALKING: 'walking',
  GREETING: 'greeting',
  CELEBRATING: 'celebrating',
  SLEEPING: 'sleeping',
  REMINDER: 'reminder',
  FOCUSED: 'focused',
});

// All known states, in the order they should appear in UI lists.
export const BUDDY_STATES = Object.values(BuddyState);

// States that are actually implemented (Phase 1 + 2 + 3A + 3B + 3C).
// Any state NOT in this set will fall back to IDLE if requested via setState.
export const IMPLEMENTED_STATES = Object.freeze([
  BuddyState.IDLE,
  BuddyState.WALKING,
  BuddyState.GREETING,
  BuddyState.CELEBRATING,
  BuddyState.SLEEPING,
]);

export function isImplementedState(state) {
  return IMPLEMENTED_STATES.includes(state);
}

// Resolve a requested state to a runnable one. Unknown / unimplemented
// states gracefully fall back to IDLE so the character never enters a
// broken/empty animation.
export function resolveState(requested) {
  if (requested && isImplementedState(requested)) return requested;
  return BuddyState.IDLE;
}

// ---------------------------------------------------------------------------
// Phase 2 — movement primitives
// ---------------------------------------------------------------------------

// Two clearly defined positions in the playground. HOME is on the RIGHT
// (Buddy's starting position); AWAY is on the LEFT. The movement between
// them is the only horizontal travel Buddy does in Phase 2.
// Phase 3C adds BED — a position FURTHER LEFT than AWAY, outside the
// normal HOME↔AWAY walk path, where the bed lives. Buddy walks to BED
// when sleeping.
export const BuddyPosition = Object.freeze({
  HOME: 'home',
  AWAY: 'away',
  BED: 'bed',
});

export const BUDDY_POSITIONS = Object.values(BuddyPosition);

// Horizontal facing. Drives the scaleX flip of the character and the lean
// direction while walking. Movement direction MUST match facing.
export const BuddyFacing = Object.freeze({
  LEFT: 'left',
  RIGHT: 'right',
});

// Detailed phase within the current state. The walking state is broken into
// sub-phases so the renderer can show a natural turn before the body moves,
// a natural turn toward the user after arriving, and so the playground knows
// when to animate the horizontal travel.
//
//   idle       — standing still (idle animation runs, occasional weight
//                shifts). After a walk, the character is front-facing
//                (toward the user).
//   turning    — rotating in place to face the walk direction (no horizontal
//                movement; idle loops keep running so the character doesn't
//                freeze; the facing layer animates the flip). Happens BEFORE
//                walking.
//   walking    — horizontal travel + real walk frame cycle, facing already
//                set to the walk direction.
//   orienting  — rotating in place to face the USER (front-facing) AFTER
//                arriving at the destination. The facing layer animates
//                scaleX → 0; at the midpoint (invisible) the image swaps
//                from the side-stand pose to the front-facing Phase-1 PNG;
//                then scaleX → +1. Ends in the normal front-facing idle.
//   greeting    — performing the "Good morning" wave gesture (Phase 3A).
//                Cycles through a one-shot sequence of front-facing frames
//                showing the arm raising, waving 2-3 times, and lowering.
//                A speech bubble appears during this phase. Ends by
//                returning to the front-facing idle. Buddy stays in place
//                (no horizontal movement).
//   celebrating — performing the "Nice!" celebration gesture (Phase 3B).
//                A one-shot sequence of front-facing frames: anticipation,
//                both arms rising, both arms raised, a small hop, held pose,
//                arms lowering, return to idle. A "Nice! 🎉" speech bubble
//                appears. Buddy stays in place (no horizontal movement).
//   lying_down  — transitioning from standing to lying on the bed (Phase 3C).
//                After walking to the bed and turning toward it, the character
//                swaps to the lying-down pose. A brief transition.
//   sleeping   — lying on the bed, eyes closed, with a subtle breathing
//                animation (Phase 3C). Walking, greeting, and celebration are
//                disabled. Remains sleeping until [Wake] is triggered.
//   waking     — transitioning from lying back to standing (Phase 3C). A
//                brief transition where Buddy rises from the bed and returns
//                to a standing front-facing idle.
export const BuddyPhase = Object.freeze({
  IDLE: 'idle',
  TURNING: 'turning',
  WALKING: 'walking',
  ORIENTING: 'orienting',
  GREETING: 'greeting',
  CELEBRATING: 'celebrating',
  LYING_DOWN: 'lying_down',
  SLEEPING: 'sleeping',
  WAKING: 'waking',
  SULKING: 'sulking',
});
