const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

async function load(seed) {
  const dom = new JSDOM(html, {
    url: 'https://starter-daily-dictation.vercel.app',
    runScripts: 'dangerously',
    beforeParse(window) {
      window.confirm = () => true;
      if (seed) {
        window.localStorage.setItem('starter-dictation-v2', JSON.stringify(seed));
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
  const fresh = await load();
  let current = state(fresh);
  const today = Object.keys(current.days)[0];
  assert(current.version === 3, 'fresh schema should be v3');
  assert(current.days[today].newIds.length === 5, 'fresh plan should contain 5 new words');
  assert(current.days[today].reviewIds.length === 0, 'fresh plan should have no due review words');
  assert(fresh.window.document.querySelectorAll('#rows input').length === 0, 'today should not require keyboard input');
  assert(fresh.window.document.querySelectorAll('#rows .word').length === 5, 'today should display each word for parents to read');

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
  assert(migrated.version === 3 && migrated.memory[9], 'legacy completed words should migrate');

  fresh.window.document.querySelector('#reset').click();
  current = state(fresh);
  assert(current.settings.newCount === 5 && current.settings.reviewCount === 5, 'reset should restore defaults');
  assert(Object.keys(current.memory).length === 0, 'reset should clear learned words and review plan');

  console.log('PASS: fresh plan, settings, Ebbinghaus review, legacy migration, reset');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
