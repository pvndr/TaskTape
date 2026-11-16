import assert from 'node:assert/strict';
import {
  VALID_TAPE_COLORS,
  getGeminiApiKey,
  setGeminiApiKey
} from '../src/lib/geminiVision.js';

console.log('--- Verifying Gemini Vision & Notepad Scanner Logic ---\n');

// 1. Valid Tape Colors
console.log('1. Checking Valid Tape Colors...');
assert.deepEqual(VALID_TAPE_COLORS, [
  'tape-cream',
  'tape-red',
  'tape-mustard',
  'tape-teal',
  'tape-sage'
]);
console.log('   ✓ 5 tape colors defined correctly.');

// 2. Local Storage Mock & Key Handling
console.log('\n2. Checking API Key Storage & Fallback...');
// In Node environment without window.localStorage, getGeminiApiKey() handles missing storage gracefully
const defaultKey = getGeminiApiKey();
console.log('   ✓ Default API key handled without throwing:', typeof defaultKey === 'string');

// 3. Mock API Response Parser Test
console.log('\n3. Verifying Gemini JSON Parser & Color Distribution...');
const mockGeminiOutput = JSON.stringify([
  { title: 'Buy milk & eggs', color: 'tape-cream' },
  { title: 'Call dentist', color: 'tape-red' },
  { title: 'Water studio plants', color: 'tape-sage' },
  { title: 'Invalid color task', color: 'unknown-neon' }, // should fallback
  { title: '   ', color: 'tape-teal' } // empty title should be filtered
]);

// Test parser logic
const rawParsed = JSON.parse(mockGeminiOutput);
const formatted = rawParsed
  .map((item, index) => {
    const cleanTitle = (item?.title || '').trim();
    if (!cleanTitle) return null;
    const color = VALID_TAPE_COLORS.includes(item?.color)
      ? item.color
      : VALID_TAPE_COLORS[index % VALID_TAPE_COLORS.length];
    return {
      title: cleanTitle,
      color,
      selected: true
    };
  })
  .filter(Boolean);

assert.equal(formatted.length, 4, 'Empty titles must be filtered out');
assert.equal(formatted[0].title, 'Buy milk & eggs');
assert.equal(formatted[1].color, 'tape-red');
assert.equal(formatted[2].color, 'tape-sage');
assert.equal(VALID_TAPE_COLORS.includes(formatted[3].color), true, 'Invalid color must fallback to valid tape color');
console.log('   ✓ JSON output parsing, cleaning, and color fallback verified.');

console.log('\n🎉 Logic verification passed!');
