const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
let played=[],resumes=0,cancels=0,voices=[{lang:'en-GB',name:'English'}];
const dom=new JSDOM(html,{url:'https://starter-daily-dictation.pages.dev',runScripts:'dangerously',beforeParse(w){
 w.SpeechSynthesisUtterance=function(text){this.text=text};
 w.speechSynthesis={getVoices:()=>voices,cancel(){cancels++},resume(){resumes++},speak(u){played.push(u)}};
 w.localStorage.setItem('starter-dictation-v2',JSON.stringify({version:4,days:{},memory:{},books:{'book-speechtest':{id:'book-speechtest',name:'Spelling Bee',words:[{id:1000001,text:'at'},{id:1000002,text:'elephant'}]}},settings:{activeBook:'book-speechtest',newCount:5},sync:{generation:0}}));
}});
const w=dom.window;
try{
 const today=w.document.querySelector('[data-say]');assert(today.querySelector('svg'));assert.equal(today.textContent,'');today.click();
 assert.equal(played.length,1);assert.equal(played[0].text,'at');assert.equal(played[0].lang,'en-GB');assert(resumes>0);assert.equal(cancels,0,'first tap should not cancel an idle Safari engine');
 played[0].onstart();assert.match(w.document.querySelector('#speechStatus').textContent,/正在播放/);
 played[0].onerror({error:'not-allowed'});assert.match(w.document.querySelector('#speechStatus').textContent,/未能播放/);
 w.document.querySelector('[data-tab="words"]').click();
 const bank=w.document.querySelector('[data-bank-say]');assert(bank.querySelector('svg'));assert.equal(bank.textContent,'');
 voices=[];bank.click();assert.equal(played.at(-1).text,'at');assert.equal(played.at(-1).lang,'en-GB','empty initial iOS voice list still uses English');
 played.at(-1).onend();assert.match(w.document.querySelector('#speechStatus').textContent,/播放完成/);
 played=[];w.document.querySelector('#playAll').click();assert.equal(played.length,2,'all words must queue directly in user gesture');assert.deepEqual(played.map(u=>u.text),['at','elephant']);
 const previous=played[0];bank.click();const status=w.document.querySelector('#speechStatus').textContent;previous.onerror({error:'not-allowed'});assert.equal(w.document.querySelector('#speechStatus').textContent,status,'stale playback must not overwrite new status');
 delete w.speechSynthesis;bank.click();assert.match(w.document.querySelector('#speechStatus').textContent,/不支持/);
 assert(!html.includes('◖))'),'text-built speaker glyph must never wrap on iPhone');
 console.log('PASS: fixed speaker icons, custom bank speech dispatch, resume, empty voice list, sequential queue, status/errors and missing API');
}finally{w.close()}
