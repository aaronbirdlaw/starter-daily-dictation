const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const eligibilityKey = 'audrey-dictation-garden-eligible-v1';
const inventoryKey = 'audrey-dictation-garden-inventory-v1';
const origin = 'https://starter-daily-dictation.pages.dev';
const practice = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
  url: origin,
  runScripts: 'dangerously'
});
const doc = practice.window.document;
const storage = practice.window.localStorage;
const eligible = () => JSON.parse(storage.getItem(eligibilityKey));
assert.equal(eligible(), null);
assert.ok(doc.querySelector('#testClockPanel').classList.contains('hidden'));
while (doc.querySelector('[data-know]')) doc.querySelector('[data-know]').click();
assert.equal(eligible().length, 1);
assert.equal(storage.getItem(inventoryKey), null);
doc.querySelector('[data-tab="today"]').click();
assert.equal(eligible().length, 1);

const gardenHtml = fs.readFileSync(path.join(root, 'garden/index.html'), 'utf8');
const gardenJs = fs.readFileSync(path.join(root, 'garden/garden.js'), 'utf8');
const garden = new JSDOM(gardenHtml, {url: origin + '/garden/', runScripts: 'outside-only'});
const window = garden.window;
const gardenDoc = window.document;
window.localStorage.setItem(eligibilityKey, JSON.stringify(eligible()));
window.localStorage.setItem('starter-dictation-preview-clock-v1', '15');
window.matchMedia = () => ({matches: true});
window.HTMLElement.prototype.scrollIntoView = () => {};
window.DOMPoint = class {
  constructor(x, y) { this.x = x; this.y = y; }
  matrixTransform() { return this; }
};
gardenDoc.querySelector('#garden-pages').scrollTo = () => ({});
window.eval(gardenJs);

const flowerButton = () => gardenDoc.querySelector('[data-reward="flower"]');
assert.equal(flowerButton().disabled, false);
assert.equal(gardenDoc.querySelectorAll('.planted use').length, 0);
flowerButton().click();
assert.equal(gardenDoc.querySelectorAll('.planted use').length, 0);
gardenDoc.querySelector('[data-color="purple"]').click();
const flowers = JSON.parse(window.localStorage.getItem(inventoryKey)).flowers;
assert.deepEqual(flowers, [{day: eligible()[0], color: 'purple'}]);
assert.equal(gardenDoc.querySelectorAll('.planted use').length, 1);
assert.equal(flowerButton().disabled, true);
assert.equal(gardenDoc.querySelector('#test-next'), null);
assert.equal(gardenDoc.querySelector('#test-reset-garden'), null);

const rewardButton = id => gardenDoc.querySelector(`[data-reward="${id}"]`);
assert.equal(rewardButton('butterfly').disabled, false);
assert.equal(rewardButton('sun').disabled, true);
rewardButton('butterfly').click();
assert.equal(gardenDoc.querySelectorAll('[data-color]').length, 6);
gardenDoc.querySelector('[data-color="blue"]').click();
assert.equal(rewardButton('butterfly').disabled, true);
assert.deepEqual(JSON.parse(window.localStorage.getItem(inventoryKey)).butterfly, [
  {day: eligible()[0], color: 'blue'}
]);

// Older installations already have flowers, birds and houses in this storage format.
window.localStorage.setItem(inventoryKey, JSON.stringify({flowers, bird: ['blue'], house: ['pink'], sound: false}));
window.localStorage.setItem(eligibilityKey, JSON.stringify(['2000-01-01', ...eligible()]));
window.dispatchEvent(new window.PageTransitionEvent('pageshow'));
assert.equal(gardenDoc.querySelectorAll('.planted use').length, 1);
assert.equal(gardenDoc.querySelectorAll('.perched-bird use').length, 1);
assert.equal(gardenDoc.querySelectorAll('.milestones use[href="#cottage"]').length, 1);
rewardButton('sun').click();
rewardButton('rainbow').click();
assert.equal(gardenDoc.querySelectorAll('.weather .sun-rays').length, 1);
assert.equal(gardenDoc.querySelectorAll('.weather .rainbow-drift').length, 1);
assert.equal(rewardButton('sun').disabled, true);
assert.equal(rewardButton('rainbow').disabled, true);

// Reloading renders today's weather. Earlier activations never remain in today's sky.
const inventory = JSON.parse(window.localStorage.getItem(inventoryKey));
assert.deepEqual(inventory.sun, eligible());
assert.deepEqual(inventory.rainbow, eligible());
window.dispatchEvent(new window.PageTransitionEvent('pageshow'));
assert.equal(gardenDoc.querySelectorAll('.weather [data-weather]').length, 2);
inventory.sun = ['2000-01-01'];
inventory.rainbow = ['2000-01-01'];
window.localStorage.setItem(inventoryKey, JSON.stringify(inventory));
window.localStorage.setItem(eligibilityKey, JSON.stringify(['1999-12-31', '2000-01-01']));
window.dispatchEvent(new window.PageTransitionEvent('pageshow'));
assert.equal(gardenDoc.querySelectorAll('.weather [data-weather]').length, 0);
assert.equal(rewardButton('butterfly').disabled, true);

window.close();
practice.window.close();
console.log('Garden integration checks passed');
