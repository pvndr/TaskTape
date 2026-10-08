// src/buddy/assets/bed.js
//
// A simple, clean, minimal bed rendered as a SINGLE SVG. It fits the
// playground's warm-neutral visual style. There is exactly ONE bed
// instance in the playground at all times.
//
// The bed is a single flat side-view: a mattress surface with a pillow
// on the left and legs underneath. The blanket is part of the same SVG
// (drawn on the mattress), so there are never two separate bed shapes.
// During sleeping, Buddy lies on top of this single bed.

'use client';

const VIEWBOX_W = 240;
const VIEWBOX_H = 120;

// The mattress surface Y in viewBox coordinates (where Buddy lies).
export const MATTRESS_TOP_Y = 40;

// BedBack — the ONE AND ONLY bed. Always rendered (one instance).
// A single flat bed: mattress + pillow + thin base. No separate frame
// rectangle to avoid a "two-layer" look. The blanket is part of this SVG.
export function BedBack({ width = 360, className = '' }) {
  const w = width;
  const h = width / 2;
  return (
    <svg
      className={`buddy-bed-back ${className}`}
      width={w}
      height={h}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Mattress — the main surface, one shape */}
      <rect x="14" y="40" width="212" height="34" rx="14" fill="#efe7da" stroke="#d8cfc1" strokeWidth="2" />
      {/* Pillow on the left */}
      <rect x="18" y="34" width="46" height="22" rx="11" fill="#fbf6ee" stroke="#e0d4c2" strokeWidth="1.5" />
      {/* Thin base/legs — a subtle thin strip under the mattress, not a
          full second rectangle. Just two small legs. */}
      <rect x="22" y="74" width="8" height="10" rx="2" fill="#c4b69e" />
      <rect x="210" y="74" width="8" height="10" rx="2" fill="#c4b69e" />
    </svg>
  );
}

// BedBlanket — a THIN overlay strip rendered IN FRONT of Buddy's legs
// during sleeping. This is NOT a bed — just a thin blanket covering his
// legs. It's part of the bed visually but rendered as a separate zIndex 3
// element so Buddy's body appears tucked under it.
//
// The viewBox is just the blanket band (y=46-76 of the original viewBox),
// so the SVG element is only ~25% of the bed height — not a full bed.
const BLANKET_VB_Y = 46;
const BLANKET_VB_H = 30;

export function BedBlanket({ width = 360, className = '' }) {
  const w = width;
  const h = (width / 2) * (BLANKET_VB_H / VIEWBOX_H);
  return (
    <svg
      className={`buddy-bed-blanket ${className}`}
      width={w}
      height={h}
      viewBox={`0 ${BLANKET_VB_Y} ${VIEWBOX_W} ${BLANKET_VB_H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M70 54 Q72 48 80 48 L226 48 Q234 48 234 56 L234 68 Q234 74 228 74 L70 74 Z"
        fill="#dccfb8"
        stroke="#c4b69e"
        strokeWidth="1.5"
      />
      <path d="M86 60 L224 60" stroke="#c4b69e" strokeWidth="1" strokeDasharray="3 5" opacity="0.6" />
    </svg>
  );
}

// Default export — the full bed (combined). Kept for backwards compatibility.
export default function Bed({ width = 360, className = '' }) {
  const w = width;
  const h = width / 2;
  return (
    <svg
      className={`buddy-bed ${className}`}
      width={w}
      height={h}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Buddy's bed"
      role="img"
    >
      <rect x="14" y="40" width="212" height="34" rx="14" fill="#efe7da" stroke="#d8cfc1" strokeWidth="2" />
      <rect x="18" y="34" width="46" height="22" rx="11" fill="#fbf6ee" stroke="#e0d4c2" strokeWidth="1.5" />
      <path d="M70 54 Q72 48 80 48 L226 48 Q234 48 234 56 L234 68 Q234 74 228 74 L70 74 Z" fill="#dccfb8" stroke="#c4b69e" strokeWidth="1.5" />
      <path d="M86 60 L224 60" stroke="#c4b69e" strokeWidth="1" strokeDasharray="3 5" opacity="0.6" />
      <rect x="22" y="74" width="8" height="10" rx="2" fill="#c4b69e" />
      <rect x="210" y="74" width="8" height="10" rx="2" fill="#c4b69e" />
    </svg>
  );
}
