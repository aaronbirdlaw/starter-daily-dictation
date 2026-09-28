const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const booksScript=fs.readFileSync(path.join(__dirname,'..','wordbooks.js'),'utf8');
const key='starter-dictation-v2';
function open(seed){
  const dom=new JSDOM(html,{url:'https://starter-daily-dictation.pages.dev',runScripts:'dangerously',beforeParse(window){
    window.prompt=()=> 'reset';
    window.confirm=()=> true;
    if(seed)window.localStorage.setItem(key,JSON.stringify(seed));
  }});
  dom.window.eval(booksScript);
  return dom;
}
const state=dom=>JSON.parse(dom.window.localStorage.getItem(key));
const click=(dom,selector)=>dom.window.document.querySelector(selector).click();

(async()=>{
  const {normalizeState,mergeState,containsState,freshState}=await import('../functions/lib/sync-core.mjs');
  const dom=open();
  const starter=state(dom);
  const starterFirst=starter.days[Object.keys(starter.days)[0]].newIds[0];
  click(dom,`[data-know="${starterFirst}"]`);
  const previous=state(dom);
  assert(previous.memory[starterFirst],'Starter progress must exist before creating a book');

  click(dom,'#showBookManage');
  assert(!dom.window.document.querySelector('#bookManage').classList.contains('hidden'));
  assert(dom.window.document.querySelector('#bookImport').classList.contains('hidden'));
  assert(dom.window.document.querySelector('#bankBrowse').classList.contains('hidden'));
  dom.window.document.querySelector('#newBookName').value='妹妹的新词库';
  click(dom,'#createBook');
  const afterCreate=state(dom);
  const bookId=afterCreate.settings.activeBook;
  assert.notEqual(bookId,'starter');
  assert(afterCreate.memory[starterFirst],'creating a book must retain Starter memory');
  assert(afterCreate.days[Object.keys(afterCreate.days)[0]].doneIds.includes(starterFirst),'completed Starter word stays visible today');
  assert.equal(afterCreate.books[bookId].words.length,0);
  click(dom,'#showBookImport');
  assert(dom.window.document.querySelector('#bookManage').classList.contains('hidden'));
  assert(!dom.window.document.querySelector('#bookImport').classList.contains('hidden'));
  assert(dom.window.document.querySelector('#bankBrowse').classList.contains('hidden'));
  assert.equal(dom.window.document.querySelector('#wordImage').hasAttribute('capture'),false);
  assert.equal(dom.window.document.querySelector('#cameraImage').getAttribute('capture'),'environment');

  const input=dom.window.document.querySelector('#importWords');
  input.value='apple\nsunflower\napple\n<script>alert(1)</script>';
  click(dom,'#saveImportedWords');
  assert.equal(state(dom).books[bookId].words.length,0,'invalid lines must block an entire import');
  input.value='apple\nsunflower\napple\n1. rainstorm';
  click(dom,'#saveImportedWords');
  const imported=state(dom);
  assert.equal(imported.books[bookId].words.length,3,'unique reviewed words should import');
  assert.match(dom.window.document.querySelector('#bookImportStatus').textContent,/跳过重复 1 个/);
  assert(imported.books[bookId].words[0].id<495,'a word already in Starter should share its memory ID');
  assert(imported.days[Object.keys(imported.days)[0]].newIds.some(id=>id>=1000000),'new book words enter the daily planner');
  assert(dom.window.document.querySelector('#rows').textContent.includes('sunflower'));

  const scanFile=new dom.window.File(['sample'],'words.png',{type:'image/png'});
  const imageField=dom.window.document.querySelector('#wordImage');
  Object.defineProperty(imageField,'files',{value:[scanFile],configurable:true});
  imageField.dispatchEvent(new dom.window.Event('change'));
  let terminated=false;
  dom.window.Tesseract={createWorker:async()=>({recognize:async()=>({data:{text:'newleaf\nnewpath'}}),terminate:async()=>{terminated=true}})};
  click(dom,'#scanImage');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(state(dom).books[bookId].words.length,3,'OCR results must wait for manual approval');
  const ocrInput=dom.window.document.querySelector('#ocrWords');
  assert.match(ocrInput.value,/newleaf\nnewpath/,'OCR text should be editable before importing');
  assert(!dom.window.document.querySelector('#ocrReview').classList.contains('hidden'));
  assert(terminated,'OCR worker should be released');
  ocrInput.value='newleaf\nnewpath corrected';
  click(dom,'#saveScannedWords');
  assert.equal(state(dom).books[bookId].words.length,5,'reviewed OCR text imports only after confirmation');

  const customId=imported.books[bookId].words.find(word=>word.text==='rainstorm').id;
  const today=Object.keys(imported.days)[0];
  assert(imported.days[today].newIds.includes(customId));
  click(dom,`[data-know="${customId}"]`);
  assert(state(dom).memory[customId],'completed custom word should get a review date');
  const row=dom.window.document.querySelector(`[data-say="${customId}"]`).closest('.word-row');
  assert(row.querySelector('.word').classList.contains('crossed'),'completed custom word remains crossed out');

  const select=dom.window.document.querySelector('#bookSelect');
  select.value='starter';select.dispatchEvent(new dom.window.Event('change'));
  assert(state(dom).memory[customId],'switching back must retain custom review memory');
  assert(state(dom).days[today].doneIds.includes(customId),'switching must retain completed custom word today');
  click(dom,'#showBookManage');
  click(dom,'#bookManageList button');
  const afterDelete=state(dom);
  assert(afterDelete.books[bookId].deletedAt,'delete records a tombstone');
  assert(afterDelete.memory[customId],'delete retains learned word memory');
  assert(!dom.window.document.querySelector('#bookSelect').textContent.includes('妹妹的新词库'));
  click(dom,'#reset');
  const reset=state(dom);
  assert.equal(Object.keys(reset.memory).length,0,'Reset clears learning memory');
  assert(reset.books[bookId].words.length===5,'Reset retains the uploaded word catalog');
  assert(reset.books[bookId].deletedAt,'Reset retains deletion tombstones');
  assert.equal(reset.settings.activeBook,'starter');

  const older=freshState('2026-09-28');
  const a=normalizeState({...older,books:{[bookId]:{id:bookId,name:'妹妹的新词书',words:[{id:5000000,text:'zebra'}]}}},'2026-09-28');
  const b=structuredClone(a);b.books[bookId].words.push({id:5000001,text:'lion'});
  const merged=mergeState(a,b,'2026-09-28');
  assert.equal(merged.books[bookId].words.length,2,'concurrent book imports must merge without dropping words');
  assert(containsState(merged,a,'2026-09-28')&&containsState(merged,b,'2026-09-28'),'cloud verification must include words');
  const deleted=structuredClone(a);deleted.books[bookId].deletedAt='2026-09-29T00:00:00.000Z';
  deleted.books[bookId].updatedAt=deleted.books[bookId].deletedAt;
  const mergedDelete=mergeState(deleted,b,'2026-09-28');
  assert(mergedDelete.books[bookId].deletedAt,'a stale device cannot restore a deleted book');
  assert.equal(mergedDelete.books[bookId].words.length,2,'delete preserves book entries for review history');
  assert.equal(mergedDelete.settings.activeBook,'starter','deleted books cannot stay selected');
  assert(containsState(mergedDelete,deleted,'2026-09-28'),'sync verification includes deletion');
  const old=normalizeState(previous,'2026-09-28');
  assert.deepEqual(old.books,{},'old Starter records migrate to an empty custom-book catalog');
  assert.equal(old.settings.activeBook,'starter');
  dom.window.close();
  console.log('PASS: separate catalog management/import, OCR review, deletion, memory, Reset and sync merge');
})().catch(error=>{console.error(error);process.exitCode=1});
