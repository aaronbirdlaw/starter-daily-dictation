import { onRequestPost } from '../functions/api/sync.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

class FakeD1 {
  constructor() { this.row = null; this.backups = []; }
  prepare(sql) {
    return {
      bind: (...values) => ({
        first: async () => this.row,
        run: async () => {
          if (sql.startsWith('INSERT INTO family_sync_backups')) {
            this.backups.push({ codeHash: values[0], reason: values[2], stateJson: values[3] });
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('INSERT INTO family_sync ')) {
            this.row = { state_json: values[1], revision: 1 };
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('UPDATE family_sync ')) {
            if (!this.row || this.row.revision !== values[2]) return { meta: { changes: 0 } };
            this.row = { state_json: values[0], revision: this.row.revision + 1 };
            return { meta: { changes: 1 } };
          }
          throw new Error(`Unhandled SQL in test: ${sql}`);
        }
      })
    };
  }
}

const date = '2026-08-16';
const makeState = doneIds => ({
  version: 4,
  days: { [date]: { date, newIds: [1, 2], reviewIds: [], doneIds, completed: doneIds.length === 2 } },
  memory: Object.fromEntries(doneIds.map(id => [id, { learnedAt: date, stage: 0, lastReviewed: date, nextReview: '2026-08-17' }])),
  settings: { newCount: 5, reviewCount: 5 },
  startedAt: date,
  sync: { generation: 0, settingsUpdatedAt: '2026-08-16T00:00:00.000Z' }
});
const call = async (db, state, deviceId) => {
  const request = new Request('https://starter-daily-dictation.pages.dev/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'same-family-code', operation: 'create', state, date, deviceId })
  });
  return onRequestPost({ request, env: { DB: db } });
};

const db = new FakeD1();
const first = await call(db, makeState([1]), 'first-phone');
assert(first.ok, 'first create should succeed');
assert((await first.json()).created === true, 'first create should report a new family');

const repeated = await call(db, makeState([2]), 'second-attempt');
assert(repeated.ok, 'repeating create with the same code should safely reconnect');
const payload = await repeated.json();
assert(payload.created === false, 'repeated create should report an existing family');
assert(payload.state.days[date].doneIds.includes(1) && payload.state.days[date].doneIds.includes(2), 'repeated create should merge both progress records');
assert(db.backups.length === 2 && db.backups[1].reason === 'recreate', 'repeated create should back up local state before merging');

console.log('PASS: repeated family creation safely reconnects and merges progress');
