// src/buddy/BuddyContext.jsx
//
// BuddyContext owns the character's state machine + continuous horizontal
// position loop, and bridges TaskTape events (time-of-day daily greeting,
// welcome back, task completion celebration, playful uncompletion sulk,
// creation acknowledgments, and oldest-task reminders).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  BuddyState,
  BuddyPhase,
  BuddyFacing,
  BuddyPosition,
  resolveState,
} from './types';
import {
  TURN_DURATION,
  WALK_DURATION,
  ORIENT_DURATION,
  GREET_DURATION,
  CELEBRATE_DURATION,
  BED_X,
  LIE_DOWN_DURATION,
  WAKE_DURATION,
  SULK_DURATION,
  getTimeOfDayGreeting,
  facingForTarget,
  wait,
} from './movement';

// Normalized X for each named position: +1 = HOME (right), -1 = AWAY (left),
// BED_X = bed (further left than AWAY).
const POS_X = {
  [BuddyPosition.HOME]: 1,
  [BuddyPosition.AWAY]: -1,
  [BuddyPosition.BED]: BED_X,
};

// Phrase pools for contextual TaskTape events
const CREATED_PHRASES = ['Got it 👀', 'On it.', 'Added.', 'Noted 👍'];
const CELEBRATE_PHRASES = ['Nice! 🎉', 'Done deal ✨', 'Another one down.', 'Nice work.'];
const STREAK_PHRASES = ['Look at you go 👀', "You're getting through them.", 'On a roll! 🔥'];
const ALL_DONE_PHRASES = ['All clear 🙌', 'Tape is clean! All done 🙌', 'Nothing left! Nice work ✨'];
const REMINDER_PHRASES = ["That one's been waiting for you 👀", 'Want to knock this one out?'];
const UNCOMPLETED_PHRASES = [
  'Aww… changed your mind? 😔',
  'Back to the list it goes 👀',
  'Okay okay 😅',
  'Not done yet, huh?',
];
const WELCOME_BACK_PHRASES = [
  'Welcome back da 👋',
  'Back again? 😄',
  'Hey, welcome back.',
  "You're back 👀",
];

// Avoid picking the exact same phrase consecutively from any pool
function pickPhrase(pool, lastPhrase = null) {
  if (!pool || pool.length === 0) return '';
  if (pool.length === 1) return pool[0];
  const candidates = lastPhrase ? pool.filter((p) => p !== lastPhrase) : pool;
  const choicePool = candidates.length > 0 ? candidates : pool;
  return choicePool[Math.floor(Math.random() * choicePool.length)];
}

// easeInOutQuad — slow start and end, natural for walking start/stop.
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
}

// Check whether an initial entrance walk should be prepared on app open
function shouldPerformEntrance() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true') {
      return true;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    let foundGreetingToday = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tasktape_buddy_greeting_')) {
        if (localStorage.getItem(key) === todayStr) {
          foundGreetingToday = true;
          break;
        }
      }
    }
    return !foundGreetingToday;
  } catch (e) {
    return false;
  }
}

const BuddyContext = createContext(null);

const initial = {
  requested: BuddyState.IDLE,
  resolved: BuddyState.IDLE,
  phase: BuddyPhase.IDLE,
  facing: BuddyFacing.RIGHT,
  position: BuddyPosition.HOME,
  currentX: POS_X[BuddyPosition.HOME], // start at HOME
  walkTarget: null,
  turnTarget: null,
  busy: false,
  viewMode: 'front',
};

