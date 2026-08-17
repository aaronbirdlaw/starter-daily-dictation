const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

async function load(seed, syncSeed, fetchHandler, url = 'https://starter-daily-dictation.pages.dev') {
  const dom = new JSDOM(html, {
    url,
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
  const firstWords = [...fresh.window.document.querySelectorAll('#rows .word')].map(element => element.textContent.trim());
  const firstLengths = firstWords.map(word => word.replace(/[^a-z]/gi, '').length);
  assert(firstLengths.every((length, index) => index === 0 || firstLengths[index - 1] <= length), 'new words should be ordered from fewer letters to more letters');
  assert(firstWords.join('|') === 'a|I|an|at|be', 'a fresh learner should start with the shortest deterministic spelling set');
  assert(fresh.window.document.querySelector('#syncCode'), 'family sync code field should be available');
  assert(fresh.window.document.querySelector('#createSync'), 'family sync create action should be available');
  assert(!fresh.window.document.querySelector('#syncSetup').classList.contains('hidden'), 'setup actions should be visible before family sync is enabled');
  assert(fresh.window.document.querySelector('#syncNow').classList.contains('hidden'), 'manual refresh should be hidden before family sync is enabled');
  assert(fresh.window.document.querySelector('#testClockPanel').classList.contains('hidden'), 'production should hide preview time controls');

  fresh.window.document.querySelector('[data-tab="progress"]').click();
  fresh.window.document.querySelector('#newCount').value = '3';
  fresh.window.document.querySelector('#reviewCount').value = '7';
  fresh.window.document.querySelector('#saveSettings').click();
  current = state(fresh);
  assert(current.settings.newCount === 3 && current.settings.reviewCount === 7, 'separate settings should save');
  assert(current.days[today].newIds.length === 3, 'today should update to 3 new words');

  const raceSeed = JSON.parse(JSON.stringify(current));
  raceSeed.settings = { newCount: 5, reviewCount: 5 };
  raceSeed.sync.settingsUpdatedAt = '2026-08-10T00:00:00.000Z';
  let releaseInitialSync;
  const settingsRace = await load(
    raceSeed,
    { enabled: true, code: 'family-code', backupComplete: true, deviceId: 'settings-phone' },
    () => new Promise(resolve => { releaseInitialSync = resolve; }),
    'https://feature-cloud-sync.starter-daily-dictation.pages.dev'
  );
  settingsRace.window.document.querySelector('[data-tab="progress"]').click();
  settingsRace.window.document.querySelector('#newCount').value = '8';
  settingsRace.window.document.querySelector('#reviewCount').value = '9';
  settingsRace.window.document.querySelector('#saveSettings').click();
  releaseInitialSync({
    ok: true,
    status: 200,
    json: async () => ({ state: raceSeed, revision: 2, backupComplete: true, importVerified: true })
  });
  await new Promise(resolve => setTimeout(resolve, 30));
  const settingsAfterDelayedSync = state(settingsRace);
  assert(
    settingsAfterDelayedSync.settings.newCount === 8 && settingsAfterDelayedSync.settings.reviewCount === 9,
    'a delayed sync response must not overwrite settings saved while the request was in flight'
  );
  settingsRace.window.close();

  const futureSettingsSeed = JSON.parse(JSON.stringify(raceSeed));
  futureSettingsSeed.sync.settingsUpdatedAt = '2099-01-01T00:00:00.000Z';
  const futureSettings = await load(futureSettingsSeed);
  futureSettings.window.document.querySelector('[data-tab="progress"]').click();
  futureSettings.window.document.querySelector('#newCount').value = '6';
  futureSettings.window.document.querySelector('#reviewCount').value = '0';
  futureSettings.window.document.querySelector('#saveSettings').click();
  const recoveredSettings = state(futureSettings);
  assert(recoveredSettings.settings.newCount === 6, 'settings should change even when an old cloud timestamp is in the future');
  assert(recoveredSettings.settings.reviewCount === 0, 'zero review limit should save locally');
  assert(recoveredSettings.sync.settingsUpdatedAt > futureSettingsSeed.sync.settingsUpdatedAt, 'a settings edit should advance the logical timestamp beyond a future value');

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

  const actualToday = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const localPlanBeforeDueSync = {
    version: 4,
    days: { [actualToday]: { date: actualToday, newIds: [10, 11, 12, 13, 14], reviewIds: [], doneIds: [], completed: false } },
    memory: {},
    settings: { newCount: 5, reviewCount: 5 },
    startedAt: actualToday,
    sync: { generation: 0, settingsUpdatedAt: new Date().toISOString() }
  };
  const cloudWithDueReview = JSON.parse(JSON.stringify(localPlanBeforeDueSync));
  cloudWithDueReview.memory[1] = { learnedAt: '2020-01-01', stage: 0, lastReviewed: '2020-01-01', nextReview: '2020-01-02' };
  const dueAfterSync = await load(localPlanBeforeDueSync, { enabled: true, code: 'family-code', backupComplete: true, deviceId: 'parent-phone' }, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ state: cloudWithDueReview, revision: 3, backupComplete: true, importVerified: true })
  }));
  await new Promise(resolve => setTimeout(resolve, 20));
  const dueAfterSyncState = state(dueAfterSync);
  assert(dueAfterSyncState.days[actualToday].reviewIds.includes(1), 'a due review received from cloud should be added to an existing daily plan');
  assert(dueAfterSync.window.document.querySelectorAll('.kind.review').length === 1, 'cloud-arrived due review should be rendered immediately');

  let joinAttempts = 0;
  const retryJoin = await load(undefined, undefined, async (_url, options) => {
    joinAttempts += 1;
    const request = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        state: request.state,
        revision: joinAttempts,
        backupComplete: true,
        importVerified: joinAttempts > 1
      })
    };
  });
  retryJoin.window.document.querySelector('[data-tab="progress"]').click();
  retryJoin.window.document.querySelector('#syncCode').value = 'family-code';
  retryJoin.window.document.querySelector('#joinSync').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(retryJoin.window.document.querySelector('#retrySync').classList.contains('hidden'), 'setup failure should keep the create and join choices without adding a duplicate retry button');
  retryJoin.window.document.querySelector('#joinSync').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(joinAttempts === 2, 'retry should repeat join when family sync is not enabled yet');
  assert(JSON.parse(retryJoin.window.localStorage.getItem('starter-dictation-sync-v1')).enabled, 'successful retry should enable family sync');
  assert(retryJoin.window.document.querySelector('#syncSetup').classList.contains('hidden'), 'create and join actions should disappear after this device is connected');
  assert(!retryJoin.window.document.querySelector('#syncNow').classList.contains('hidden'), 'manual sync should appear after family sync is enabled');
  assert(!retryJoin.window.document.querySelector('#manageSync').classList.contains('hidden'), 'connected devices should offer family sync management');
  retryJoin.window.document.querySelector('#manageSync').click();
  assert(!retryJoin.window.document.querySelector('#syncManager').classList.contains('hidden'), 'family sync manager should open on demand');
  retryJoin.window.document.querySelector('#showSyncCode').click();
  assert(retryJoin.window.document.querySelector('#currentSyncCode').textContent.includes('family-code'), 'a connected device should be able to reveal its current sync code');
  retryJoin.window.document.querySelector('#newSyncCode').value = 'new-family-code';
  retryJoin.window.document.querySelector('#newSyncCodeConfirm').value = 'new-family-code';
  retryJoin.window.document.querySelector('#createNewPlan').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(JSON.parse(retryJoin.window.localStorage.getItem('starter-dictation-sync-v1')).code === 'new-family-code', 'creating a new family plan should switch only this device to the new code');
  assert(retryJoin.window.document.querySelector('#syncHelp').textContent.includes('通常不需要手动操作'), 'connected state should explain that synchronization is automatic');
  retryJoin.window.document.querySelector('#syncNow').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(joinAttempts === 4, 'manual sync should immediately contact the cloud');
  assert(retryJoin.window.document.querySelector('#syncMeta').textContent.includes('云端版本 4'), 'sync metadata should show the latest cloud revision');

  let safariFetchAttempts = 0;
  const safariCreate = await load(undefined, undefined, async (url, options) => {
    safariFetchAttempts += 1;
    if (safariFetchAttempts === 1) throw new Error('The string did not match the expected pattern.');
    const request = JSON.parse(options.body);
    assert(url === '/api/sync', 'Safari fallback should retry with the root-relative sync endpoint');
    return { ok: true, status: 200, json: async () => ({ state: request.state, revision: 1, created: true, backupComplete: true, importVerified: true }) };
  });
  safariCreate.window.document.querySelector('[data-tab="progress"]').click();
  safariCreate.window.document.querySelector('#syncCode').value = 'safari-family-code';
  safariCreate.window.document.querySelector('#createSync').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(safariFetchAttempts === 2, 'a Safari URL pattern error should retry the sync request once');
  assert(JSON.parse(safariCreate.window.localStorage.getItem('starter-dictation-sync-v1')).enabled, 'Safari fallback should finish creating family sync');

  let androidFetchAttempts = 0;
  const androidJoin = await load(undefined, undefined, async () => {
    androidFetchAttempts += 1;
    throw {};
  });
  let androidXhrBody, androidXhrAttempts = 0;
  androidJoin.window.XMLHttpRequest = class {
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { if (name === 'content-type') this.contentType = value; }
    send(body) {
      androidXhrAttempts += 1;
      if (!this.contentType.startsWith('application/x-www-form-urlencoded')) {
        this.status = 0;
        setTimeout(() => this.onload(), 0);
        return;
      }
      androidXhrBody = JSON.parse(new URLSearchParams(body).get('payload'));
      this.status = 200;
      this.responseText = JSON.stringify({ state: androidXhrBody.state, revision: 4, backupComplete: true, importVerified: true });
      setTimeout(() => this.onload(), 0);
    }
  };
  androidJoin.window.document.querySelector('[data-tab="progress"]').click();
  androidJoin.window.document.querySelector('#syncCode').value = 'android-family-code';
  androidJoin.window.document.querySelector('#joinSync').click();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert(androidFetchAttempts === 2, 'Android should try both absolute and relative fetch endpoints');
  assert(androidXhrAttempts === 2, 'Android status 0 should fall back from JSON XHR to form-encoded XHR');
  assert(androidXhrBody.operation === 'join', 'Android XHR fallback should preserve the requested join operation');
  assert(JSON.parse(androidJoin.window.localStorage.getItem('starter-dictation-sync-v1')).enabled, 'Android XHR fallback should finish joining family sync');

  const preview = await load(undefined, undefined, undefined, 'https://feature-cloud-sync.starter-daily-dictation.pages.dev');
  assert(!preview.window.document.querySelector('#testClockPanel').classList.contains('hidden'), 'preview should show time controls');
  const previewFirstWord = Number(preview.window.document.querySelector('[data-know]').dataset.know);
  preview.window.document.querySelector(`[data-know="${previewFirstWord}"]`).click();
  preview.window.document.querySelector('[data-test-days="1"]').click();
  const previewState = state(preview);
  assert(previewState.sync.previewClock.offset === 1, 'preview clock changes should be stored in synchronized state');
  const simulatedToday = Object.keys(previewState.days).sort().at(-1);
  assert(previewState.days[simulatedToday].reviewIds.includes(previewFirstWord), 'advancing preview by one day should reveal the first review');
  assert(preview.window.document.querySelectorAll('.kind.review').length === 1, 'simulated due review should be rendered');
  preview.window.document.querySelector(`[data-know="${previewFirstWord}"]`).click();
  preview.window.document.querySelector('[data-test-days="2"]').click();
  const previewSecondReviewState = state(preview);
  const simulatedSecondReviewDay = Object.keys(previewSecondReviewState.days).sort().at(-1);
  assert(previewSecondReviewState.days[simulatedSecondReviewDay].reviewIds.includes(previewFirstWord), 'advancing two more days should reveal the second review');
  assert(previewSecondReviewState.memory[previewFirstWord].stage === 1, 'first completed review should advance the memory stage');
  const advancePreviewBy = days => {
    while (days >= 2) {
      preview.window.document.querySelector('[data-test-days="2"]').click();
      days -= 2;
    }
    if (days) preview.window.document.querySelector('[data-test-days="1"]').click();
  };
  const addLocalDays = (date, days) => {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() + days);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  };
  [4, 7, 15, 30, 60, 60].forEach((interval, index) => {
    const reviewDay = Object.keys(state(preview).days).sort().at(-1);
    preview.window.document.querySelector(`[data-know="${previewFirstWord}"]`).click();
    const afterReview = state(preview);
    assert(afterReview.memory[previewFirstWord].stage === Math.min(index + 2, 6), `review stage ${Math.min(index + 2, 6)} should be recorded`);
    assert(afterReview.memory[previewFirstWord].nextReview === addLocalDays(reviewDay, interval), `review should schedule ${interval} days later`);
    advancePreviewBy(interval);
    const nextReviewState = state(preview);
    const nextReviewDay = Object.keys(nextReviewState.days).sort().at(-1);
    assert(nextReviewState.days[nextReviewDay].reviewIds.includes(previewFirstWord), `review should reappear after ${interval} days`);
  });

  const sharedClockSeed = {
    version: 4,
    days: {},
    memory: {},
    settings: { newCount: 5, reviewCount: 5 },
    startedAt: actualToday,
    sync: {
      generation: 0,
      settingsUpdatedAt: '2026-08-10T00:00:00.000Z',
      previewClock: { offset: 4, updatedAt: '2026-08-10T10:00:00.000Z' }
    }
  };
  const syncedPreview = await load(
    sharedClockSeed,
    { enabled: true, code: 'family-code', backupComplete: true, deviceId: 'second-preview-phone' },
    async (_url, options) => {
      const request = JSON.parse(options.body);
      const remote = JSON.parse(JSON.stringify(request.state));
      remote.sync.previewClock = { offset: 5, updatedAt: '2026-08-10T11:00:00.000Z' };
      return { ok: true, status: 200, json: async () => ({ state: remote, revision: 9, backupComplete: true, importVerified: true }) };
    },
    'https://feature-cloud-sync.starter-daily-dictation.pages.dev'
  );
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(syncedPreview.window.document.querySelector('#testClockStatus').textContent.includes('已前进 5 天'), 'a newer cloud preview date should be adopted on another device');
  assert(state(syncedPreview).sync.previewClock.offset === 5, 'the shared preview date should persist locally after cloud sync');

  let initialClockOperation;
  const previewWithoutSharedClock = await load(
    { ...sharedClockSeed, sync: { generation: 0, settingsUpdatedAt: '2026-08-10T00:00:00.000Z' } },
    { enabled: true, code: 'family-code', backupComplete: true, deviceId: 'old-preview-phone' },
    async (_url, options) => {
      const request = JSON.parse(options.body);
      initialClockOperation = request.operation;
      return { ok: true, status: 200, json: async () => ({ state: request.state, revision: 10, backupComplete: true, importVerified: true }) };
    },
    'https://feature-cloud-sync.starter-daily-dictation.pages.dev'
  );
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(initialClockOperation === 'save', 'an upgraded preview device should upload its simulated date before reading cloud state');

  fresh.window.document.querySelector('#reset').click();
  current = state(fresh);
  assert(current.settings.newCount === 5 && current.settings.reviewCount === 5, 'reset should restore defaults');
  assert(Object.keys(current.memory).length === 0, 'reset should clear learned words and review plan');
  assert(current.sync.generation === 1, 'reset should advance sync generation');

  refreshed.window.close();
  dueAfterSync.window.close();
  retryJoin.window.close();
  safariCreate.window.close();
  androidJoin.window.close();
  syncedPreview.window.close();
  previewWithoutSharedClock.window.close();

  console.log('PASS: fresh plan, settings, Ebbinghaus review, cloud due refresh, shared preview clock, manual sync, v4 migration, reset generation');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
