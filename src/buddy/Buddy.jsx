// src/buddy/Buddy.jsx
//
// Public companion component for TaskTape.
//
// Houses Buddy in a compact, unobtrusive bottom-right stage:
//   - Desktop: ~120-130px character height
//   - Mobile: ~85-95px character height
//   - Fully transparent background
//   - Single persistent SVG Bed instance
//   - Real 4-frame walk cycle + rAF continuous travel between HOME and AWAY
//   - Real 13-frame greeting wave sequence with SpeechBubble
//   - Real 9-frame celebration hop sequence with SpeechBubble
//   - Real sleep walk to bed, lie down, breathing loop, and wake transition

import { useState, useRef, useEffect } from 'react';
import { useBuddy } from './BuddyContext';
import BuddyCharacter from './BuddyCharacter';
import SpeechBubble from './SpeechBubble';
import BuddyDevPanel from './BuddyDevPanel';
import { BedBack, BedBlanket, MATTRESS_TOP_Y } from './assets/bed';
import { BuddyPhase, BuddyPosition, BuddyState } from './types';
import { BED_X } from './movement';

export default function Buddy({ className = '' }) {
  const {
    phase,
    currentX,
    busy,
    greet,
    wake,
    setState,
  } = useBuddy();

  // Responsive stage sizing
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const isDev = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('buddy_dev') === 'true';

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Geometry calculations
  // Desktop: stage width 250px, Buddy height 125px (within 110-140px range)
  // Mobile: stage width 195px, Buddy height 90px (within 85-95px range)
  const stageWidth = isMobile ? 195 : 250;
  const stageHeight = isMobile ? 115 : 155;
  const buddyHeight = isMobile ? '90px' : '125px';
  const buddySizeApprox = isMobile ? 75 : 105;

  const desiredOffset = stageWidth * 0.28;
  const maxOffset = Math.max(0, stageWidth / 2 - buddySizeApprox / 2 - 8);
  const offset = Math.min(desiredOffset, maxOffset);

  const pixelOffset = currentX * offset;
  const bedPixelOffset = BED_X * offset;

  const bedWidth = isMobile ? 85 : 110;
  const bedHeight = bedWidth / 2;

  const isLying =
    phase === BuddyPhase.LYING_DOWN ||
    phase === BuddyPhase.SLEEPING ||
    phase === BuddyPhase.WAKING;

  const mattressSurfaceFromBottom = 6 + (1 - MATTRESS_TOP_Y / 120) * bedHeight;
  const lyingBottom = isLying ? `${mattressSurfaceFromBottom - 6}px` : '6px';
  const buddyZIndex = isLying ? 2 : 2;

  // Tap handler on Buddy:
  // If sleeping -> wake him up
  // If idle -> say hello with wave
  // If busy -> return to idle
  const handleCharacterClick = () => {
    if (phase === BuddyPhase.SLEEPING) {
      wake();
    } else if (!busy && phase === BuddyPhase.IDLE) {
      greet();
    } else if (busy) {
      setState(BuddyState.IDLE);
    }
  };

  return (
    <>
      {/* Dev panel: only mounted if explicitly requested via ?buddy_dev=true */}
      {isDev && <BuddyDevPanel />}

      <aside
        className={`fixed bottom-[74px] sm:bottom-[78px] right-2 sm:right-4 min-[960px]:right-auto min-[960px]:left-[min(calc(50%+236px),calc(100vw-270px))] z-20 pointer-events-none ${className}`}
        style={{
          width: `${stageWidth}px`,
          height: `${stageHeight}px`,
        }}
        aria-label="Buddy companion"
      >

        {/* 
          Bed BACK layer (Mattress + pillow + legs)
          Rendered behind Buddy at zIndex 1.
          Always exactly ONE bed instance.
        */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '6px',
            transform: `translateX(calc(-50% + ${bedPixelOffset}px))`,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <BedBack width={bedWidth} />
        </div>

        {/* 
          Moving Character Unit:
          Horizontal travel is driven by currentX * offset (from rAF continuous loop).
          When lying down on bed, bottom raises to mattress surface.
        */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: lyingBottom,
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: buddyZIndex,
            transition: 'bottom 0.4s ease-out',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              willChange: 'transform',
              transform: `translateX(${pixelOffset}px)`,
              position: 'relative',
            }}
          >
            {/* Speech Bubble: sits right above Buddy's head with spring animation */}
            <SpeechBubble />

            {/* Clickable Buddy Character */}
            <button
              type="button"
              onClick={handleCharacterClick}
              className="group relative shrink-0 p-0 m-0 bg-transparent border-0 cursor-pointer focus:outline-none transition-transform active:scale-95 select-none pointer-events-auto"
              title="Buddy! Tap to interact."
            >
              <BuddyCharacter
                height={buddyHeight}
                lyingWidth={bedWidth * 0.9}
              />
            </button>
          </div>
        </div>

        {/* 
          Bed BLANKET layer:
          Thin overlay rendered in front of Buddy's legs at zIndex 3 during lying/sleeping/waking.
        */}
        {isLying && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              bottom: `${mattressSurfaceFromBottom}px`,
              transform: `translateX(calc(-50% + ${bedPixelOffset}px))`,
              pointerEvents: 'none',
              zIndex: 3,
            }}
          >
            <BedBlanket width={bedWidth} />
          </div>
        )}
      </aside>
    </>
  );
}
