const colors={
  red:"#e9545d",pink:"#f584a7",yellow:"#ffdf78",
  green:"#80c873",blue:"#6fafe9",purple:"#c6a0e9"
};
const palettes={
  flower:colors,
  bird:{...colors,blue:"#84ceed"},
  house:{...colors,pink:"#f28290",yellow:"#eab86a",purple:"#b599d4"}
};
const wingColors={
  red:"#c43b46",pink:"#db6389",yellow:"#deb650",
  green:"#5b9f53",blue:"#64b8df",purple:"#a47ecb"
};
const defaultColors={bird:"blue",house:"pink"};
const colorStyles={
  flower:color=>"color:"+colors[color],
  bird:color=>"--bird-color:"+palettes.bird[color]+";--wing-color:"+wingColors[color],
  house:color=>"--roof-color:"+palettes.house[color]
};
const rewards=[
  {id:"flower",name:"Flower",goal:"Finish today’s practice",art:"plant",view:"-30 -61 60 66"},
  {id:"bird",name:"Bird",goal:"Every 3 practice days",art:"bluebird",view:"-32 -26 66 54",days:3},
  {id:"house",name:"House",goal:"Every 5 practice days",art:"cottage",view:"-43 -59 86 66",days:5}
];
const plantingSpots=[[65,225],[109,252],[154,219],[250,270],[310,223],[200,256],[344,252],[70,286],[130,305],[269,320],[193,315],[298,367],[83,353],[140,358],[229,364]];
const perches=[[102,94],[59,104],[139,113],[178,125]];
const lawns=[[324,168],[251,161],[367,189]];
const capacity={flower:plantingSpots.length,bird:perches.length,house:lawns.length};
const areas=[
  {name:"Blossom Hill",hues:["#bce9e7","#8dbb72","#cee781","#96bd58","#7eab4b","#ef9eb5"],detail:""},
  {name:"Sunny Meadow",hues:["#ffe3a9","#adcc7a","#e6ed9c","#adca69","#89b15b","#ffc267"],detail:'<path d="M12 219q13-10 31 1M342 220q16-10 42-1" fill="none" stroke="#91b75a" stroke-width="3" stroke-linecap="round"/><circle cx="33" cy="240" r="4" fill="#ffe5a2"/><circle cx="378" cy="266" r="4" fill="#ffe5a2"/>'},
  {name:"Lavender Hollow",hues:["#e4dbfa","#b0a2d2","#d3e4b2","#9db98c","#82aa7d","#bc99df"],detail:'<path d="M0 187q24 14 46 1m295 103q19 13 44 1" fill="none" stroke="#a18dbf" stroke-width="4" stroke-linecap="round"/><circle cx="27" cy="201" r="4" fill="#c6a5e2"/><circle cx="367" cy="306" r="5" fill="#c6a5e2"/>'},
  {name:"Pebble Brook",hues:["#b9dff4","#8bb9ac","#c6e5b5","#8abd91","#6ca982","#8fcb9b"],detail:'<path d="M0 330Q46 333 62 376T145 430H0Z" fill="#a7d9ec"/><path d="M6 347q22 0 36 14m-16 23q10 9 18 12" fill="none" stroke="#e0f5f7" stroke-width="4" stroke-linecap="round"/><ellipse cx="44" cy="343" rx="9" ry="5" fill="#a5b3a4"/>'}
];
const grass=[[34,190],[127,171],[190,177],[242,219],[368,195],[302,232],[49,262],[178,245],[371,272],[222,319],[57,327],[121,346],[315,326],[177,361],[248,383],[382,331]].map(([x,y])=>'<path d="M-5-5l4 5m2-1 4-5" transform="translate('+x+' '+y+')" stroke="#82ad51" stroke-width="2.8" stroke-linecap="round"/>').join("");
const key="audrey-dictation-garden-inventory-v1";
const completedKey="audrey-dictation-garden-eligible-v1";
function read(key,fallback){
  try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}
}
const load=()=>read(key,{flowers:[],bird:[],house:[],sound:true});
let state=load();
let completed=read(completedKey,[]);
const $=id=>document.getElementById(id);
let picking=null,busy=false,ctx,activeArea=0,pending=null;
function save(){localStorage.setItem(key,JSON.stringify(state))}
const nextFlower=()=>completed.find(day=>!state.flowers.some(flower=>flower.day===day));
function availability(item){
  return availableCount(item)>0?"ready":"locked";
}
function availableCount(item){
  if(item.id==="flower")return completed.filter(day=>!state.flowers.some(flower=>flower.day===day)).length;
  return Math.floor(completed.length/item.days)-state[item.id].length;
}
function rewardList(kind){return kind==="flower"?state.flowers:state[kind]}
function areaFor(kind,index){return Math.floor(index/capacity[kind])}
function areaCount(){
  const unlocked=Math.max(1,...rewards.map(({id})=>Math.ceil(rewardList(id).length/capacity[id])));
  return unlocked;
}
function spot(kind,index){
  const slot=index%capacity[kind];
  if(kind==="flower"){
    const [x,y]=plantingSpots[slot];
    return [x,y,.59+(y-185)/650];
  }
  if(kind==="bird")return [...perches[slot],slot<2?.71:.63];
  return [...lawns[slot],.86-slot*.058];
}
function areaName(index){
  return areas[index]?.name??"Garden Glade "+(index-areas.length+1);
}
function updateNavigation(){
  const count=areaCount();
  $("area-nav").hidden=count===1;
  $("area-name").textContent=areaName(activeArea);
  $("area-count").textContent=(activeArea+1)+" of "+count;
  $("previous-area").disabled=busy||activeArea===0;
  $("next-area").disabled=busy||activeArea===count-1;
}
function renderAreas(){
  const pages=$("garden-pages");
  const total=areaCount();
  while(pages.children.length<total){
    const index=pages.children.length;
    const scene=$("garden-scene").content.firstElementChild.cloneNode(true);
    const area=areas[index%areas.length];
    const selectors=[".sky",".distant-hills",".lawn",".shrub-light",".shrub-dark"];
    selectors.forEach((selector,i)=>scene.querySelector(selector).setAttribute("fill",area.hues[i]));
    scene.querySelector(".tree-blooms").style.color=area.hues[5];
    scene.querySelector(".terrain-details").innerHTML=area.detail;
    scene.querySelector(".grass").innerHTML=grass;
    pages.append(scene);
  }
  while(pages.children.length>total)pages.lastElementChild.remove();
  activeArea=Math.min(activeArea,total-1);
  pages.classList.toggle("is-busy",busy);
  for(let area=0;area<total;area++){
    const scene=pages.children[area];
    const items=kind=>{
      const item=rewards.find(reward=>reward.id===kind);
      const start=area*capacity[kind];
      return rewardList(kind).slice(start,start+capacity[kind]).map((reward,slot)=>{
        const index=start+slot;
        if(pending?.kind===kind&&pending.index===index)return "";
        const [x,y,size]=spot(kind,index);
        const color=kind==="flower"?reward.color:reward;
        return '<use style="'+colorStyles[kind](color)+'" href="#'+item.art+'" transform="translate('+x+' '+y+') scale('+size+')"/>';
      }).join("");
    };
    scene.querySelector(".planted").innerHTML=items("flower");
    scene.querySelector(".milestones").innerHTML=items("house")+items("bird");
    const birdCount=state.bird.length-(pending?.kind==="bird"?1:0);
    scene.querySelector(".side-branch").setAttribute("visibility",birdCount>area*capacity.bird+2?"visible":"hidden");
  }
  updateNavigation();
}
async function showArea(index,smooth){
  const pages=$("garden-pages");
  const target=pages.children[index];
  if(!target)return;
  const left=pages.scrollLeft+target.getBoundingClientRect().left-pages.getBoundingClientRect().left;
  pages.scrollTo({left,behavior:smooth?"smooth":"instant"});
  if(smooth){
    const deadline=performance.now()+650;
    while(Math.abs(pages.scrollLeft-left)>2&&performance.now()<deadline){
      await new Promise(requestAnimationFrame);
    }
    if(Math.abs(pages.scrollLeft-left)>2)pages.scrollTo({left,behavior:"instant"});
  }
  activeArea=index;
  updateNavigation();
}
function render(){
  // Each flower stores the practice date that earned it.
  const firstFlowerDay=state.flowers[0]?.day;
  const practiceDays=firstFlowerDay?new Set(completed.filter(day=>day>=firstFlowerDay)).size:0;
  $("practice-days").textContent=practiceDays===1?"1 practice day":practiceDays+" practice days";
  const flowers=state.flowers.length;
  $("flower-count").textContent=flowers===1?"1 flower has bloomed":flowers+" flowers have bloomed";
  $("sound").textContent=state.sound?"♪ Sound on":"♪ Sound off";
  $("sound").disabled=busy;
  $("sound").setAttribute("aria-pressed",state.sound);
  $("picker").hidden=!picking;
  $("rewards").hidden=Boolean(picking);
  $("rewards").innerHTML=rewards.map(item=>{
    const mode=availability(item);
    const badge=mode==="ready"?"✦":"🔒";
    const count=availableCount(item);
    const caption=mode==="ready"?(count>1?count+" to collect":"Choose a color"):item.goal;
    const color=item.id==="flower"?"pink":defaultColors[item.id];
    return '<button class="reward '+mode+'" data-reward="'+item.id+'" '+(mode==="locked"||busy?"disabled":"")+'><span class="badge" aria-hidden="true">'+badge+'</span><svg aria-hidden="true" viewBox="'+item.view+'" style="'+colorStyles[item.id](color)+'"><use href="#'+item.art+'"/></svg>'+item.name+'<small>'+caption+'</small></button>';
  }).join("");
  renderAreas();
}
function chime(kind){
  if(!state.sound)return;
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;
    ctx ||=new Audio();
    void ctx.resume().catch(()=>{});
    const notes={flower:[659,880,1047],bird:[1175,1397,1175],house:[523,659,784]}[kind];
    notes.forEach((frequency,i)=>{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime+i*.095;
      oscillator.type="sine";oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(.001,at);
      gain.gain.exponentialRampToValueAtTime(.11,at+.025);
      gain.gain.exponentialRampToValueAtTime(.001,at+.25);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(at);oscillator.stop(at+.26);
    });
  }catch{}
}
function pose(x,y,scale=1,turn=0){
  return `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${turn}deg) scale(${scale})`;
}
function centerOf(element){
  const rect=element.getBoundingClientRect();
  return [rect.left+rect.width/2,rect.top+rect.height/2];
}
function destination(kind,index,area){
  const [x,y,size]=spot(kind,index);
  const offset=kind==="flower"?34*size:kind==="house"?26*size:0;
  const scene=$("garden-pages").children[area];
  const point=new DOMPoint(x,y-offset).matrixTransform(scene.getScreenCTM());
  return [point.x,point.y,size];
}
function burst(x,y){
  const ring=document.createElement("span");
  ring.className="reward-ring";
  $("effects").append(ring);
  ring.animate([
    {transform:pose(x,y,.25),opacity:1},{transform:pose(x,y,2.6),opacity:0}
  ],{duration:560,easing:"ease-out",fill:"both"});
  for(let i=0;i<14;i++){
    const angle=i*Math.PI/7;
    const radius=i%2===0?121:85;
    const spark=document.createElementNS("http://www.w3.org/2000/svg","svg");
    spark.setAttribute("class","reward-spark");
    spark.setAttribute("viewBox","-12 -12 24 24");
    spark.innerHTML=i%3===0?'<circle r="4" fill="#ffb0ca"/>':'<use href="#star"/>';
    $("effects").append(spark);
    spark.animate([
      {transform:pose(x,y,.1),opacity:0},
      {transform:pose(x+Math.cos(angle)*radius*.58,y+Math.sin(angle)*radius*.58,1.15,i*24),opacity:1,offset:.28},
      {transform:pose(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius,.18,i*24+55),opacity:0}
    ],{duration:620,easing:"cubic-bezier(.11,.72,.32,1)",fill:"both"});
  }
}
async function animatePrize(kind,color,source,landing){
  const icon=document.createElementNS("http://www.w3.org/2000/svg","svg");
  icon.setAttribute("class","reward-flight");
  icon.setAttribute("viewBox","-44 -44 88 88");
  icon.setAttribute("style",colorStyles[kind](color));
  if(kind==="flower"){
    icon.innerHTML='<g class="flower-petals"></g><circle r="7.8" fill="#ffce4f" stroke="#d49742" stroke-width="1.3"/>';
  }else{
    icon.innerHTML=kind==="bird"?'<use href="#bluebird"/><use class="wing" href="#flying-wing"/>':'<use href="#cottage" y="26"/>';
  }
  $("effects").append(icon);
  const viewport=window.visualViewport;
  const x=(viewport?.offsetLeft??0)+(viewport?.width??innerWidth)/2;
  const y=(viewport?.offsetTop??0)+(viewport?.height??innerHeight)/2;
  const fly=(frames,duration,easing="ease-in-out")=>icon.animate(frames.map(transform=>({transform})),{duration,easing,fill:"forwards"}).finished;
  if(kind==="flower"){
    icon.querySelector(".flower-petals").innerHTML=Array.from({length:5},(_,i)=>
      `<g transform="rotate(${i*72})"><ellipse class="petal" cx="0" cy="-12" rx="10.5" ry="15" fill="currentColor" stroke="#944d51" stroke-width="1.5"/></g>`
    ).join("");
  }
  for(const petal of icon.querySelectorAll(".petal"))petal.style.transform="translateY(7px) scale(.53)";
  await fly([pose(...source,.25,-17),pose(x,y,1.09,8),pose(x,y,.94,0)],440,"cubic-bezier(.21,.63,.32,1)");
  burst(x,y);
  if(kind==="flower"){
    const petals=[...icon.querySelectorAll(".petal")];
    petals.forEach((petal,i)=>{
      petal.animate([{transform:"translateY(7px) scale(.53)"},{transform:"translateY(-8px) scale(1.12)"},{transform:"translateY(-5px) scale(1)"}],
        {duration:380,delay:i*46,fill:"both",easing:"ease-out"});
    });
  }
  await fly([pose(x,y,.94),pose(x,y,1.23,-7),pose(x,y,1,0)],640,"ease-out");
  const [endX,endY,size]=landing;
  if(kind==="bird"){
    const wing=icon.querySelector(".wing");
    wing.animate([{transform:"rotate(-30deg) scaleY(.55)"},{transform:"rotate(37deg) scaleY(1.2)"},{transform:"rotate(-30deg) scaleY(.55)"}],
      {duration:210,iterations:Infinity});
    await fly([pose(x,y,1),pose(x+45,y-72,.82,19),pose(x-55,y-108,.63,-14),pose(endX+39,endY-44,.48,-14),pose(endX,endY,size*.55)],1080);
  }else{
    const endScale=size*(kind==="flower"?.42:.55);
    await fly([pose(x,y,1),pose((x+endX)/2+33,Math.min(y,endY)-35,.65,12),pose(endX,endY,endScale)],650);
  }
}
async function addReward(kind,color,trigger){
  const source=centerOf(trigger.querySelector("svg")??trigger);
  const index=rewardList(kind).length;
  const area=areaFor(kind,index);
  const unlockedBefore=Math.max(1,...rewards.map(({id})=>Math.ceil(rewardList(id).length/capacity[id])));
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const needsMove=activeArea!==area;
  busy=true;
  pending={kind,index};
  picking=null;
  if(kind==="flower")state.flowers.push({day:nextFlower(),color});
  else state[kind].push(color);
  save();
  render();
  try{
    if(needsMove)await showArea(area,!reduced);
    if(!reduced){
      chime(kind);
      await animatePrize(kind,color,source,destination(kind,index,area));
    }
  }finally{
    $("effects").replaceChildren();
    pending=null;
    busy=false;
    render();
    message(area>=unlockedBefore
      ?areaName(area)+" is open!"
      :{flower:"A new flower bloomed!",bird:"A little bird flew into your garden!",house:"A little house appeared on the hill!"}[kind]);
  }
}
function message(value){$("status").textContent=value}
function openPicker(item){
  picking=item.id;
  $("picker").querySelector("strong").textContent="Choose a "+(item.id==="house"?"roof":item.name.toLowerCase())+" color";
  $("colors").innerHTML=Object.entries(palettes[item.id]).map(([color,fill])=>
    '<button class="swatch" aria-label="'+color[0].toUpperCase()+color.slice(1)+'" data-color="'+color+'" style="background:'+fill+'"><svg width="32" height="32" viewBox="'+item.view+'" aria-hidden="true" style="'+colorStyles[item.id](color)+'"><use href="#'+item.art+'"/></svg></button>'
  ).join("")+'<button class="cancel">Back</button>';
  render();
  $("colors").querySelector("button").focus();
}
$("rewards").addEventListener("click",e=>{
  const kind=e.target.closest("[data-reward]")?.dataset.reward;
  const item=rewards.find(reward=>reward.id===kind);
  if(item&&!busy&&availability(item)!=="locked")openPicker(item);
});
$("colors").addEventListener("click",e=>{
  if(busy||!picking)return;
  const swatch=e.target.closest("[data-color]");
  if(e.target.classList.contains("cancel")){
    const kind=picking;
    picking=null;
    render();
    $("rewards").querySelector('[data-reward="'+kind+'"]').focus();
  }else if(swatch){
    state=load();
    completed=read(completedKey,[]);
    const item=rewards.find(reward=>reward.id===picking);
    if(availability(item)==="ready")void addReward(picking,swatch.dataset.color,swatch);
    else{picking=null;render();message("This reward has already been collected.")}
  }
});
window.addEventListener("storage",event=>{
  if(busy||(event.key!==completedKey&&event.key!==key))return;
  state=load();
  completed=read(completedKey,[]);
  render();
});
const navigate=direction=>{
  if(!busy)void showArea(activeArea+direction,!matchMedia("(prefers-reduced-motion: reduce)").matches);
};
$("previous-area").onclick=()=>navigate(-1);
$("next-area").onclick=()=>navigate(1);
$("garden-pages").addEventListener("keydown",event=>{
  if(event.key==="ArrowLeft"||event.key==="ArrowRight"){
    event.preventDefault();
    navigate(event.key==="ArrowLeft"?-1:1);
  }
});
$("garden-pages").addEventListener("scroll",()=>{
  if(busy)return;
  const pages=$("garden-pages");
  const area=Math.max(0,Math.min(pages.children.length-1,Math.round(pages.scrollLeft/pages.clientWidth)));
  if(area!==activeArea){activeArea=area;updateNavigation()}
},{passive:true});
$("sound").onclick=()=>{state.sound=!state.sound;save();render()};
render();
message(nextFlower()?"Choose a color for your flower!":"Finish your daily practice to earn a flower.");