function getInitialState(initialState = BuddyState.IDLE) {
  const needsEntrance = shouldPerformEntrance();
  if (needsEntrance) {
    return {
      requested: initialState,
      resolved: resolveState(initialState),
      phase: BuddyPhase.IDLE,
      facing: BuddyFacing.RIGHT,
      position: BuddyPosition.AWAY,
      currentX: POS_X[BuddyPosition.AWAY], // start at entrance
      walkTarget: null,
      turnTarget: null,
      busy: false,
      viewMode: 'side', // side profile facing toward HOME
    };
  }
  return {
    ...initial,
    requested: initialState,
    resolved: resolveState(initialState),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'PREPARE_ENTRANCE':
      return {
        ...state,
        requested: BuddyState.IDLE,
        resolved: BuddyState.IDLE,
        phase: BuddyPhase.IDLE,
        position: BuddyPosition.AWAY,
        currentX: POS_X[BuddyPosition.AWAY],
        facing: BuddyFacing.RIGHT,
        viewMode: 'side',
        walkTarget: null,
        turnTarget: null,
        busy: false,
      };

    case 'SET_POSITION_HOME':
      return {
        ...state,
        requested: BuddyState.IDLE,
        resolved: BuddyState.IDLE,
        phase: BuddyPhase.IDLE,
        position: BuddyPosition.HOME,
        currentX: POS_X[BuddyPosition.HOME],
        facing: BuddyFacing.RIGHT,
        viewMode: 'front',
        walkTarget: null,
        turnTarget: null,
        busy: false,
      };

    case 'SET_STATE': {
      const requested = action.payload;
      const resolved = resolveState(requested);
      if (requested === state.requested && resolved === state.resolved && !state.busy) {
        return state;
      }
      if (resolved === BuddyState.IDLE) {
        const needOrient = state.viewMode === 'side';
        return {
          ...state,
          requested,
          resolved: needOrient ? BuddyState.WALKING : BuddyState.IDLE,
          phase: needOrient ? BuddyPhase.ORIENTING : BuddyPhase.IDLE,
          walkTarget: null,
          turnTarget: null,
          busy: needOrient,
        };
      }
      return { ...state, requested, resolved };
    }

    case 'TURN_START':
      return {
        ...state,
        requested: BuddyState.WALKING,
        resolved: BuddyState.WALKING,
        phase: BuddyPhase.TURNING,
        turnTarget: action.turnTarget,
        busy: true,
        viewMode: 'side',
      };

    case 'WALK_START': {
      return {
        ...state,
        phase: BuddyPhase.WALKING,
        facing: action.facing,
        turnTarget: null,
        walkTarget: action.target,
        busy: true,
        viewMode: 'side',
      };
    }

    case 'TICK':
      return { ...state, currentX: action.x };

    case 'WALK_END':
      return {
        ...state,
        phase: BuddyPhase.ORIENTING,
        position: action.position,
        currentX: POS_X[action.position],
        walkTarget: null,
        turnTarget: null,
      };

    case 'ORIENT_END':
      return {
        ...state,
        requested: BuddyState.IDLE,
        resolved: BuddyState.IDLE,
        phase: BuddyPhase.IDLE,
        walkTarget: null,
        turnTarget: null,
        busy: false,
        viewMode: 'front',
      };

    case 'GREET_START':
      return {
        ...state,
        requested: BuddyState.GREETING,
        resolved: BuddyState.GREETING,
        phase: BuddyPhase.GREETING,
        walkTarget: null,
        turnTarget: null,
        busy: true,
        viewMode: 'front',
      };

    case 'GREET_ORIENT_START':
      return {
        ...state,
        requested: BuddyState.GREETING,
        resolved: BuddyState.GREETING,
        phase: BuddyPhase.ORIENTING,
        walkTarget: null,
        turnTarget: null,
        busy: true,
      };

    case 'GREET_END':
      return {
        ...state,
        requested: BuddyState.IDLE,
        resolved: BuddyState.IDLE,
        phase: BuddyPhase.IDLE,
        walkTarget: null,
        turnTarget: null,
        busy: false,
        viewMode: 'front',
      };

    case 'CELEBRATE_START':
      return {
        ...state,
        requested: BuddyState.CELEBRATING,
        resolved: BuddyState.CELEBRATING,
        phase: BuddyPhase.CELEBRATING,
        walkTarget: null,
        turnTarget: null,
        busy: true,
        viewMode: 'front',
      };

    case 'CELEBRATE_ORIENT_START':
      return {
        ...state,
        requested: BuddyState.CELEBRATING,
        resolved: BuddyState.CELEBRATING,
        phase: BuddyPhase.ORIENTING,
        walkTarget: null,
        turnTarget: null,
        busy: true,
      };

    case 'CELEBRATE_END':
      return {
        ...state,
        requested: BuddyState.IDLE,
        resolved: BuddyState.IDLE,
        phase: BuddyPhase.IDLE,
        walkTarget: null,
        turnTarget: null,
        busy: false,
        viewMode: 'front',
      };

    case 'SULK_START':
      return {
        ...state,
        phase: BuddyPhase.SULKING,
        busy: true,
        viewMode: 'front',
      };

    case 'SULK_ORIENT_START':
      return {
        ...state,
        phase: BuddyPhase.ORIENTING,
        busy: true,
      };

    case 'SULK_END':
      return {
        ...state,
        requested: BuddyState.IDLE,
        resolved: BuddyState.IDLE,
        phase: BuddyPhase.IDLE,
        busy: false,
        viewMode: 'front',
      };

    case 'SLEEP_START':
      return {
        ...state,
        requested: BuddyState.SLEEPING,
        resolved: BuddyState.SLEEPING,
        walkTarget: BuddyPosition.BED,
        busy: true,
      };

    case 'SLEEP_LIE_DOWN':
      return {
        ...state,
        phase: BuddyPhase.LYING_DOWN,
        walkTarget: null,
        turnTarget: null,
        position: BuddyPosition.BED,
        currentX: BED_X,
      };

    case 'SLEEP_ASLEEP':
      return {
        ...state,
        phase: BuddyPhase.SLEEPING,
      };

    case 'SLEEP_WAKE_START':
      return {
        ...state,
        requested: BuddyState.IDLE,
        resolved: BuddyState.IDLE,
        phase: BuddyPhase.WAKING,
      };

    case 'SLEEP_WAKE_END':
      return {
        ...state,
        requested: BuddyState.IDLE,
        resolved: BuddyState.IDLE,
        phase: BuddyPhase.IDLE,
        facing: BuddyFacing.RIGHT,
        walkTarget: null,
        turnTarget: null,
        busy: false,
        viewMode: 'front',
      };

    case 'CANCEL':
      return {
        ...state,
        walkTarget: null,
        turnTarget: null,
      };

    case 'RESET':
      return initial;

    default:
      return state;
  }
}

