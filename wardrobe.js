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
    const skin='#ffd8bf',hair='#604063',shadowHair='#50365a',top=color('top','#f8d8ec'),pants=color('pants','#a49bd5');
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
    const bottom=s.wear.pants,skirt=bottom==='pleats'||bottom==='bubble';
    const bareLower=skirt||bottom==='shorts';
    for(const d of [-1,1]){
      shape(d*77,139,-28,29,60,27,shadowHair);
      shape(d*83,176,-28,22,46,23,hair);shape(d*85,113,-24,18,12,20,'#c48cbb');
      shape(d*23,329,0,19,44,21,bareLower?skin:pants);
      if(bottom==='shorts')shape(d*23,307,2,23,26,25,pants);
      if(bottom==='denim')shape(d*23,352,4,21,8,23,'#98b5db');
      shape(d*24,373,13,24,15,31,'#f3eafb');shape(d*24,376,31,20,8,14,'#dcadd6');
      shape(d*51,263,4,13,31,14,skin);shape(d*53,246,3,17,s.wear.top==='hoodie'?40:24,19,top);
    }
    if(skirt){
      shape(0,308,0,bottom==='pleats'?55:50,bottom==='pleats'?30:33,38,pants);
      if(bottom==='pleats')for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        line([[32*Math.cos(a),294,24*Math.sin(a)],[54*Math.cos(a),312,38*Math.sin(a)],[43*Math.cos(a),328,31*Math.sin(a)]],'#b96591',1.6);
      }
    }
    shape(0,266,0,43,47,29,top);shape(0,224,0,19,20,19,skin);
    shape(0,235,22,22,10,10,'#fff4fb');shape(0,259,28,5,5,4,'#e09bc3');
    if(s.wear.top==='hoodie'){shape(0,236,-17,33,26,23,top);shape(0,278,27,22,9,5,'#b5bee8')}
    if(s.wear.top==='sailor'){shape(0,239,21,31,11,11,'#71628b');shape(0,252,29,8,13,5,'#d36984')}
    shape(0,134,-17,85,95,68,hair);shape(0,148,10,75,76,64,skin);
    shape(-24,79,36,49,28,41,hair);shape(25,83,34,44,24,40,hair);
    shape(-43,103,44,27,23,33,hair);shape(43,104,35,27,25,35,hair);
    for(const d of [-1,1]){
      shape(d*28,149,69,17,21,8,'#4a294e');
      shape(d*28,151,74,13,17,6,'#fff6fb');
      shape(d*28,151,79,10,15,4,'#915b9b');
      shape(d*28,148,82,6,10,2,'#4c304f');
      shape(d*28-4,143,84,4,5,2,'#ffffff');shape(d*28+4,156,84,2,2,1,'#ffffff');
      shape(d*31,127,69,12,2,3,hair);
      shape(d*46,173,61,12,6,3,'#ffaeb8');
    }
    shape(0,169,74,5,5,4,skin);shape(0,185,68,8,4,3,'#bd6b86');
    const head=color('head',null);
    if(head&&s.wear.head.startsWith('clip')){
      line([[38,89,68],[63,102,58]],head,8);
      shape(40,90,68,6,6,4,head);
    }else if(head){shape(32,49,40,18,12,10,head);shape(61,44,40,18,12,10,head);shape(47,48,48,8,8,8,head)}
    const glasses=color('glasses',null);
    if(glasses){
      for(const d of [-1,1]){
        const count=s.wear.glasses==='square'?4:s.wear.glasses==='star'?10:24;
        const points=Array.from({length:count+1},(_,i)=>{
          const a=i*2*Math.PI/count-(count===4?Math.PI/4:Math.PI/2);
          const radius=count===4?28:count===10&&i%2?15:24;
          return [d*28+radius*Math.cos(a),151+radius*Math.sin(a),88];
        });
        // Draw each 3D edge separately for correct occlusion when seen from behind.
        for(let i=1;i<points.length;i++)line([points[i-1],points[i]],glasses,3.8);
        line([[d*50,149,88],[d*72,149,18]],glasses,3.5);
      }
      line([[-8,151,88],[0,148,89],[8,151,88]],glasses,3);
    }
    ctx.clearRect(0,0,480,480);
    ctx.fillStyle='#96799a35';ctx.beginPath();ctx.ellipse(240,409,97,14,0,0,Math.PI*2);ctx.fill();
    faces.sort((a,b)=>a.z-b.z);
    for(const {p,fill,width} of faces){
      ctx.beginPath();p.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](240+x*1.10,14+y));
      if(width){ctx.strokeStyle=fill;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();continue}
      ctx.closePath();ctx.fillStyle=ctx.strokeStyle=fill;ctx.lineWidth=.8;ctx.fill();ctx.stroke();
    }
  }
  render();
})();
