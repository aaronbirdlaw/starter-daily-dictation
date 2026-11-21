(function(){
  const panel=document.querySelector('#wardrobe');
  const key='starter-reward-wardrobe-v1';
  const categories={top:'上衣',pants:'裤子',head:'头饰'};
  const items=[
    ['peach','top','蜜桃上衣',5,'#ee8799'],['mint','top','薄荷上衣',10,'#72bd9f'],
    ['denim','pants','蓝莓长裤',5,'#648ac4'],['plum','pants','葡萄长裤',10,'#9778be'],
    ['bow','head','樱桃蝴蝶结',5,'#df6589'],['gold','head','金色蝴蝶结',10,'#f0b749']
  ];
  function read(){
    try{return JSON.parse(localStorage.getItem(key))||{days:[],owned:[],wear:{}}}
    catch{return {days:[],owned:[],wear:{}}}
  }
  const balance=s=>s.days.length*5-items.reduce((n,[id,,,price])=>n+(s.owned.includes(id)?price:0),0);
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
  let angle=-.18,pointer=null;
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
    const skin='#f1b487',hair='#483043',top=color('top','#f3e7ab'),pants=color('pants','#65958c');
    const faces=[],cos=Math.cos(angle),sin=Math.sin(angle);
    const project=([x,y,z])=>[x*cos+z*sin,y,z*cos-x*sin];
    function shape(x,y,z,rx,ry,rz,hex){
      const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16));
      const point=(a,b)=>project([x+rx*Math.sin(a)*Math.cos(b),y+ry*Math.cos(a),z+rz*Math.sin(a)*Math.sin(b)]);
      for(let i=0;i<12;i++)for(let j=0;j<20;j++){
        const a=i*Math.PI/12,b=j*Math.PI/10,da=Math.PI/12,db=Math.PI/10;
        const p=[point(a,b),point(a+da,b),point(a+da,b+db),point(a,b+db)];
        const [nx,ny,nz]=project([Math.sin(a+da/2)*Math.cos(b+db/2)/rx,Math.cos(a+da/2)/ry,Math.sin(a+da/2)*Math.sin(b+db/2)/rz]);
        if(nz<=0)continue;
        const light=.80+.19*(nz-.4*nx-.7*ny)/Math.hypot(nx,ny,nz);
        faces.push({p,z:p.reduce((v,q)=>v+q[2],0)/4,fill:'rgb('+rgb.map(v=>Math.min(255,Math.round(v*light))).join(',')+')'});
      }
    }
    for(const d of [-1,1]){
      shape(d*66,113,-25,29,45,29,hair);shape(d*28,321,0,26,64,26,pants);
      shape(d*28,386,12,29,17,37,'#f7e8d8');shape(d*63,245,0,14,41,16,skin);
      shape(d*57,219,0,24,27,25,top);
    }
    shape(0,248,0,53,62,32,top);shape(0,194,0,18,24,19,skin);
    shape(0,121,-19,76,84,63,hair);shape(0,126,10,64,69,58,skin);
    shape(-23,70,34,47,25,33,hair);shape(24,74,21,42,25,34,hair);
    for(const d of [-1,1]){
      shape(d*23,126,64,7,9,5,'#362739');shape(d*24-2,123,68,2,2,1,'#ffffff');
      shape(d*37,143,59,10,5,3,'#ed8e94');
    }
    shape(0,143,67,7,6,6,skin);shape(0,159,62,10,4,3,'#ac5364');
    const head=color('head',null);
    if(head){shape(32,49,40,18,12,10,head);shape(61,44,40,18,12,10,head);shape(47,48,48,8,8,8,head)}
    ctx.clearRect(0,0,480,480);
    ctx.fillStyle='#96799a35';ctx.beginPath();ctx.ellipse(240,421,114,17,0,0,Math.PI*2);ctx.fill();
    faces.sort((a,b)=>a.z-b.z);
    for(const {p,fill} of faces){
      ctx.beginPath();p.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](240+x*1.10,14+y));
      ctx.closePath();ctx.fillStyle=ctx.strokeStyle=fill;ctx.lineWidth=.8;ctx.fill();ctx.stroke();
    }
  }
  render();
})();
