const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),books=fs.readFileSync(path.join(__dirname,'../wordbooks.js'),'utf8');
const standard='at pat map mad dam rag lab sat man sap add jam wag jab mat fan rap bad ram nag'.split(' '),bonus='air bell lack sock chop chess sell pack duck chat check fell kick luck chap shell importance'.split(' ');
const words=[...standard,...bonus].map((text,i)=>({id:1000000+i,text}));
const initial={version:4,days:{},memory:{0:{stage:3,learnedAt:'2020-01-01',nextReview:'2020-01-02'}},books:{'book-ratiotest':{id:'book-ratiotest',name:'Spelling Bee',words}},settings:{activeBook:'book-ratiotest',newCount:10},sync:{generation:0}};
const key='starter-dictation-v2',read=d=>JSON.parse(d.window.localStorage.getItem(key));
function open(seed){const d=new JSDOM(html,{url:'https://ratio-test.starter-daily-dictation.pages.dev',runScripts:'dangerously',beforeParse(w){w.localStorage.setItem(key,JSON.stringify(seed))}});d.window.eval(books);return d}
function plan(d){return read(d).days[Object.keys(read(d).days).sort().at(-1)]}
const bonusCount=ids=>ids.filter(id=>id>=1000000+standard.length).length;
(async()=>{
 const {normalizeState,mergeState}=await import('../functions/lib/sync-core.mjs');
 const d=open(initial);
 try{
  const w=d.window,slider=w.document.querySelector('#beeBonusPercent');
  const setPercent=n=>{slider.value=String(n);slider.dispatchEvent(new w.Event('input'));slider.dispatchEvent(new w.Event('change'))};
  assert.equal(slider.type,'range');assert.equal(slider.min,'10');assert.equal(slider.max,'100');assert.equal(slider.step,'10');assert.equal(slider.value,'50');
  assert.equal(bonusCount(plan(d).newIds),5,'default ten new words must be five plus five');
  for(let n=10;n<=100;n+=10){setPercent(n);assert.equal(read(d).settings.beeBonusPercent,n);assert.equal(bonusCount(plan(d).newIds),n/10,`ten new words must honor ${n}% Bonus`);assert.equal(new Set(plan(d).newIds).size,10)}
  assert.match(w.document.querySelector('#beeRatioValue').textContent,/Bonus 100%/);
  setPercent(30);assert.equal(bonusCount(plan(d).newIds),3);
  assert.deepEqual(read(d).memory,initial.memory);
  slider.value='80';slider.dispatchEvent(new w.Event('input'));assert.equal(read(d).settings.beeBonusPercent,30,'drag only previews until release');assert.match(w.document.querySelector('#beeRatioValue').textContent,/80%/);
  setPercent(50);assert.equal(bonusCount(plan(d).newIds),5);
  const id=plan(d).newIds[0];w.document.querySelector(`[data-know="${id}"]`).click();const remembered=read(d).memory;
  setPercent(80);
  assert(plan(d).doneIds.includes(id));assert.deepEqual(read(d).memory,remembered,'switching ratio preserves completed-word review dates and memory');
  const state=read(d),reload=open(state);try{assert.equal(read(reload).settings.beeBonusPercent,80);assert.equal(reload.window.document.querySelector('#beeBonusPercent').value,'80')}finally{reload.window.close()}
  const normalized=normalizeState(state,'2026-10-28');assert.equal(normalized.settings.beeBonusPercent,80);
  const stale=structuredClone(state);stale.settings.beeBonusPercent=20;stale.sync.settingsUpdatedAt='2020-01-01';assert.equal(mergeState(stale,state,'2026-10-28').settings.beeBonusPercent,80);
  const oldPhone=structuredClone(state);delete oldPhone.settings.beeBonusPercent;oldPhone.sync.settingsUpdatedAt='2099-01-01';assert.equal(mergeState(state,oldPhone,'2026-10-28').settings.beeBonusPercent,80,'old client cannot erase slider choice');
  for(const legacy of ['standard','equal']){const old=structuredClone(initial);old.settings.beeRatio=legacy;const migrated=open(old);try{assert.equal(read(migrated).settings.beeBonusPercent,legacy==='standard'?30:50)}finally{migrated.window.close()}}
  assert.equal(normalizeState({settings:{beeBonusPercent:200}},'2026-10-28').settings.beeBonusPercent,100);
  assert.equal(normalizeState({settings:{beeBonusPercent:-10}},'2026-10-28').settings.beeBonusPercent,10);
  const selector=w.document.querySelector('#bookSelect');selector.value='starter';selector.dispatchEvent(new w.Event('change'));
  assert(w.document.querySelector('.bee-ratio-panel').classList.contains('hidden'),'ratio switch belongs to Spelling Bee only');
  console.log('PASS: 10–100% slider, preview/commit, 100% Bonus, saved state, legacy migration, sync, memory and bank isolation');
 }finally{d.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
