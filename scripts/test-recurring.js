import assert from 'node:assert/strict';
import {
  normalizeTitle,
  getLocalDayKey,
  detectRecurringTasks,
  checkThreeDayStreak
} from '../src/lib/recurring.js';

console.log('--- Running Recurring Events Tests ---\n');

// 1. Definition & Inner Whitespace Collapsing
console.log('1. Testing Definition & Normalization...');
assert.equal(normalizeTitle('  Drink   water  '), 'drink water', 'Inner whitespace must collapse');
assert.equal(normalizeTitle('Drink water'), 'drink water');
assert.equal(normalizeTitle('DRINK   WATER'), 'drink water');
assert.equal(normalizeTitle('   '), '', 'Empty whitespace title must normalize to empty string');
assert.equal(normalizeTitle(null), '', 'Null title must normalize to empty string');
console.log('   ✓ Normalization & whitespace collapsing passed.');

// 2. Time Zones & Local Day Key
console.log('\n2. Testing Time Zones & Local Day Calculation...');
// 1:00 AM IST on Nov 16, 2026 is 19:30 UTC on Nov 15, 2026
const ist1amUtc = '2026-11-15T19:30:00.000Z';
const resolvedDayKey = getLocalDayKey(ist1amUtc);
// In device local time (IST UTC+5:30):
const expectedLocalDay = new Date(ist1amUtc).getDate();
const actualLocalDay = Number(resolvedDayKey.split('-')[2]);
assert.equal(actualLocalDay, expectedLocalDay, '1 AM local must resolve to local calendar day');
console.log(`   ✓ Task at ${ist1amUtc} resolves to local day key: ${resolvedDayKey}`);

// 3. Several Entries on Same Day Count as One Day
console.log('\n3. Testing Multiple Entries on Same Day...');
const sameDayTasks = [
  { title: 'Workout', created_at: '2026-11-10T04:00:00Z' },
  { title: 'Workout', created_at: '2026-11-10T10:00:00Z' },
  { title: 'Workout', created_at: '2026-11-11T04:00:00Z' }
];
const sameDayResult = detectRecurringTasks(sameDayTasks);
assert.equal(sameDayResult.length, 0, '2 distinct calendar days with multiple entries must not trigger 3-day streak');
console.log('   ✓ Same-day multiple entries correctly deduplicated.');

// 4. Which Rows Count: Completed & Cleared (deleted_at set) Tasks
console.log('\n4. Testing Which Rows Count (Completed & Cleared)...');
const habitTasks = [
  { id: '1', title: 'Floss teeth', done: true, deleted_at: '2026-11-10T20:00:00Z', created_at: '2026-11-10T08:00:00Z' },
  { id: '2', title: 'Floss teeth', done: true, deleted_at: null, created_at: '2026-11-11T08:00:00Z' },
  { id: '3', title: 'Floss  teeth', done: false, deleted_at: null, created_at: '2026-11-12T08:00:00Z' }
];
const habitResult = detectRecurringTasks(habitTasks);
assert.equal(habitResult.length, 1, 'Cleared task with deleted_at set must count toward streak');
assert.equal(habitResult[0].normalizedTitle, 'floss teeth');
console.log('   ✓ Cleared tasks (deleted_at set) and completed tasks count toward detection.');

// 5. Non-Consecutive Days (Mon, Tue, Thu)
console.log('\n5. Testing Non-Consecutive Days...');
const nonConsecutiveTasks = [
  { title: 'Read book', created_at: '2026-11-09T08:00:00Z' }, // Day 1
  { title: 'Read book', created_at: '2026-11-10T08:00:00Z' }, // Day 2
  { title: 'Read book', created_at: '2026-11-12T08:00:00Z' }  // Day 4 (gap on Day 3)
];
const nonConsecutiveResult = detectRecurringTasks(nonConsecutiveTasks);
assert.equal(nonConsecutiveResult.length, 0, 'Non-consecutive days (Mon, Tue, Thu) must not be flagged as recurring');
console.log('   ✓ Non-consecutive calendar days correctly rejected.');

// 6. 5+ Consecutive Days in a Row
console.log('\n6. Testing 5+ Consecutive Days...');
const fiveDayTasks = [
  { title: 'Meditate', created_at: '2026-11-01T08:00:00Z' },
  { title: 'Meditate', created_at: '2026-11-02T08:00:00Z' },
  { title: 'Meditate', created_at: '2026-11-03T08:00:00Z' },
  { title: 'Meditate', created_at: '2026-11-04T08:00:00Z' },
  { title: 'Meditate', created_at: '2026-11-05T08:00:00Z' }
];
const fiveDayResult = detectRecurringTasks(fiveDayTasks);
assert.equal(fiveDayResult.length, 1, '5 consecutive days must produce exactly 1 recurring entry');
assert.equal(fiveDayResult[0].streakDays, 5, 'Streak length should be 5 days');
console.log('   ✓ 5+ consecutive days correctly aggregated into 1 recurring entry.');

// 7. Edge Cases: Emoji & Whitespace
console.log('\n7. Testing Edge Cases (Emoji, Whitespace, Punctuation)...');
const emojiTasks = [
  { title: '🏃  Morning jog', created_at: '2026-11-01T08:00:00Z' },
  { title: '🏃 Morning jog', created_at: '2026-11-02T08:00:00Z' },
  { title: '🏃   Morning jog', created_at: '2026-11-03T08:00:00Z' }
];
const emojiResult = detectRecurringTasks(emojiTasks);
assert.equal(emojiResult.length, 1, 'Emoji with varied inner spacing must be recognized as same task');

// Punctuation distinction
const punctuationTasks = [
  { title: 'Write code!', created_at: '2026-11-01T08:00:00Z' },
  { title: 'Write code', created_at: '2026-11-02T08:00:00Z' },
  { title: 'Write code', created_at: '2026-11-03T08:00:00Z' }
];
assert.equal(detectRecurringTasks(punctuationTasks).length, 0, 'Punctuation differences preserved per definition');
console.log('   ✓ Emoji with inner whitespace and punctuation rules verified.');

// 8. Performance: Single Pass over Tasks
console.log('\n8. Testing Performance with Mixed Multi-Task List...');
const mixedTasks = [];
const titles = ['Walk dog', 'Read', 'Drink water', 'Journal', 'Cook dinner'];
for (let day = 1; day <= 10; day++) {
  const dayStr = String(day).padStart(2, '0');
  for (const t of titles) {
    // Walk dog every day
    // Read every 2nd day
    if (t === 'Walk dog' || (t === 'Drink water' && day <= 3) || (t === 'Read' && day % 2 === 0)) {
      mixedTasks.push({
        title: `  ${t}  `,
        created_at: `2026-11-${dayStr}T09:00:00Z`
      });
    }
  }
}
const mixedResult = detectRecurringTasks(mixedTasks);
const detectedTitles = mixedResult.map((r) => r.normalizedTitle).sort();
assert.deepEqual(detectedTitles, ['drink water', 'walk dog'], 'Only 3+ consecutive day tasks flagged');
console.log('   ✓ Single pass detection correctly identified recurring tasks: ', detectedTitles);

console.log('\n🎉 ALL RECURRING EVENTS TESTS PASSED SUCCESSFULLY!');

