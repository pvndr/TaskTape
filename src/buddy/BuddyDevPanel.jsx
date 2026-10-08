// src/buddy/BuddyDevPanel.jsx
//
// Tiny developer/test control panel for the Buddy character lab.
//
// PHASE 1: [Idle] — assert the idle state.
// PHASE 2: [Walk] / [Walk Back] — walk to AWAY / HOME respectively.
// PHASE 3A: [Greeting] — perform the "Good morning" wave gesture in place.
//
// The panel reads from BuddyContext, so it always reflects the live state.
// [Walk]/[Walk Back]/[Greeting] are disabled while busy. [Idle] is always
// enabled (works from any state, including mid-walk/mid-greeting).

'use client';

import { useBuddy } from './BuddyContext';
import { BuddyState, BuddyPosition, BuddyPhase } from './types';

const PHASE_LABEL = {
  [BuddyPhase.IDLE]: 'idle',
  [BuddyPhase.TURNING]: 'turning',
  [BuddyPhase.WALKING]: 'walking',
  [BuddyPhase.ORIENTING]: 'orienting',
  [BuddyPhase.GREETING]: 'greeting',
  [BuddyPhase.CELEBRATING]: 'celebrating',
  [BuddyPhase.LYING_DOWN]: 'lying down',
  [BuddyPhase.SLEEPING]: 'sleeping',
  [BuddyPhase.WAKING]: 'waking',
};

export default function BuddyDevPanel({ className = '' }) {
  const { state, phase, facing, position, currentX, busy, walkTo, greet, celebrate, sleepTo, wake, setState } = useBuddy();

  // [Idle], [Greeting], [Celebrate], and [Sleep] must work from ANY state —
  // always enabled. They cancel any in-progress operation and take over.
  // [Walk]/[Walk Back] are disabled while busy. [Wake] is only enabled when
  // actually sleeping.
  const canIdle = true;
  const canWalk = !busy && currentX > -0.95;
  const canWalkBack = !busy && currentX < 0.95;
  const canGreet = true;
  const canCelebrate = true;
  const canSleep = true;
  const isSleeping = phase === BuddyPhase.SLEEPING;
  const canWake = isSleeping;

  const btn = (label, onClick, opts = {}) => {
    const { active = false, disabled = false } = opts;
    return {
      type: 'button',
      onClick,
      disabled,
      'aria-pressed': active,
      style: {
        fontFamily: 'inherit',
        fontSize: '12px',
        lineHeight: 1,
        padding: '7px 12px',
        borderRadius: '8px',
        cursor: disabled ? 'default' : 'pointer',
        border: active
          ? '1px solid #1a1a1a'
          : disabled
            ? '1px solid rgba(20,20,20,0.08)'
            : '1px solid rgba(20,20,20,0.16)',
        background: active
          ? '#1a1a1a'
          : disabled
            ? 'transparent'
            : 'rgba(255,255,255,0.6)',
        color: active ? '#fff' : disabled ? 'rgba(20,20,20,0.32)' : '#1a1a1a',
        fontWeight: 600,
        opacity: disabled ? 0.6 : 1,
        transition:
          'background 160ms ease, color 160ms ease, border-color 160ms ease, opacity 160ms ease',
      },
      children: label,
    };
  };

  return (
    <div
      className={`buddy-dev-panel ${className}`}
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 50,
        padding: '12px 14px',
        minWidth: '200px',
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(20,20,20,0.08)',
        borderRadius: '12px',
        boxShadow: '0 6px 24px -12px rgba(20,20,20,0.18)',
        fontFamily:
          'var(--font-geist-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
        fontSize: '12px',
        color: '#1a1a1a',
        userSelect: 'none',
      }}
      aria-label="Buddy developer controls"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          letterSpacing: '0.08em',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '11px' }}>BUDDY · DEV</span>
        <span
          aria-hidden
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '9999px',
            background: busy ? '#cfa13b' : state === BuddyState.IDLE ? '#3bbf7a' : '#6aa',
            boxShadow: '0 0 0 3px rgba(59,191,122,0.12)',
          }}
        />
      </div>

      <div style={{ marginBottom: '4px', color: '#5a5a5a' }}>
        phase:&nbsp;
        <span style={{ color: '#1a1a1a', fontWeight: 600 }}>
          {PHASE_LABEL[phase] || phase}
        </span>
      </div>
      <div style={{ marginBottom: '4px', color: '#5a5a5a' }}>
        facing:&nbsp;
        <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{facing}</span>
        &nbsp;·&nbsp; pos:&nbsp;
        <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{position}</span>
      </div>
      <div style={{ marginBottom: '4px', color: '#5a5a5a' }}>
        x:&nbsp;
        <span style={{ color: '#1a1a1a', fontWeight: 600 }}>
          {currentX.toFixed(2)}
        </span>
        <span style={{ color: '#8a8a8a' }}> (home=+1 away=-1)</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
        <button
          {...btn('Idle', () => setState(BuddyState.IDLE), {
            active: !busy && phase === BuddyPhase.IDLE,
            disabled: !canIdle,
          })}
        />
        <button
          {...btn('Walk', () => walkTo(BuddyPosition.AWAY), {
            disabled: !canWalk,
          })}
        />
        <button
          {...btn('Walk Back', () => walkTo(BuddyPosition.HOME), {
            disabled: !canWalkBack,
          })}
        />
        <button
          {...btn('Greeting', () => greet(), {
            active: phase === BuddyPhase.GREETING,
            disabled: !canGreet,
          })}
        />
        <button
          {...btn('Celebrate', () => celebrate(), {
            active: phase === BuddyPhase.CELEBRATING,
            disabled: !canCelebrate,
          })}
        />
        <button
          {...btn('Sleep', () => sleepTo(), {
            active: phase === BuddyPhase.SLEEPING || phase === BuddyPhase.LYING_DOWN,
            disabled: !canSleep,
          })}
        />
        <button
          {...btn('Wake', () => wake(), {
            disabled: !canWake,
          })}
        />
      </div>
    </div>
  );
}
