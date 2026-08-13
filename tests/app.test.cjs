const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

async function load(seed, syncSeed, fetchHandler) {
  const dom = new JSDOM(html, {
    url: 'https://starter-daily-dictation.pages.dev',
    runScripts: 'dangerously',
    beforeParse(window) {
      window.confirm = () => true;
      window.prompt = () => 'RESET';
      if (fetchHandler) window.fetch = fetchHandler;
      if (seed) {
        window.localStorage.setItem('starter-dictation-v2', JSON.stringify(seed));
      }
      if (syncSeed) {
        window.localStorage.setItem('starter-dictation-sync-v1', JSON.stringify(syncSeed));
      }
    }
  });
  await new Promise(resolve => dom.window.addEventListener('load', resolve));
  return dom;
}

function state(dom) {
  return JSON.parse(dom.window.localStorage.getItem('starter-dictation-v2'));
}

(async () => {
  const { mergeState } = await import('../functions/lib/sync-core.mjs');
  const fresh = await load();
  let current = state(fresh);
  const today = Object.keys(current.days)[0];
  assert(current.version === 4, 'fresh schema should be v4');
  assert(current.sync.generation === 0, 'fresh state should start at sync generation 0');
  assert(current.days[today].newIds.length === 5, 'fresh plan should contain 5 new words');
  assert(current.days[today].reviewIds.length === 0, 'fresh plan should have no due review words');
  assert(fresh.window.document.querySelectorAll('#rows input').length === 0, 'today should not require keyboard input');
  assert(fresh.window.document.querySelectorAll('#rows .word').length === 5, 'today should display each word for parents to read');
  assert(fresh.window.document.querySelector('#syncCode'), 'family sync code field should be available');
  assert(fresh.window.document.querySelector('#createSync'), 'family sync create action should be available');

  fresh.window.document.querySelector('[data-tab="progress"]').click();
  fresh.window.document.querySelector('#newCount').value = '3';
  fresh.window.document.querySelector('#reviewCount').value = '7';
  fresh.window.document.querySelector('#saveSettings').click();
  current = state(fresh);
  assert(current.settings.newCount === 3 && current.settings.reviewCount === 7, 'separate settings should save');
  assert(current.days[today].newIds.length === 3, 'today should update to 3 new words');

  const dueSeed = {
    version: 3,
    days: {},
    memory: {
      1: {
        learnedAt: '2020-01-01',
        stage: 0,
        lastReviewed: '2020-01-01',
        nextReview: '2020-01-02'
      }
    },
    settings: { newCount: 2, reviewCount: 1 },
    startedAt: '2020-01-01'
  };
  const due = await load(dueSeed);
  let dueState = state(due);
  const dueToday = Object.keys(dueState.days)[0];
  assert(dueState.days[dueToday].reviewIds.length === 1, 'due word should appear for review');
  assert(due.window.document.querySelectorAll('.kind.review').length === 1, 'review should be rendered');
  due.window.document.querySelector('[data-know="1"]').click();
  dueState = state(due);
  assert(dueState.memory[1].stage === 1, 'completed review should advance one stage');

  const next = new Date(`${dueToday}T12:00:00`);
  next.setDate(next.getDate() + 2);
  const expected = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  assert(dueState.memory[1].nextReview === expected, 'stage 1 should schedule two days later');

  const legacy = await load({
    days: {
      '2020-01-01': {
        date: '2020-01-01',
        newIds: [9],
        reviewIds: [],
        doneIds: [9],
        completed: true
      }
    },
    startedAt: '2020-01-01'
  });
  const migrated = state(legacy);
  assert(migrated.version === 4 && migrated.memory[9], 'legacy completed words should migrate to v4');

  const localBeforeRefresh = {
    version: 3,
    days: { '2026-08-10': { date: '2026-08-10', newIds: [1, 2], reviewIds: [], doneIds: [2], completed: false } },
    memory: { 2: { learnedAt: '2026-08-10', stage: 0, lastReviewed: '2026-08-10', nextReview: '2026-08-11' } },
    settings: { newCount: 5, reviewCount: 5 },
    startedAt: '2026-08-10'
  };
  const cloudBeforeRefresh = {
    version: 3,
    days: { '2026-08-10': { date: '2026-08-10', newIds: [1, 2], reviewIds: [], doneIds: [1], completed: false } },
    memory: { 1: { learnedAt: '2026-08-10', stage: 0, lastReviewed: '2026-08-10', nextReview: '2026-08-11' } },
    settings: { newCount: 5, reviewCount: 5 },
    startedAt: '2026-08-10'
  };
  let refreshOperation;
  const refreshed = await load(localBeforeRefresh, { enabled: true, code: 'family-code', deviceId: 'wife-phone' }, async (_url, options) => {
    const request = JSON.parse(options.body);
    refreshOperation = request.operation;
    const merged = mergeState(cloudBeforeRefresh, request.state, request.date);
    return { ok: true, status: 200, json: async () => ({ state: merged, revision: 2, backupComplete: true, importVerified: true }) };
  });
  await new Promise(resolve => setTimeout(resolve, 20));
  const afterRefresh = state(refreshed);
  assert(refreshOperation === 'import', 'first upgraded refresh should back up and import instead of read-overwriting local state');
  assert(afterRefresh.days['2026-08-10'].doneIds.includes(1) && afterRefresh.days['2026-08-10'].doneIds.includes(2), 'refresh sync should retain both phones completions');
  assert(JSON.parse(refreshed.window.localStorage.getItem('starter-dictation-sync-v1')).backupComplete, 'verified import should be remembered per browser');

  fresh.window.document.querySelector('#reset').click();
  current = state(fresh);
  assert(current.settings.newCount === 5 && current.settings.reviewCount === 5, 'reset should restore defaults');
  assert(Object.keys(current.memory).length === 0, 'reset should clear learned words and review plan');
  assert(current.sync.generation === 1, 'reset should advance sync generation');

  console.log('PASS: fresh plan, settings, Ebbinghaus review, v4 migration, reset generation');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
