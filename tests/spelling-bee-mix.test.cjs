const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const standard='at pat map mad dam rag lab sat man sap add jam wag jab mat fan rap bad ram nag rat can cap dad sam gag bat pan gap had yam lag cat ran lap fad pam cab'.split(' ');
const bonus='bell lack sock chop chess sell pack duck chat check fell kick luck chap shell yell sick puck chug shut tell lick tuck chip ship'.split(' ');
const words=[...standard,...bonus].map((text,i)=>({id:1000000+i,text}));
const seed={version:4,settings:{newCount:5,reviewCount:5,activeBook:'book-beetest1',learningTrack:'all'},days:{},memory:{0:{stage:4,learnedAt:'2020-01-01',nextReview:'2020-01-02'}},books:{'book-beetest1':{id:'book-beetest1',name:'Spelling Bee',words}},sync:{generation:0},startedAt:'2020-01-01'};
function open(s){return new JSDOM(html,{url:'https://feature-spelling-bee-mix.starter-daily-dictation.pages.dev',runScripts:'dangerously',beforeParse(w){w.localStorage.setItem('starter-dictation-v2',JSON.stringify(s))}})}
function state(d){return JSON.parse(d.window.localStorage.getItem('starter-dictation-v2'))}
function bonusCount(ids){return ids.filter(id=>id>=1000000+standard.length).length}
const d=open(seed);
try{
  const date=Object.keys(state(d).days)[0];let p=state(d).days[date];
  assert.equal(p.newIds.length,5);assert.equal(bonusCount(p.newIds),2);
  assert.deepEqual(state(d).memory,seed.memory,'generation never changes existing memory');
  const first=[...p.newIds];
  for(const id of first)d.window.document.querySelector(`[data-know="${id}"]`).click();
  d.window.document.querySelector('[data-test-days="1"]').click();
  let s=state(d);p=s.days[Object.keys(s.days).sort().at(-1)];
  assert.equal(bonusCount(p.newIds),1,'next five compensate rounding for seven to three');
  assert.equal(bonusCount([...first,...p.newIds]),3);
  assert.equal(p.reviewIds.length,5,'all yesterday words still receive review irrespective of group');
  const again=open(s);try{assert.deepEqual(state(again).days,p===undefined?{}:s.days,'refresh keeps chosen words stable')}finally{again.window.close()}
  for(let n=1;n<=20;n++){
    const selected=d.window.eval(`pickBeeWords(store,bookIds(store).filter(id=>!store.memory[id]),${n})`);
    assert.equal(selected.length,n);assert.equal(new Set(selected).size,n);
    if(n>=2){assert(bonusCount(selected)>0);assert(bonusCount(selected)<n)}
  }
  const onlyStandard=d.window.eval('pickBeeWords(store,bookIds(store).filter(id=>!isBeeBonus(store,id)),5)');assert.equal(onlyStandard.length,5);assert.equal(bonusCount(onlyStandard),0);
  const onlyBonus=d.window.eval('pickBeeWords(store,bookIds(store).filter(id=>isBeeBonus(store,id)),5)');assert.equal(onlyBonus.length,5);assert.equal(bonusCount(onlyBonus),5);
  const completedBefore=structuredClone(s.memory);
  d.window.eval('store.settings.newCount=3;ensure(store,true);save()');
  assert.deepEqual(state(d).memory,completedBefore,'changing quantity preserves all progress');
  console.log('PASS: Spelling Bee 7:3 cumulative mix, all batch sizes, exhaustion, reload, independent memory, and next-day review');
}finally{d.window.close()}
