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
window.matchMedia = () => ({matches: true});
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
assert.equal(gardenDoc.querySelector('#next'), null);

window.close();
practice.window.close();
console.log('Garden integration checks passed');
