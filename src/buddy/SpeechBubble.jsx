// src/buddy/SpeechBubble.jsx
//
// A small speech bubble that appears above Buddy during the GREETING or
// CELEBRATING phases. Shows "Good morning da ☀️" during greeting and
// "Nice! 🎉" during celebration. Visually secondary to the character —
// small, soft, and unobtrusive. Fades in when the phase starts and fades
// out when it ends.
//
// The bubble is positioned relative to the BuddyCharacter's wrapper in the
// playground (page.tsx). It reads the phase from BuddyContext to decide
// whether to show and which message to display, and uses framer-motion for
// the fade in/out.

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useBuddy } from './BuddyContext';
import { BuddyPhase } from './types';

// Per-phase speech bubble messages.
const PHASE_MESSAGES = {
  [BuddyPhase.GREETING]: 'Good morning da ☀️',
  [BuddyPhase.CELEBRATING]: 'Nice! 🎉',
  // Phase 3C: sleep/wake messages. "Good night 😴" shows during the walk to
  // bed + lying down; it disappears once asleep. "Morning again 😅" shows
  // briefly during the wake transition.
  [BuddyPhase.WAKING]: 'Morning again 😅',
};

export default function SpeechBubble({ className = '', bottom = null, message: customMessage = null }) {
  const { phase, walkTarget, message: contextMessage } = useBuddy();
  // The message is phase-driven, with a special case: during a sleep-bound
  // walk (walkTarget === BED) or while lying down, show "Good night 😴".
  let message = customMessage || contextMessage || PHASE_MESSAGES[phase];
  if (
    !customMessage &&
    !contextMessage &&
    ((phase === BuddyPhase.WALKING && walkTarget === 'bed') ||
      phase === BuddyPhase.LYING_DOWN)
  ) {
    message = 'Good night 😴';
  }
  const visible = Boolean(message);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`speech-bubble-${message || phase}`}
          className={`buddy-speech-bubble ${className}`}
          initial={{ opacity: 0, y: 6, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            // Positioned just above the character, anchored from the right so it never overflows off-screen
            bottom: bottom || 'calc(100% + 4px)',
            right: 0,
            padding: '8px 14px',
            background: '#fffdf6',
            color: '#2a2620',
            fontFamily:
              'var(--font-geist-sans, ui-sans-serif, system-ui, -apple-system, sans-serif)',
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            maxWidth: 'min(240px, calc(100vw - 32px))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            borderRadius: '14px',
            border: '1px solid rgba(20,20,20,0.08)',
            boxShadow: '0 4px 16px -6px rgba(20,20,20,0.18)',
            pointerEvents: 'none',
            zIndex: 10,
            userSelect: 'none',
          }}
          aria-live="polite"
        >
          {message}
          {/* Speech bubble tail (pointing down at Buddy's head) */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: '-7px',
              right: '28px',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid #fffdf6',
              filter: 'drop-shadow(0 1px 0 rgba(20,20,20,0.06))',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
