import assert from 'node:assert/strict';
import { containsState, freshState, mergeState, normalizeState } from '../functions/lib/sync-core.mjs';

const base = freshState('2026-08-10');
base.days['2026-08-10'] = { date: '2026-08-10', newIds: [1, 2], reviewIds: [], doneIds: [1], completed: false };
base.memory[1] = { learnedAt: '2026-08-10', stage: 0, lastReviewed: '2026-08-10', nextReview: '2026-08-11' };
const other = structuredClone(base);
other.days['2026-08-10'].doneIds.push(2);
other.memory[2] = { learnedAt: '2026-08-10', stage: 0, lastReviewed: '2026-08-10', nextReview: '2026-08-11' };

const merged = mergeState(base, other, '2026-08-10');
assert.deepEqual(merged.days['2026-08-10'].doneIds.sort(), [1, 2], 'concurrent completions should be retained');
assert.equal(merged.days['2026-08-10'].completed, true, 'merged day should be completed');
assert.equal(containsState(merged, base, '2026-08-10'), true, 'merged state should verify the original local import');
assert.equal(containsState(merged, other, '2026-08-10'), true, 'merged state should verify the other phone import');
assert.equal(normalizeState(null, '2026-08-10').settings.newCount, 5, 'missing state should use defaults');

const staleBeforeReset = structuredClone(merged);
const reset = freshState('2026-08-11', 1);
const protectedReset = mergeState(reset, staleBeforeReset, '2026-08-11');
assert.equal(protectedReset.sync.generation, 1, 'newer reset generation should win');
assert.equal(Object.keys(protectedReset.memory).length, 0, 'stale offline data must not resurrect after reset');

const oldSettings = freshState('2026-08-10');
oldSettings.settings = { newCount: 2, reviewCount: 2 };
oldSettings.sync.settingsUpdatedAt = '2026-08-10T10:00:00.000Z';
const newSettings = structuredClone(oldSettings);
newSettings.settings = { newCount: 8, reviewCount: 12 };
newSettings.sync.settingsUpdatedAt = '2026-08-10T11:00:00.000Z';
assert.deepEqual(mergeState(newSettings, oldSettings, '2026-08-10').settings, newSettings.settings, 'stale phone must not overwrite newer settings');

console.log('PASS: family sync merge, import verification, reset isolation, settings ordering');
