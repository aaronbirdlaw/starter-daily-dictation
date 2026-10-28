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
  const w=d.window,toggle=w.document.querySelector('#beeRatioSwitch');
  assert.equal(read(d).settings.beeRatio,'equal');assert(toggle.checked);assert.equal(toggle.getAttribute('role'),'switch');
  assert.equal(bonusCount(plan(d).newIds),5,'default ten new words must be five plus five');
  toggle.checked=false;toggle.dispatchEvent(new w.Event('change'));
  assert.equal(read(d).settings.beeRatio,'standard');assert.equal(bonusCount(plan(d).newIds),3);
  assert.deepEqual(read(d).memory,initial.memory);
  toggle.checked=true;toggle.dispatchEvent(new w.Event('change'));assert.equal(bonusCount(plan(d).newIds),5);
  const id=plan(d).newIds[0];w.document.querySelector(`[data-know="${id}"]`).click();const remembered=read(d).memory;
  toggle.checked=false;toggle.dispatchEvent(new w.Event('change'));
  assert(plan(d).doneIds.includes(id));assert.deepEqual(read(d).memory,remembered,'switching ratio preserves completed-word review dates and memory');
  const state=read(d),reload=open(state);try{assert.equal(read(reload).settings.beeRatio,'standard');assert(!reload.window.document.querySelector('#beeRatioSwitch').checked)}finally{reload.window.close()}
  const normalized=normalizeState(state,'2026-10-28');assert.equal(normalized.settings.beeRatio,'standard');
  const stale=structuredClone(state);stale.settings.beeRatio='equal';stale.sync.settingsUpdatedAt='2020-01-01';assert.equal(mergeState(stale,state,'2026-10-28').settings.beeRatio,'standard');
  const oldPhone=structuredClone(state);delete oldPhone.settings.beeRatio;oldPhone.sync.settingsUpdatedAt='2099-01-01';assert.equal(mergeState(state,oldPhone,'2026-10-28').settings.beeRatio,'standard','old client cannot erase ratio choice');
  const selector=w.document.querySelector('#bookSelect');selector.value='starter';selector.dispatchEvent(new w.Event('change'));
  assert(w.document.querySelector('.bee-ratio-panel').classList.contains('hidden'),'ratio switch belongs to Spelling Bee only');
  console.log('PASS: default 1:1, manual 7:3 switch, immediate replanning, saved state, sync, memory and bank isolation');
 }finally{d.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
