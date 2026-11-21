(function(){
  const panel=document.querySelector('#wardrobe');
  const key='starter-reward-wardrobe-v1';
  const categories={top:'上衣',pants:'裤子与裙子',head:'头饰与发夹',glasses:'眼镜'};
  const items=[
    ['peach','top','蜜桃上衣',5,'#ee8799'],['mint','top','薄荷上衣',10,'#72bd9f'],
    ['denim','pants','蓝莓长裤',5,'#648ac4'],['plum','pants','葡萄长裤',10,'#9778be'],
    ['bow','head','樱桃蝴蝶结',5,'#df6589'],['gold','head','金色蝴蝶结',10,'#f0b749'],
    ['hoodie','top','蓝莓连帽衫',5,'#8d9cdb'],['sailor','top','奶油水手衫',5,'#fff0d3'],
    ['shorts','pants','珊瑚短裤',5,'#e99290'],['pleats','pants','樱花百褶裙',5,'#e68bb0'],['bubble','pants','薄荷泡泡裙',5,'#87cbb1'],
    ['clipPink','head','草莓粉发夹',5,'#f582a6'],['clipBlue','head','天空蓝发夹',5,'#79c7ed'],['clipYellow','head','柠檬黄发夹',5,'#ffdb69'],
    ['round','glasses','紫色圆框',5,'#8558b2'],['square','glasses','蓝色方框',5,'#5078a4'],['star','glasses','粉色星星框',5,'#d8689d']
  ];
  function read(){
    try{return JSON.parse(localStorage.getItem(key))||{days:[],owned:[],wear:{}}}
    catch{return {days:[],owned:[],wear:{}}}
  }
  const testCredit=/^(?:feature-reward-wardrobe|[a-f0-9]{8})\.starter-daily-dictation\.pages\.dev$/.test(location.hostname)||['localhost','127.0.0.1'].includes(location.hostname)?100:0;
  document.querySelector('#reward-test-note').hidden=!testCredit;
  const balance=s=>testCredit+s.days.length*5-items.reduce((n,[id,,,price])=>n+(s.owned.includes(id)?price:0),0);
  document.querySelector('#reward-redeem').onclick=()=>{
    const shop=document.querySelector('#reward-shop');
    shop.focus({preventScroll:true});
    shop.scrollIntoView?.({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  const message=value=>{document.querySelector('#reward-message').textContent=value};
  function saveRewards(s){try{localStorage.setItem(key,JSON.stringify(s));return true}catch{message('积分暂时无法保存，请检查浏览器存储。');return false}}
  const complete=completeWord;
  completeWord=function(id,...args){
    const date=localDate(),before=day();
    const pending=before&&!before.completed&&ids().includes(id)&&!before.doneIds.includes(id);
    complete(id,...args);
    if(!pending||!day()?.completed||date!==localDate())return;
    const s=read();
    if(s.days.includes(date))return;
    s.days.push(date);if(saveRewards(s)){render();message('今日完成！获得 5 积分。')}
  };
  function render(){
    const s=read(),points=balance(s);
    document.querySelector('#reward-points').textContent=points+' 积分';
    document.querySelector('#reward-shop').innerHTML=Object.entries(categories).map(([group,label])=>
      `<section><h3>${label}</h3><div class="wardrobe-options">${items.filter(item=>item[1]===group).map(([id,,name,price,color])=>{
        const owned=s.owned.includes(id),wearing=s.wear[group]===id;
        return `<button type="button" data-outfit="${id}" ${!owned&&points<price?'disabled':''}><i style="background:${color}"></i><strong>${name}</strong><small>${wearing?'穿戴中 · 点击换回基础款':owned?'已拥有 · 穿戴':price+' 积分兑换'}</small></button>`;
      }).join('')}</div></section>`).join('');
    if(panel.open)draw();
  }
  panel.addEventListener('click',event=>{
    const button=event.target.closest('[data-outfit],[data-turn]');if(!button)return;
    if(button.dataset.turn){angle+=Number(button.dataset.turn)*Math.PI/180;draw();return}
    const item=items.find(x=>x[0]===button.dataset.outfit);if(!item)return;
    const [id,group,name,price]=item,s=read(),owned=s.owned.includes(id);
    if(!owned&&balance(s)<price)return;
    if(!owned)s.owned.push(id);
    s.wear[group]=s.wear[group]===id?null:id;
    if(saveRewards(s)){render();message(owned?(s.wear[group]?'已穿戴：'+name:'已换回基础款'):'兑换成功：'+name)}
  });
  window.addEventListener('storage',event=>{if(event.key===key)render()});
  const canvas=document.querySelector('#reward-avatar');
  let angle=-.09,pointer=null;
  panel.addEventListener('toggle',()=>{if(panel.open)draw()});
  canvas.addEventListener('pointerdown',event=>{pointer={id:event.pointerId,x:event.clientX};canvas.setPointerCapture(event.pointerId)});
  canvas.addEventListener('pointermove',event=>{
    if(pointer?.id!==event.pointerId)return;
    angle+=(event.clientX-pointer.x)*.017;pointer.x=event.clientX;draw();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{pointer=null});
  // True 3D geometry: project lit ellipsoid meshes, rotating every garment with the character.
  function draw(){
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const s=read(),color=(group,fallback)=>items.find(x=>x[0]===s.wear[group])?.[4]||fallback;
    const skin='#ffddc5',hair='#42312a',shadowHair='#352722',top=color('top','#29292d'),pants=color('pants','#494543');
    const faces=[],cos=Math.cos(angle),sin=Math.sin(angle);
    const project=([x,y,z])=>[x*cos+z*sin,y,z*cos-x*sin];
    function line(points,fill,width){
      const p=points.map(project);
      faces.push({p,z:p.reduce((v,q)=>v+q[2],0)/p.length,fill,width});
    }
    function shape(x,y,z,rx,ry,rz,hex){
      const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16));
      const point=(a,b)=>project([x+rx*Math.sin(a)*Math.cos(b),y+ry*Math.cos(a),z+rz*Math.sin(a)*Math.sin(b)]);
      for(let i=0;i<18;i++)for(let j=0;j<28;j++){
        const da=Math.PI/18,db=Math.PI/14,a=i*da,b=j*db;
        const p=[point(a,b),point(a+da,b),point(a+da,b+db),point(a,b+db)];
        const [nx,ny,nz]=project([Math.sin(a+da/2)*Math.cos(b+db/2)/rx,Math.cos(a+da/2)/ry,Math.sin(a+da/2)*Math.sin(b+db/2)/rz]);
        if(nz<=0)continue;
        const light=.85+.17*(nz-.4*nx-.7*ny)/Math.hypot(nx,ny,nz);
        faces.push({p,z:p.reduce((v,q)=>v+q[2],0)/4,fill:'rgb('+rgb.map(v=>Math.min(255,Math.round(v*light))).join(',')+')'});
      }
    }
    // Model the reference's long waves using tapered, continuous 3D locks.
    function lock(rows,hex){
      const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16));
      const lerp=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
      const ring=(row,a)=>project([row[0]+row[3]*Math.cos(a),row[1],row[2]+row[4]*Math.sin(a)]);
      for(let i=1;i<rows.length;i++)for(let step=0;step<4;step++){
        const from=lerp(rows[i-1],rows[i],step/4),to=lerp(rows[i-1],rows[i],(step+1)/4);
        for(let j=0;j<24;j++){
          const a=j*Math.PI/12,b=a+Math.PI/12,m=(a+b)/2;
          const [nx,,nz]=project([Math.cos(m),0,Math.sin(m)]);
          if(nz<=0)continue;
          const p=[ring(from,a),ring(from,b),ring(to,b),ring(to,a)];
          const light=.83+.19*(nz-.45*nx);
          faces.push({p,z:p.reduce((v,q)=>v+q[2],0)/4,fill:'rgb('+rgb.map(v=>Math.min(255,Math.round(v*light))).join(',')+')'});
        }
      }
    }
    const bottom=s.wear.pants,skirt=!bottom||bottom==='pleats'||bottom==='bubble';
    const baseTop=!s.wear.top;
    for(const d of [-1,1]){
      lock([[d*61,110,-20,23,35],[d*65,172,-30,19,30],[d*70,221,-31,17,23],[d*61,259,-37,13,17],[d*66,283,-38,2,3]],hair);
      for(let k=0;k<3;k++){
        const x=d*(12+k*18),z=-62+k*4,y=292-k*5+d*4;
        lock([[x,117,z,18,17],[x+d*7,179,z,17,19],[x-d*3,222,z-4,16,19],[x+d*4,262,z-8,14,14],[x+d*1,y,z-6,2,3]],k%2?hair:shadowHair);
      }
      lock([[d*55,111,24,17,26],[d*66,163,20,13,17],[d*57,207,26,12,12],[d*47,241,29,8,9],[d*52,254,32,1,2]],'#49362c');
      lock([[d*23,316,0,17,18],[d*23,358,1,15,16],[d*24,391,0,13,15],[d*24,430,0,9,10]],!bottom?'#393130':skirt||bottom==='shorts'?skin:pants);
      if(bottom==='shorts')shape(d*23,333,2,21,26,22,pants);
      if(bottom==='denim')shape(d*24,416,3,12,7,14,'#98b5db');
      shape(d*24,434,11,16,12,28,'#5d4033');shape(d*24,440,12,17,6,29,'#3c2a24');
      shape(d*24,430,27,13,4,8,'#795744');
      shape(d*70,316,5,10,14,9,skin);
      if(baseTop||s.wear.top==='hoodie'){
        lock([[d*42,220,0,12,19],[d*49,243,0,17,19],[d*59,270,1,16,17],[d*69,301,4,12,13],[d*70,307,4,10,10]],top);
        shape(d*70,303,4,12,8,12,top);
      }else{shape(d*56,271,4,12,31,12,skin);shape(d*47,237,3,16,21,18,top)}
    }
    if(!skirt)shape(0,314,0,39,23,24,pants);
    if(skirt){
      if(bottom==='bubble')shape(0,327,0,47,35,32,pants);
      else lock([[0,290,0,35,24],[0,321,0,43,28],[0,354,0,49,32],[0,355,0,46,31]],pants);
      if(bottom!=='bubble')for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        line([[40*Math.cos(a),307,27*Math.sin(a)],[49*Math.cos(a),351,33*Math.sin(a)]],bottom?'#b96591':'#3e3a39',1.3);
      }
    }
    lock([[0,207,0,18,15],[0,222,0,43,25],[0,253,0,36,26],[0,291,0,41,26],[0,301,0,40,25]],top);
    shape(0,205,0,16,18,17,skin);
    if(baseTop)lock([[0,198,0,19,18],[0,212,0,20,18],[0,219,0,23,21]],'#252428');
    else if(s.wear.top!=='sailor')shape(0,224,20,21,8,8,'#fff4fb');
    if(s.wear.top==='hoodie'){shape(0,236,-17,33,26,23,top);shape(0,278,27,22,9,5,'#b5bee8')}
    if(s.wear.top==='sailor'){shape(0,239,21,31,11,11,'#71628b');shape(0,252,29,8,13,5,'#d36984')}
    shape(0,118,-13,72,80,66,hair);shape(0,134,9,62,65,56,skin);
    for(const d of [-1,1])shape(d*59,140,14,10,14,11,skin);
    shape(-23,79,34,42,24,31,hair);shape(25,81,31,34,24,30,hair);
    lock([[12,63,47,16,17],[0,84,58,23,13],[-22,104,51,22,12],[-43,121,40,2,3]],hair);
    lock([[19,64,42,15,16],[35,87,51,17,12],[51,109,41,15,12],[60,132,30,2,3]],'#49372d');
    for(const d of [-1,1]){
      shape(d*23,133,60,14,13,6,'#493127');
      shape(d*23,136,64,13,11,5,'#fff8ec');
      shape(d*23,135,68,9,10,3,'#956346');
      shape(d*23,134,70,5,7,2,'#4a3128');
      shape(d*23-3,131,71,3,3,1.5,'#ffffff');shape(d*23+3,139,72,1.5,1.5,1,'#ffffff');
      shape(d*25,116,61,10,1.8,2,hair);
      shape(d*37,153,56,9,4,2,'#f5afa2');
    }
    shape(0,148,66,4,4,5,skin);
    line([[-7,165,60],[0,167,62],[7,165,60]],'#a96759',1.5);
    const head=color('head',null);
    if(head&&s.wear.head.startsWith('clip')){
      line([[36,85,66],[54,98,52]],head,7);
      shape(38,87,66,5,5,4,head);
    }else if(head){shape(32,49,40,18,12,10,head);shape(61,44,40,18,12,10,head);shape(47,48,48,8,8,8,head)}
    const glasses=color('glasses','#967b67'),frameWidth=s.wear.glasses?3.8:1.6;
    if(glasses){
      for(const d of [-1,1]){
        const count=s.wear.glasses==='square'?4:s.wear.glasses==='star'?10:24;
        const points=Array.from({length:count+1},(_,i)=>{
          const a=i*2*Math.PI/count-(count===4?Math.PI/4:Math.PI/2);
          const radius=count===4?25:count===10&&i%2?12:19;
          const x=d*23+radius*Math.cos(a);
          return [x,135+radius*Math.sin(a),76-Math.abs(x)*.18];
        });
        // Draw each 3D edge separately for correct occlusion when seen from behind.
        for(let i=1;i<points.length;i++)line([points[i-1],points[i]],glasses,frameWidth);
        line([[d*42,133,68],[d*64,137,17]],glasses,frameWidth);
      }
      line([[-5,135,75],[0,132,76],[5,135,75]],glasses,frameWidth);
    }
    ctx.clearRect(0,0,480,480);
    ctx.fillStyle='#96799a35';ctx.beginPath();ctx.ellipse(240,462,85,11,0,0,Math.PI*2);ctx.fill();
    faces.sort((a,b)=>a.z-b.z);
    for(const {p,fill,width} of faces){
      ctx.beginPath();p.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](240+x*1.10,14+y));
      if(width){ctx.strokeStyle=fill;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();continue}
      ctx.closePath();ctx.fillStyle=ctx.strokeStyle=fill;ctx.lineWidth=.8;ctx.fill();ctx.stroke();
    }
  }
  render();
})();
