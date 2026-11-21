const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const source=name=>fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');
const key='starter-reward-wardrobe-v1';
const dom=new JSDOM(source('index.html'),{url:'http://localhost:4173',runScripts:'dangerously',beforeParse(w){
  w.HTMLCanvasElement.prototype.getContext=()=>Object.fromEntries(['beginPath','ellipse','fill','clearRect','moveTo','lineTo','closePath','stroke'].map(k=>[k,()=>{}]));
}});
try{
  const w=dom.window,d=w.document;
  w.eval(source('wordbooks.js'));w.eval(source('wardrobe.js'));
  const click=s=>d.querySelector(s).click();
  const check=n=>assert.equal(d.querySelector('#reward-points').textContent,n+' 积分');
  const finish=()=>{while(d.querySelector('[data-know]'))click('[data-know]')};
  const saved=()=>JSON.parse(w.localStorage.getItem(key));
  check(0);
  assert(d.querySelector('[data-outfit=peach]').disabled);
  click('[data-know]');check(0);
  finish();check(5);
  const day=saved().days[0];
  w.eval('store.days[localDate()]=undefined;ensure(store,true);renderToday()');
  finish();check(5);
  assert.deepEqual(saved().days,[day]);
  click('[data-outfit=peach]');check(0);
  assert.deepEqual(saved().owned,['peach']);
  assert.equal(saved().wear.top,'peach');
  click('[data-outfit=peach]');check(0);
  assert.equal(saved().wear.top,null);
  click('[data-outfit=peach]');check(0);
  assert.equal(saved().wear.top,'peach');
  d.querySelector('#wardrobe').open=true;click('[data-turn="30"]');
  click('[data-test-days="1"]');finish();check(5);
  click('[data-outfit=bow]');check(0);
  assert.equal(saved().wear.head,'bow');
  console.log('PASS: completion rewards, same-day duplicate prevention, redemption, outfit reuse, and rotation');
}finally{dom.window.close()}
