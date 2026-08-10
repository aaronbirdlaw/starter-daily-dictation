import assert from 'node:assert/strict';
import { freshState, mergeState, normalizeState } from '../functions/lib/sync-core.mjs';

const base = freshState('2026-08-10');
base.days['2026-08-10'] = { date: '2026-08-10', newIds: [1, 2], reviewIds: [], doneIds: [1], completed: false };
base.memory[1] = { learnedAt: '2026-08-10', stage: 0, lastReviewed: '2026-08-10', nextReview: '2026-08-11' };
const other = structuredClone(base);
other.days['2026-08-10'].doneIds.push(2);
other.memory[2] = { learnedAt: '2026-08-10', stage: 0, lastReviewed: '2026-08-10', nextReview: '2026-08-11' };

const merged = mergeState(base, other, '2026-08-10');
assert.deepEqual(merged.days['2026-08-10'].doneIds.sort(), [1, 2], 'concurrent completions should be retained');
assert.equal(merged.days['2026-08-10'].completed, true, 'merged day should be completed');
assert.equal(normalizeState(null, '2026-08-10').settings.newCount, 5, 'missing state should use defaults');
console.log('PASS: family sync state merge');
