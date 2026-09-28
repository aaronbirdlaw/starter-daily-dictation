(function setupWordbooks(){
  const select=document.querySelector('#bookSelect');
  const panel=document.querySelector('#bookImport');
  const input=document.querySelector('#importWords');
  const status=document.querySelector('#bookImportStatus');
  const bookName=id=>id==='starter'?'Starter 词库':store.books[id]?.name||'新词书';
  const report=(message,error=false)=>{status.textContent=message;status.classList.toggle('error',error)};

  function renderBookControls(){
    const selected=store.settings.activeBook||'starter';
    select.replaceChildren();
    for(const id of ['starter',...Object.keys(store.books||{})]){
      const option=document.createElement('option');option.value=id;option.textContent=bookName(id);select.append(option);
    }
    select.value=selected;
    document.querySelector('#bookTitle').textContent=bookName(selected);
    document.querySelector('#wordTotal').textContent=bookIds(store).length;
    document.querySelector('#saveImportedWords').disabled=selected==='starter';
    const route=document.querySelector('#learningTrack');
    if(route){route.disabled=selected!=='starter';route.parentElement.querySelector('.track-hint').textContent=selected==='starter'?'主题内的新词会优先进入听写；已开始学习的词仍按原有记忆曲线复习。':'主题优先只适用于 Starter；当前新词来自选中的新词书。'}
    if(selected==='starter'&&!panel.classList.contains('hidden'))report('先创建并选择一本新词书，再导入单词。');
  }

  const baseToday=renderToday;
  renderToday=function(){baseToday();renderBookControls()};
  const baseBank=renderBank;
  renderBank=function(){renderBookControls();baseBank()};
  renderBookControls();

  select.onchange=()=>{
    const id=select.value;
    if(id!=='starter'&&!store.books[id])return;
    if(id===store.settings.activeBook)return;
    markLocalChange();
    store.settings.activeBook=id;
    store.sync.settingsUpdatedAt=nextSettingsUpdatedAt(store.sync.settingsUpdatedAt);
    const current=day();
    current.newIds=current.newIds.filter(wordId=>current.doneIds.includes(wordId));
    ensure(store,true);save();renderToday();renderBank();queueSync();
    report(id==='starter'?'已切回 Starter。':'已切换到新词书。原有学习记录和到期复习继续保留。');
  };
  document.querySelector('#showBookImport').onclick=()=>panel.classList.toggle('hidden');
  document.querySelector('#createBook').onclick=()=>{
    const name=document.querySelector('#newBookName').value.trim().replace(/\s+/g,' ');
    if(!name){report('请先填写词书名称。',true);return}
    const id=`book-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    markLocalChange();
    store.books[id]={id,name:name.slice(0,60),updatedAt:nowIso(),words:[]};
    store.settings.activeBook=id;
    store.sync.settingsUpdatedAt=nextSettingsUpdatedAt(store.sync.settingsUpdatedAt);
    const current=day();current.newIds=current.newIds.filter(wordId=>current.doneIds.includes(wordId));
    ensure(store,true);save();renderToday();renderBank();queueSync();
    document.querySelector('#newBookName').value='';
    report(`已创建“${name}”。现在可以粘贴单词或扫描图片。`);
  };

  const normalizeLines=value=>value.split(/\r?\n/).map(line=>line.trim().replace(/^(?:\d{1,4}[.)、:]\s*|[•*]\s*)/,'').trim()).filter(Boolean);
  const validWord=word=>word.length<=120&&/^[A-Za-z][A-Za-z'’ ()./-]*$/.test(word);
  const newWordId=()=>{
    let id;
    do{
      const random=new Uint32Array(2);
      if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(random);
      else{random[0]=Math.floor(Math.random()*4294967296);random[1]=Math.floor(Math.random()*4294967296)}
      id=1000000+random[0]*1048576+(random[1]&1048575);
    }while(allWordIds(store).includes(id));
    return id;
  };
  document.querySelector('#saveImportedWords').onclick=()=>{
    const book=store.books[store.settings.activeBook];
    if(!book){report('请先创建并选择新词书。',true);return}
    const lines=normalizeLines(input.value);
    if(!lines.length){report('请先输入至少一个英文词或短语。',true);return}
    const invalid=lines.filter(word=>!validWord(word));
    if(invalid.length){report(`请检查第 ${lines.findIndex(word=>!validWord(word))+1} 行“${invalid[0]}”：仅导入英文词或短语，一行一个。`,true);return}
    const globalWords=new Map(allWordIds(store).map(id=>[norm(wordFor(store,id)),id]));
    const existing=new Set(book.words.map(item=>norm(item.text)));
    let added=0,skipped=0,reused=0;
    markLocalChange();
    for(const text of lines){
      const key=norm(text);
      if(!key||existing.has(key)){skipped++;continue}
      const id=globalWords.get(key)??newWordId();
      if(globalWords.has(key))reused++;
      book.words.push({id,text});
      globalWords.set(key,id);existing.add(key);added++;
    }
    book.updatedAt=nowIso();
    ensure(store,true);save();renderToday();renderBank();queueSync();
    input.value='';
    report(`已导入 ${added} 个，跳过重复 ${skipped} 个。${reused?`其中 ${reused} 个沿用已有词的复习进度。`:''}`);
  };

  let ocrLoading;
  function loadOcr(){
    if(globalThis.Tesseract)return Promise.resolve(globalThis.Tesseract);
    if(!ocrLoading)ocrLoading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      script.onload=()=>globalThis.Tesseract?resolve(globalThis.Tesseract):reject(new Error('识别组件未加载'));
      script.onerror=()=>reject(new Error('无法下载识别组件，请检查网络'));
      document.head.append(script);
    }).catch(error=>{ocrLoading=null;throw error});
    return ocrLoading;
  }
  document.querySelector('#scanImage').onclick=async()=>{
    const file=document.querySelector('#wordImage').files?.[0];
    if(!file){report('请先选择或拍摄一张单词表图片。',true);return}
    if(!file.type.startsWith('image/')){report('请选择图片文件。',true);return}
    if(file.size>20*1024*1024){report('图片超过 20 MB，请压缩或裁切后再试。',true);return}
    const button=document.querySelector('#scanImage');button.disabled=true;report('正在识别图片，首次使用需要下载英文识别数据…');
    let worker;
    try{
      const engine=await loadOcr();
      worker=await engine.createWorker('eng',1,{logger:message=>{
        if(message.status==='recognizing text')report(`正在识别图片：${Math.round((message.progress||0)*100)}%`);
      }});
      const result=await worker.recognize(file);
      const lines=normalizeLines(result.data.text||'');
      input.value=[input.value.trim(),...lines].filter(Boolean).join('\n');
      report(`识别出 ${lines.length} 行。请逐行删掉页码、释义或误识别文字，确认后点击“核对后导入”。`);
    }catch(error){report(`图片识别失败：${error.message}。仍可手动录入。`,true)}
    finally{try{if(worker)await worker.terminate()}catch{}button.disabled=false}
  };
})();
