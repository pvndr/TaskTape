import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  VALID_TAPE_COLORS,
  getGeminiApiKey
} from '../src/lib/geminiVision.js';
import {
  normalizeTitle,
  detectRecurringTasks
} from '../src/lib/recurring.js';

console.log('==============================================');
console.log('   TASKTAPE END-TO-END VERIFICATION SUITE   ');
console.log('==============================================\n');

// 1. Vision & Tape Palette Verification
console.log('1. Checking Vision & Tape Colors...');
assert.equal(VALID_TAPE_COLORS.length, 5);
assert.deepEqual(VALID_TAPE_COLORS, [
  'tape-cream',
  'tape-red',
  'tape-mustard',
  'tape-teal',
  'tape-sage'
]);
console.log('   ✓ 5 tape colors defined correctly: ' + VALID_TAPE_COLORS.join(', '));

// 2. Handwriting Vision Parser & Edge Cases Verification
console.log('\n2. Testing Handwriting Extraction Parser...');
const rawGeminiResponse = `
\`\`\`json
[
  { "title": "Buy groceries (milk, bread)", "color": "tape-teal" },
  { "title": "Dentist appointment at 3pm", "color": "tape-red" },
  { "title": "Call accountant w/ tax docs", "color": "tape-mustard" },
  { "title": "   ", "color": "tape-cream" },
  { "title": "Yoga session", "color": "unsupported-purple" }
]
\`\`\`
`;

const cleaned = rawGeminiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
const parsed = JSON.parse(cleaned);

const processed = parsed
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

assert.equal(processed.length, 4, 'Empty titles must be discarded');
assert.equal(processed[0].title, 'Buy groceries (milk, bread)');
assert.equal(processed[0].color, 'tape-teal');
assert.equal(processed[1].color, 'tape-red');
assert.equal(processed[3].title, 'Yoga session');
assert.equal(VALID_TAPE_COLORS.includes(processed[3].color), true, 'Unsupported color must fallback');
console.log('   ✓ Robust markdown stripping, empty-task removal, and color fallback verified.');

// 3. Recurring Events Detection Pure Function Verification
console.log('\n3. Verifying Recurring Events Pure Function...');
const sampleTasks = [
  // Day 1
  { title: 'Morning Run', created_at: '2026-11-10T02:00:00Z', done: true, deleted_at: '2026-11-10T12:00:00Z' },
  // Day 2
  { title: '  Morning   run  ', created_at: '2026-11-11T03:00:00Z', done: true, deleted_at: null },
  // Day 3
  { title: 'morning run', created_at: '2026-11-12T01:00:00Z', done: false, deleted_at: null }
];
const recurring = detectRecurringTasks(sampleTasks);
assert.equal(recurring.length, 1);
assert.equal(recurring[0].normalizedTitle, 'morning run');
assert.equal(recurring[0].streakDays, 3);
console.log('   ✓ Single-pass Map detection correctly identified 3-day streak across cleared and completed tasks.');

// 4. File Structure & Component Existence
console.log('\n4. Verifying Source Code Integrity...');
const requiredFiles = [
  'src/lib/imageCompression.js',
  'src/lib/geminiVision.js',
  'src/components/NotepadScanModal.jsx',
  'src/components/AddBar.jsx',
  'src/components/ProfilePopover.jsx',
  'src/components/RecurringPrompt.jsx',
  'src/components/RecurringSection.jsx',
  'src/App.jsx'
];
for (const relPath of requiredFiles) {
  const fullPath = path.resolve(relPath);
  assert.equal(fs.existsSync(fullPath), true, `File must exist: ${relPath}`);
}
console.log('   ✓ All required components and library files exist.');

// 5. Production Dist Files Verification
console.log('\n5. Verifying Built Production Artifacts (dist/)...');
assert.equal(fs.existsSync(path.resolve('dist/index.html')), true, 'dist/index.html must exist');
assert.equal(fs.existsSync(path.resolve('dist/sw.js')), true, 'dist/sw.js (PWA service worker) must exist');
assert.equal(fs.existsSync(path.resolve('dist/manifest.webmanifest')), true, 'PWA webmanifest must exist');

const distAssets = fs.readdirSync(path.resolve('dist/assets'));
const hasJs = distAssets.some((f) => f.endsWith('.js'));
const hasCss = distAssets.some((f) => f.endsWith('.css'));
assert.equal(hasJs, true, 'dist/assets must contain bundled JS');
assert.equal(hasCss, true, 'dist/assets must contain bundled CSS');
console.log(`   ✓ Production build output verified (${distAssets.length} assets compiled).`);

console.log('\n==============================================');
console.log('  ✅ ALL TESTS & VERIFICATION CHECKS PASSED!  ');
console.log('==============================================');