export function BuddyProvider({ children, initialState = BuddyState.IDLE }) {
  const [internal, dispatch] = useReducer(reducer, null, () => getInitialState(initialState));

  // Dynamic speech message displayed in SpeechBubble
  const [message, setMessage] = useState(null);

  const stateRef = useRef(internal);
  useEffect(() => {
    stateRef.current = internal;
  }, [internal]);

  const busyRef = useRef(false);
  const cancelRef = useRef(false);
  const rafRef = useRef(null);
  const orientTimerRef = useRef(null);
  const greetTimerRef = useRef(null);
  const celebrateTimerRef = useRef(null);
  const sulkTimerRef = useRef(null);
  const sleepTimerRef = useRef(null);
  const messageTimerRef = useRef(null);
  const greetingTimerRef = useRef(null);
  const idleWanderTimerRef = useRef(null);
  const idleReturnTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const lastSpokenPhraseRef = useRef(null);

  // Companion state & cooldown tracking refs
  const sessionCompletedCountRef = useRef(0);
  const cooldownUntilRef = useRef(Date.now() + 45000); // Initial 45s calm on app open
  const lastTaskCreatedBubbleTimeRef = useRef(0);
  const lastTaskUncompletedTimeRef = useRef(0);
  const remindedTasksTodayRef = useRef(new Set());
  const checkedUserIdsRef = useRef(new Set());

  const beginOrient = useCallback(() => {
    if (orientTimerRef.current) clearTimeout(orientTimerRef.current);
    busyRef.current = true;
    orientTimerRef.current = setTimeout(() => {
      orientTimerRef.current = null;
      if (cancelRef.current) {
        busyRef.current = false;
        return;
      }
      dispatch({ type: 'ORIENT_END' });
      busyRef.current = false;
    }, ORIENT_DURATION);
  }, []);

  const setState = useCallback(
    (next) => {
      if (busyRef.current) {
        cancelRef.current = true;
        busyRef.current = false;
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (orientTimerRef.current) {
          clearTimeout(orientTimerRef.current);
          orientTimerRef.current = null;
        }
        if (greetTimerRef.current) {
          clearTimeout(greetTimerRef.current);
          greetTimerRef.current = null;
        }
        if (celebrateTimerRef.current) {
          clearTimeout(celebrateTimerRef.current);
          celebrateTimerRef.current = null;
        }
        if (sulkTimerRef.current) {
          clearTimeout(sulkTimerRef.current);
          sulkTimerRef.current = null;
        }
        if (sleepTimerRef.current) {
          clearTimeout(sleepTimerRef.current);
          sleepTimerRef.current = null;
        }
        if (noticeTimerRef.current) {
          clearTimeout(noticeTimerRef.current);
          noticeTimerRef.current = null;
        }
        if (idleReturnTimerRef.current) {
          clearTimeout(idleReturnTimerRef.current);
          idleReturnTimerRef.current = null;
        }
        dispatch({ type: 'CANCEL' });
      }
      cancelRef.current = false;
      dispatch({ type: 'SET_STATE', payload: next });
      Promise.resolve().then(() => {
        if (stateRef.current.phase === BuddyPhase.ORIENTING) {
          beginOrient();
        }
      });
    },
    [beginOrient]
  );

  const walkTo = useCallback(
    (target) => {
      if (busyRef.current) return Promise.resolve();
      const cur = stateRef.current;
      const targetX = POS_X[target];
      if (Math.abs(cur.currentX - targetX) < 0.02) return Promise.resolve();

      const requiredFacing = facingForTarget(target);
      busyRef.current = true;
      cancelRef.current = false;

      return (async () => {
        const needsTurn = cur.facing !== requiredFacing || cur.viewMode === 'front';
        if (needsTurn) {
          dispatch({ type: 'TURN_START', turnTarget: requiredFacing });
          await wait(TURN_DURATION);
          if (cancelRef.current) {
            busyRef.current = false;
            return;
          }
        }
        dispatch({ type: 'WALK_START', facing: requiredFacing, target });
        const startX = stateRef.current.currentX;
        const startTime = performance.now();
        await new Promise((resolve) => {
          function step(now) {
            if (cancelRef.current) {
              resolve();
              return;
            }
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / WALK_DURATION);
            const eased = easeInOut(t);
            const x = startX + (targetX - startX) * eased;
            dispatch({ type: 'TICK', x });
            if (t >= 1) {
              resolve();
            } else {
              rafRef.current = requestAnimationFrame(step);
            }
          }
          rafRef.current = requestAnimationFrame(step);
        });
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (cancelRef.current) {
          busyRef.current = false;
          return;
        }
        dispatch({ type: 'WALK_END', position: target });
        if (orientTimerRef.current) clearTimeout(orientTimerRef.current);
        await new Promise((resolve) => {
          orientTimerRef.current = setTimeout(() => {
            orientTimerRef.current = null;
            if (!cancelRef.current) {
              dispatch({ type: 'ORIENT_END' });
            }
            busyRef.current = false;
            resolve();
          }, ORIENT_DURATION);
        });
      })();
    },
    []
  );

  const greet = useCallback(
    (customText = null) => {
      const wasBusy = busyRef.current;
      if (wasBusy) {
        cancelRef.current = true;
        busyRef.current = false;
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (orientTimerRef.current) {
          clearTimeout(orientTimerRef.current);
          orientTimerRef.current = null;
        }
        if (greetTimerRef.current) {
          clearTimeout(greetTimerRef.current);
          greetTimerRef.current = null;
        }
        if (celebrateTimerRef.current) {
          clearTimeout(celebrateTimerRef.current);
          celebrateTimerRef.current = null;
        }
        if (sulkTimerRef.current) {
          clearTimeout(sulkTimerRef.current);
          sulkTimerRef.current = null;
        }
        dispatch({ type: 'CANCEL' });
      }

      if (customText) {
        setMessage(customText);
      }

      (async () => {
        if (wasBusy) {
          await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        }
        const cur = stateRef.current;
        cancelRef.current = false;
        busyRef.current = true;
        if (cur.viewMode === 'side') {
          dispatch({ type: 'GREET_ORIENT_START' });
          await wait(ORIENT_DURATION);
          if (cancelRef.current) {
            busyRef.current = false;
            return;
          }
        }
        dispatch({ type: 'GREET_START' });
        if (greetTimerRef.current) clearTimeout(greetTimerRef.current);
        await new Promise((resolve) => {
          greetTimerRef.current = setTimeout(() => {
            greetTimerRef.current = null;
            resolve();
          }, GREET_DURATION);
        });
        if (cancelRef.current) {
          busyRef.current = false;
          return;
        }
        dispatch({ type: 'GREET_END' });
        busyRef.current = false;
        setMessage(null);
      })();
    },
    []
  );

  const celebrate = useCallback(
    (customText = null) => {
      const wasBusy = busyRef.current;
      if (wasBusy) {
        cancelRef.current = true;
        busyRef.current = false;
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (orientTimerRef.current) {
          clearTimeout(orientTimerRef.current);
          orientTimerRef.current = null;
        }
        if (greetTimerRef.current) {
          clearTimeout(greetTimerRef.current);
          greetTimerRef.current = null;
        }
        if (celebrateTimerRef.current) {
          clearTimeout(celebrateTimerRef.current);
          celebrateTimerRef.current = null;
        }
        if (sulkTimerRef.current) {
          clearTimeout(sulkTimerRef.current);
          sulkTimerRef.current = null;
        }
        dispatch({ type: 'CANCEL' });
      }

      if (customText) {
        setMessage(customText);
      }

      (async () => {
        if (wasBusy) {
          await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        }
        const cur = stateRef.current;
        cancelRef.current = false;
        busyRef.current = true;
        if (cur.viewMode === 'side') {
          dispatch({ type: 'CELEBRATE_ORIENT_START' });
          await wait(ORIENT_DURATION);
          if (cancelRef.current) {
            busyRef.current = false;
            return;
          }
        }
        dispatch({ type: 'CELEBRATE_START' });
        if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
        await new Promise((resolve) => {
          celebrateTimerRef.current = setTimeout(() => {
            celebrateTimerRef.current = null;
            resolve();
          }, CELEBRATE_DURATION);
        });
        if (cancelRef.current) {
          busyRef.current = false;
          return;
        }
        dispatch({ type: 'CELEBRATE_END' });
        busyRef.current = false;
        setMessage(null);
      })();
    },
    []
  );

  const sulk = useCallback(
    (customText = null) => {
      const wasBusy = busyRef.current;
      // Do not interrupt active celebration or greeting with sulking
      if (
        wasBusy &&
        (stateRef.current.phase === BuddyPhase.CELEBRATING ||
          stateRef.current.phase === BuddyPhase.GREETING)
      ) {
        return;
      }

      if (wasBusy) {
        cancelRef.current = true;
        busyRef.current = false;
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (orientTimerRef.current) {
          clearTimeout(orientTimerRef.current);
          orientTimerRef.current = null;
        }
        if (sulkTimerRef.current) {
          clearTimeout(sulkTimerRef.current);
          sulkTimerRef.current = null;
        }
        dispatch({ type: 'CANCEL' });
      }

      if (customText) {
        setMessage(customText);
      }

      (async () => {
        if (wasBusy) {
          await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        }
        const cur = stateRef.current;
        cancelRef.current = false;
        busyRef.current = true;
        if (cur.viewMode === 'side') {
          dispatch({ type: 'SULK_ORIENT_START' });
          await wait(ORIENT_DURATION);
          if (cancelRef.current) {
            busyRef.current = false;
            return;
          }
        }
        dispatch({ type: 'SULK_START' });
        if (sulkTimerRef.current) clearTimeout(sulkTimerRef.current);
        await new Promise((resolve) => {
          sulkTimerRef.current = setTimeout(() => {
            sulkTimerRef.current = null;
            resolve();
          }, SULK_DURATION);
        });
        if (cancelRef.current) {
          busyRef.current = false;
          return;
        }
        dispatch({ type: 'SULK_END' });
        busyRef.current = false;
        setMessage(null);
      })();
    },
    []
  );

  const sleepTo = useCallback(() => {
    const wasBusy = busyRef.current;
    if (wasBusy) {
      cancelRef.current = true;
      busyRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (orientTimerRef.current) { clearTimeout(orientTimerRef.current); orientTimerRef.current = null; }
      if (greetTimerRef.current) { clearTimeout(greetTimerRef.current); greetTimerRef.current = null; }
      if (celebrateTimerRef.current) { clearTimeout(celebrateTimerRef.current); celebrateTimerRef.current = null; }
      if (sulkTimerRef.current) { clearTimeout(sulkTimerRef.current); sulkTimerRef.current = null; }
      if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
      dispatch({ type: 'CANCEL' });
    }

    (async () => {
      if (wasBusy) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      }
      const cur = stateRef.current;
      cancelRef.current = false;
      busyRef.current = true;

      const targetX = BED_X;
      const requiredFacing = facingForTarget(BuddyPosition.BED);
      const needsTurn = cur.facing !== requiredFacing || cur.viewMode === 'front';
      dispatch({ type: 'SLEEP_START' });
      if (needsTurn) {
        dispatch({ type: 'TURN_START', turnTarget: requiredFacing });
        await wait(TURN_DURATION);
        if (cancelRef.current) { busyRef.current = false; return; }
      }
      dispatch({ type: 'WALK_START', facing: requiredFacing, target: BuddyPosition.BED });
      const startX = stateRef.current.currentX;
      const startTime = performance.now();
      await new Promise((resolve) => {
        function step(now) {
          if (cancelRef.current) { resolve(); return; }
          const elapsed = now - startTime;
          const t = Math.min(1, elapsed / WALK_DURATION);
          const eased = easeInOut(t);
          const x = startX + (targetX - startX) * eased;
          dispatch({ type: 'TICK', x });
          if (t >= 1) { resolve(); } else { rafRef.current = requestAnimationFrame(step); }
        }
        rafRef.current = requestAnimationFrame(step);
      });
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (cancelRef.current) { busyRef.current = false; return; }

      dispatch({ type: 'SLEEP_LIE_DOWN' });
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      await new Promise((resolve) => {
        sleepTimerRef.current = setTimeout(() => {
          sleepTimerRef.current = null;
          resolve();
        }, LIE_DOWN_DURATION);
      });
      if (cancelRef.current) { busyRef.current = false; return; }

      dispatch({ type: 'SLEEP_ASLEEP' });
    })();
  }, []);

  const wake = useCallback(() => {
    if (!busyRef.current) return;
    const cur = stateRef.current;
    if (cur.phase !== BuddyPhase.SLEEPING) return;
    cancelRef.current = false;
    (async () => {
      dispatch({ type: 'SLEEP_WAKE_START' });
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      await new Promise((resolve) => {
        sleepTimerRef.current = setTimeout(() => {
          sleepTimerRef.current = null;
          resolve();
        }, WAKE_DURATION);
      });
      if (cancelRef.current) { busyRef.current = false; return; }
      dispatch({ type: 'SLEEP_WAKE_END' });
      busyRef.current = false;
    })();
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = true;
    busyRef.current = false;
    setMessage(null);
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (orientTimerRef.current) {
      clearTimeout(orientTimerRef.current);
      orientTimerRef.current = null;
    }
    if (greetTimerRef.current) {
      clearTimeout(greetTimerRef.current);
      greetTimerRef.current = null;
    }
    if (celebrateTimerRef.current) {
      clearTimeout(celebrateTimerRef.current);
      celebrateTimerRef.current = null;
    }
    if (sulkTimerRef.current) {
      clearTimeout(sulkTimerRef.current);
      sulkTimerRef.current = null;
    }
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    if (idleReturnTimerRef.current) {
      clearTimeout(idleReturnTimerRef.current);
      idleReturnTimerRef.current = null;
    }
    dispatch({ type: 'RESET' });
  }, []);

  const resetToIdle = useCallback(() => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setMessage(null);
    setState(BuddyState.IDLE);
    // Respect user dismissal: 3 minutes of quiet time
    cooldownUntilRef.current = Date.now() + 180000;
  }, [setState]);

  // -------------------------------------------------------------------------
  // Context-Aware TaskTape Event Handlers
  // -------------------------------------------------------------------------

  /**
   * 1. Time-of-Day Daily Greeting & Welcome Back
   * Greets once per calendar day with local time boundary greetings,
   * or welcomes the user back on a fresh tab/session return.
   */
  const checkDailyGreeting = useCallback(
    (userId = 'demo') => {
      if (!userId) return;
      if (checkedUserIdsRef.current.has(userId)) return;
      checkedUserIdsRef.current.add(userId);

      const todayStr = new Date().toISOString().split('T')[0];
      const storageKey = `tasktape_buddy_greeting_${userId}`;
      const lastGreetingDate = localStorage.getItem(storageKey);

      // Distinguish:
      // A. First open for the current day
      // B. Returning later in a new tab/session context
      const hasGreetedToday = lastGreetingDate === todayStr;

      if (!hasGreetedToday) {
        // First meaningful open of the day!
        // Record in localStorage immediately so component re-renders cannot duplicate the entrance
        localStorage.setItem(storageKey, todayStr);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('tasktape_buddy_session_welcomed', 'true');
          sessionStorage.setItem('tasktape_buddy_last_active', String(Date.now()));
        }

        // Cancel any idle wanders or pending greetings
        if (idleWanderTimerRef.current) {
          clearTimeout(idleWanderTimerRef.current);
          idleWanderTimerRef.current = null;
        }
        if (idleReturnTimerRef.current) {
          clearTimeout(idleReturnTimerRef.current);
          idleReturnTimerRef.current = null;
        }
        if (greetingTimerRef.current) {
          clearTimeout(greetingTimerRef.current);
          greetingTimerRef.current = null;
        }

        // Ensure Buddy is positioned at the entrance (AWAY) facing RIGHT in side profile
        dispatch({ type: 'PREPARE_ENTRANCE' });
        busyRef.current = false;

        // Subtle, natural entrance: brief 400ms pause after open -> walk HOME -> orient -> wave greeting
        greetingTimerRef.current = setTimeout(async () => {
          greetingTimerRef.current = null;
          if (cancelRef.current) return;

          // Step 1: Buddy naturally walks toward his normal HOME position using existing Phase 3 walking
          await walkTo(BuddyPosition.HOME);

          if (cancelRef.current) return;

          // Step 2: Buddy performs greeting gesture + local time-of-day greeting
          const greetingText = getTimeOfDayGreeting();
          lastSpokenPhraseRef.current = greetingText;
          greet(greetingText);
          cooldownUntilRef.current = Date.now() + 120000; // 2 min quiet
        }, 400);
      } else {
        // If already greeted today, ensure resting position is HOME
        if (stateRef.current.position === BuddyPosition.AWAY && !busyRef.current) {
          dispatch({ type: 'SET_POSITION_HOME' });
        }

        // Already greeted today: check if this is a fresh return in a new session
        const sessionWelcomed =
          typeof sessionStorage !== 'undefined'
            ? sessionStorage.getItem('tasktape_buddy_session_welcomed')
            : 'true';

        if (!sessionWelcomed) {
          // Welcome back on genuine new tab/session return (stationary gesture)
          if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
          greetingTimerRef.current = setTimeout(() => {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('tasktape_buddy_session_welcomed', 'true');
              sessionStorage.setItem('tasktape_buddy_last_active', String(Date.now()));
            }
            const phrase = pickPhrase(WELCOME_BACK_PHRASES, lastSpokenPhraseRef.current);
            lastSpokenPhraseRef.current = phrase;
            greet(phrase);
            cooldownUntilRef.current = Date.now() + 120000;
            greetingTimerRef.current = null;
          }, 1400);
        }
      }
    },
    [greet, walkTo]
  );

  /**
   * 2. Tab Visibility Resume (returning after being away > 15m)
   */
  const onUserResumeSession = useCallback(
    (_userId = 'demo') => {
      const now = Date.now();
      const lastActive =
        typeof sessionStorage !== 'undefined'
          ? Number(sessionStorage.getItem('tasktape_buddy_last_active') || 0)
          : 0;

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('tasktape_buddy_last_active', String(now));
      }

      // If user was away for > 15 minutes, cooldown has passed, and Buddy is idle
      if (
        lastActive &&
        now - lastActive > 15 * 60 * 1000 &&
        now > cooldownUntilRef.current &&
        !busyRef.current &&
        stateRef.current.phase === BuddyPhase.IDLE &&
        !message
      ) {
        const phrase = pickPhrase(WELCOME_BACK_PHRASES, lastSpokenPhraseRef.current);
        lastSpokenPhraseRef.current = phrase;
        greet(phrase);
        cooldownUntilRef.current = now + 120000;
      }
    },
    [greet, message]
  );

  /**
   * 3. Task Created Reaction
   * Acknowledges new task with brief dialogue without spamming on rapid adds.
   */
  const onTaskCreated = useCallback(
    (_title = '') => {
      const now = Date.now();
      cooldownUntilRef.current = now + 45000;

      // Debounce: if user is rapidly creating tasks (< 6s), acknowledge silently
      if (now - lastTaskCreatedBubbleTimeRef.current < 6000) {
        return;
      }

      // Never interrupt higher-priority celebrations, greetings, sulk, or sleep
      if (busyRef.current && stateRef.current.phase !== BuddyPhase.IDLE) {
        return;
      }

      lastTaskCreatedBubbleTimeRef.current = now;
      const phrase = pickPhrase(CREATED_PHRASES, lastSpokenPhraseRef.current);
      lastSpokenPhraseRef.current = phrase;

      // Tiny natural perception pause (~180ms) so tape sticks first
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        noticeTimerRef.current = null;
        if (busyRef.current && stateRef.current.phase !== BuddyPhase.IDLE) return;

        if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
        setMessage(phrase);
        messageTimerRef.current = setTimeout(() => {
          setMessage(null);
          messageTimerRef.current = null;
        }, 2200);
      }, 180);
    },
    []
  );

  /**
   * 4. Task Completed Celebration
   * Fires the Phase 3 celebration hop and contextual progress dialogue.
   */
  const onTaskCompleted = useCallback(
    (_title = '', remainingCount = null) => {
      sessionCompletedCountRef.current += 1;
      cooldownUntilRef.current = Date.now() + 90000;

      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
        messageTimerRef.current = null;
      }

      let celebrationMsg;
      if (remainingCount === 0) {
        celebrationMsg = pickPhrase(ALL_DONE_PHRASES, lastSpokenPhraseRef.current);
      } else if (sessionCompletedCountRef.current >= 3) {
        celebrationMsg = pickPhrase(STREAK_PHRASES, lastSpokenPhraseRef.current);
      } else {
        celebrationMsg = pickPhrase(CELEBRATE_PHRASES, lastSpokenPhraseRef.current);
      }
      lastSpokenPhraseRef.current = celebrationMsg;

      // Small natural perception pause: ~220ms before Buddy notices and starts celebrating
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        noticeTimerRef.current = null;
        celebrate(celebrationMsg);
      }, 220);
    },
    [celebrate]
  );

  /**
   * 5. Task Uncompleted / Unchecked
   * Playful disappointed/sulking reaction when user unchecks a completed task.
   */
  const onTaskUncompleted = useCallback(
    (_title = '') => {
      const now = Date.now();
      // If unchecking multiple tasks quickly (< 5s), do not spam multiple reactions
      if (now - lastTaskUncompletedTimeRef.current < 5000) {
        return;
      }

      // Never interrupt higher-priority celebration or greeting
      if (
        busyRef.current &&
        (stateRef.current.phase === BuddyPhase.CELEBRATING ||
          stateRef.current.phase === BuddyPhase.GREETING)
      ) {
        return;
      }

      lastTaskUncompletedTimeRef.current = now;
      cooldownUntilRef.current = now + 45000;

      const phrase = pickPhrase(UNCOMPLETED_PHRASES, lastSpokenPhraseRef.current);
      lastSpokenPhraseRef.current = phrase;

      // Small natural perception pause (~200ms)
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        noticeTimerRef.current = null;
        sulk(phrase);
      }, 200);
    },
    [sulk]
  );

  /**
   * 6. Old Task Contextual Reminders
   * Reuses TaskTape's 2+ day threshold to occasionally point out waiting tasks.
   * If the authoritative OldestTaskNudge banner is currently visible on screen,
   * Buddy stays quiet to avoid duplicate nagging.
   */
  const evaluateTaskReminders = useCallback(
    (tasks = [], isNudgeBannerVisible = false) => {
      // If the top kraft nudge banner is prominently visible, stay quiet
      if (isNudgeBannerVisible) return;

      const now = Date.now();
      if (now < cooldownUntilRef.current) return;
      if (busyRef.current || stateRef.current.phase !== BuddyPhase.IDLE || message) return;

      const nonCleared = tasks.filter((t) => !t.deleted_at);
      const activeTasks = nonCleared.filter((t) => !t.done);
      if (activeTasks.length === 0) return;

      // Find oldest active task
      const oldest = [...activeTasks].sort((a, b) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeA - timeB;
      })[0];

      if (oldest && oldest.created_at) {
        const ageDays = Math.floor(
          (Date.now() - new Date(oldest.created_at).getTime()) / 86400000
        );
        if (ageDays >= 2 && !remindedTasksTodayRef.current.has(oldest.id)) {
          remindedTasksTodayRef.current.add(oldest.id);
          const reminderMsg = pickPhrase(REMINDER_PHRASES, lastSpokenPhraseRef.current);
          lastSpokenPhraseRef.current = reminderMsg;

          setMessage(reminderMsg);
          if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
          messageTimerRef.current = setTimeout(() => {
            setMessage(null);
            messageTimerRef.current = null;
          }, 3600);

          cooldownUntilRef.current = Date.now() + 210000; // 3.5 min quiet
        }
      }
    },
    [message]
  );

  // -------------------------------------------------------------------------
  // Autonomous Natural Living Idle Cycle
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const scheduleIdleCheck = () => {
      if (cancelled) return;
      // Infrequent, irregular natural check (45s to 85s)
      const delay = Math.random() * 40000 + 45000;
      idleWanderTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        const cur = stateRef.current;
        if (
          !busyRef.current &&
          cur.phase === BuddyPhase.IDLE &&
          cur.position === BuddyPosition.HOME &&
          !message &&
          Date.now() > cooldownUntilRef.current
        ) {
          // 30% chance to occasionally wander when calm
          if (Math.random() < 0.3) {
            walkTo(BuddyPosition.AWAY);
            if (idleReturnTimerRef.current) clearTimeout(idleReturnTimerRef.current);
            idleReturnTimerRef.current = setTimeout(() => {
              if (
                !cancelled &&
                !busyRef.current &&
                stateRef.current.position === BuddyPosition.AWAY
              ) {
                walkTo(BuddyPosition.HOME);
              }
              idleReturnTimerRef.current = null;
            }, Math.random() * 8000 + 10000); // 10s to 18s gentle pause at AWAY before returning
          }
        }
        scheduleIdleCheck();
      }, delay);
    };

    scheduleIdleCheck();

    return () => {
      cancelled = true;
      if (idleWanderTimerRef.current) {
        clearTimeout(idleWanderTimerRef.current);
        idleWanderTimerRef.current = null;
      }
      if (idleReturnTimerRef.current) {
        clearTimeout(idleReturnTimerRef.current);
        idleReturnTimerRef.current = null;
      }
    };
  }, [message, walkTo]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (orientTimerRef.current) clearTimeout(orientTimerRef.current);
      if (greetTimerRef.current) clearTimeout(greetTimerRef.current);
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
      if (sulkTimerRef.current) clearTimeout(sulkTimerRef.current);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
      if (idleWanderTimerRef.current) clearTimeout(idleWanderTimerRef.current);
      if (idleReturnTimerRef.current) clearTimeout(idleReturnTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const value = useMemo(
    () => ({
      state: internal.resolved,
      requested: internal.requested,
      isIdle: internal.resolved === BuddyState.IDLE,
      phase: internal.phase,
      facing: internal.facing,
      position: internal.position,
      currentX: internal.currentX,
      walkTarget: internal.walkTarget,
      turnTarget: internal.turnTarget,
      busy: internal.busy,
      viewMode: internal.viewMode,
      walkTo,
      greet,
      celebrate,
      sulk,
      sleepTo,
      wake,
      setState,
      reset,
      resetToIdle,
      checkDailyGreeting,
      onUserResumeSession,
      evaluateTaskReminders,
      onTaskCreated,
      onTaskCompleted,
      onTaskUncompleted,
      message,
    }),
    [
      internal,
      walkTo,
      greet,
      celebrate,
      sulk,
      sleepTo,
      wake,
      setState,
      reset,
      resetToIdle,
      checkDailyGreeting,
      onUserResumeSession,
      evaluateTaskReminders,
      onTaskCreated,
      onTaskCompleted,
      onTaskUncompleted,
      message,
    ]
  );

  return <BuddyContext.Provider value={value}>{children}</BuddyContext.Provider>;
}

export function useBuddy() {
  const ctx = useContext(BuddyContext);
  if (!ctx) {
    throw new Error('useBuddy must be used inside a <BuddyProvider>.');
  }
  return ctx;
}

export function useBuddyState() {
  return useBuddy().state;
}
