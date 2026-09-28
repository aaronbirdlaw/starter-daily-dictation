(function setupWordbooks(){
  const select=document.querySelector('#bookSelect');
  const manage=document.querySelector('#bookManage');
  const importPanel=document.querySelector('#bookImport');
  const manualInput=document.querySelector('#importWords');
  const ocrInput=document.querySelector('#ocrWords');
  const bookName=id=>id==='starter'?'Starter 词库':store.books[id]?.name||'新词库';
  const activeBooks=()=>Object.entries(store.books||{}).filter(([,book])=>!book.deletedAt);
  function report(message,error=false,target='#bookImportStatus'){
    const el=document.querySelector(target);el.textContent=message;el.classList.toggle('error',error);
  }
  function renderManageList(){
    const list=document.querySelector('#bookManageList');list.replaceChildren();
    const starter=document.createElement('div');starter.className='book-manage-row';
    starter.textContent='Starter 词库 · 内置词库，不可删除';list.append(starter);
    for(const [id,book] of activeBooks()){
      const row=document.createElement('div');row.className='book-manage-row';
      const name=document.createElement('div');name.textContent=book.name;
      const count=document.createElement('span');count.textContent=`${book.words.length} 个词条`;
      const button=document.createElement('button');button.type='button';button.textContent='删除词库';
      button.setAttribute('aria-label',`删除词库 ${book.name}`);button.onclick=()=>deleteBook(id);
      row.append(name,count,button);list.append(row);
    }
  }
  function renderBookControls(){
    const selected=store.settings.activeBook||'starter';select.replaceChildren();
    for(const id of ['starter',...activeBooks().map(([id])=>id)]){
      const option=document.createElement('option');option.value=id;option.textContent=bookName(id);select.append(option);
    }
    select.value=selected;
    document.querySelector('#bookTitle').textContent=selected==='starter'?'完整词库':bookName(selected);
    document.querySelector('#wordTotal').textContent=bookIds(store).length;
    document.querySelector('#saveImportedWords').disabled=selected==='starter';
    document.querySelector('#saveScannedWords').disabled=selected==='starter';
    document.querySelector('#importTargetHint').textContent=selected==='starter'
      ?'请先在“管理词库”中增加一个自定义词库，再回来录入单词。'
      :`导入目标：${bookName(selected)}`;
    renderManageList();
    document.querySelector('#todayView .hero .eyebrow').textContent=selected==='starter'
      ?'PRE A1 · 艾宾浩斯复习':'每日 · 艾宾浩斯复习';
    const route=document.querySelector('#learningTrack');
    if(route){route.disabled=selected!=='starter';route.parentElement.querySelector('.track-hint').textContent=selected==='starter'
      ?'主题内的新词会优先进入听写；已开始学习的词仍按原有记忆曲线复习。'
      :'主题优先只适用于 Starter；当前新词来自选中的词库。'}
  }
  const baseToday=renderToday;renderToday=function(){baseToday();renderBookControls()};
  const baseBank=renderBank;renderBank=function(){renderBookControls();baseBank()};
  renderBookControls();
  function updateActiveBook(id){
    if(id!=='starter'&&(!store.books[id]||store.books[id].deletedAt))return;
    if(id===store.settings.activeBook)return;
    markLocalChange();store.settings.activeBook=id;
    store.sync.settingsUpdatedAt=nextSettingsUpdatedAt(store.sync.settingsUpdatedAt);
    const current=day();current.newIds=current.newIds.filter(wordId=>current.doneIds.includes(wordId));
    ensure(store,true);save();renderToday();renderBank();queueSync();
  }
  select.onchange=()=>updateActiveBook(select.value);
  function showPanel(which){
    manage.classList.toggle('hidden',which!=='manage');importPanel.classList.toggle('hidden',which!=='import');
    document.querySelector('#bankBrowse').classList.toggle('hidden',!!which);
    document.querySelector('#showBookManage').setAttribute('aria-expanded',String(which==='manage'));
    document.querySelector('#showBookImport').setAttribute('aria-expanded',String(which==='import'));
  }
  document.querySelector('#showBookManage').onclick=()=>showPanel(manage.classList.contains('hidden')?'manage':null);
  document.querySelector('#showBookImport').onclick=()=>showPanel(importPanel.classList.contains('hidden')?'import':null);
  document.querySelector('#createBook').onclick=()=>{
    const field=document.querySelector('#newBookName');
    const name=field.value.trim().replace(/\s+/g,' ');
    if(!name){report('请填写词库名称。',true,'#bookManageStatus');return}
    if(activeBooks().some(([,book])=>book.name.toLocaleLowerCase()===name.toLocaleLowerCase())){
      report('已有同名词库，请换一个名称。',true,'#bookManageStatus');return;
    }
    const id=`book-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    markLocalChange();store.books[id]={id,name:name.slice(0,60),updatedAt:nowIso(),words:[]};
    store.settings.activeBook=id;store.sync.settingsUpdatedAt=nextSettingsUpdatedAt(store.sync.settingsUpdatedAt);
    const current=day();current.newIds=current.newIds.filter(wordId=>current.doneIds.includes(wordId));
    ensure(store,true);save();renderToday();renderBank();queueSync();field.value='';
    report(`已增加“${name}”。可切换到“录入单词”添加内容。`,false,'#bookManageStatus');
  };
  function deleteBook(id){
    const book=store.books[id];if(!book||book.deletedAt)return;
    if(!globalThis.confirm(`确定删除词库“${book.name}”？已学过的单词及复习记录会保留。`))return;
    markLocalChange();book.deletedAt=nextSettingsUpdatedAt(book.updatedAt);book.updatedAt=book.deletedAt;
    if(store.settings.activeBook===id){
      store.settings.activeBook='starter';store.sync.settingsUpdatedAt=nextSettingsUpdatedAt(store.sync.settingsUpdatedAt);
      const current=day();current.newIds=current.newIds.filter(wordId=>current.doneIds.includes(wordId));
    }
    ensure(store,true);save();renderToday();renderBank();queueSync();
    report(`已删除“${book.name}”，已学单词和复习记录仍会保留。`,false,'#bookManageStatus');
  }
  const normalizeLines=value=>value.split(/\r?\n/).map(line=>line.trim().replace(/^(?:\d{1,4}[.)、:]\s*|[•*]\s*)/,'').trim()).filter(Boolean);
  const validWord=word=>word.length<=120&&/^[A-Za-z][A-Za-z'’ ()./-]*$/.test(word);
  const newWordId=()=>{
    let id;do{
      const random=new Uint32Array(2);
      if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(random);
      else{random[0]=Math.floor(Math.random()*4294967296);random[1]=Math.floor(Math.random()*4294967296)}
      id=1000000+random[0]*1048576+(random[1]&1048575);
    }while(allWordIds(store).includes(id));return id;
  };
  function importWords(input){
    const book=store.books[store.settings.activeBook];
    if(!book||book.deletedAt){report('请先在“管理词库”中增加并选择一个词库。',true);return}
    const lines=normalizeLines(input.value);
    if(!lines.length){report('请先输入至少一个英文词或短语。',true);return}
    const invalid=lines.find(word=>!validWord(word));
    if(invalid){report(`请检查第 ${lines.indexOf(invalid)+1} 行“${invalid}”：仅导入英文词或短语，一行一个。`,true);return}
    const globalWords=new Map(allWordIds(store).map(id=>[norm(wordFor(store,id)),id]));
    const existing=new Set(book.words.map(item=>norm(item.text)));
    let added=0,skipped=0,reused=0;
    for(const text of lines){
      const key=norm(text);if(!key||existing.has(key)){skipped++;continue}
      const id=globalWords.get(key)??newWordId();
      if(globalWords.has(key))reused++;
      book.words.push({id,text});globalWords.set(key,id);existing.add(key);added++;
    }
    if(added){
      markLocalChange();book.updatedAt=nextSettingsUpdatedAt(book.updatedAt);
      ensure(store,true);save();renderToday();renderBank();queueSync();
    }
    input.value='';if(input===ocrInput)document.querySelector('#ocrReview').classList.add('hidden');
    report(`已导入 ${added} 个，跳过重复 ${skipped} 个。${reused?`其中 ${reused} 个沿用已有词的复习进度。`:''}`);
  }
  document.querySelector('#saveImportedWords').onclick=()=>importWords(manualInput);
  document.querySelector('#saveScannedWords').onclick=()=>importWords(ocrInput);
  let chosenImage=null,ocrLoading;
  for(const id of ['#wordImage','#cameraImage']){
    document.querySelector(id).onchange=event=>{
      chosenImage=event.target.files?.[0]||null;
      document.querySelector('#imageName').textContent=chosenImage?`已选择：${chosenImage.name}`:'尚未选择图片';
      document.querySelector('#ocrReview').classList.add('hidden');ocrInput.value='';
      document.querySelector(id==='#wordImage'?'#cameraImage':'#wordImage').value='';
    };
  }
  function loadOcr(){
    if(globalThis.Tesseract)return Promise.resolve(globalThis.Tesseract);
    if(!ocrLoading)ocrLoading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      script.onload=()=>globalThis.Tesseract?resolve(globalThis.Tesseract):reject(new Error('识别组件未加载'));
      script.onerror=()=>reject(new Error('无法下载识别组件，请检查网络'));document.head.append(script);
    }).catch(error=>{ocrLoading=null;throw error});return ocrLoading;
  }
  document.querySelector('#scanImage').onclick=async()=>{
    if(!chosenImage){report('请先从图片库、文件或摄像机选择一张单词表图片。',true);return}
    if(!chosenImage.type.startsWith('image/')){report('请选择图片文件。',true);return}
    if(chosenImage.size>20*1024*1024){report('图片超过 20 MB，请压缩或裁切后再试。',true);return}
    const button=document.querySelector('#scanImage');button.disabled=true;report('正在识别图片，首次使用需要下载英文识别数据…');
    let worker;
    try{
      const engine=await loadOcr();
      worker=await engine.createWorker('eng',1,{logger:message=>{
        if(message.status==='recognizing text')report(`正在识别图片：${Math.round((message.progress||0)*100)}%`);
      }});
      const result=await worker.recognize(chosenImage);
      const lines=normalizeLines(result.data.text||'');ocrInput.value=lines.join('\n');
      document.querySelector('#ocrReview').classList.remove('hidden');
      report(`识别出 ${lines.length} 行。请逐行核对文本，再点击“核对后确认导入”。`);
    }catch(error){report(`图片识别失败：${error.message}。仍可手动录入。`,true)}
    finally{try{if(worker)await worker.terminate()}catch{}button.disabled=false}
  };
})();
