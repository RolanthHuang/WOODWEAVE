// Triangles tessellate the plane; two adjacent triangles form a six-face rhombic prism.
export const SIDE = 6.4;
export const LEVEL_HEIGHT = 3.85;
export const ROOM_HEIGHT = 3.12;
export const MAX_ROOMS = 360;
export const LEVELS = 9;
export const FLOOR_WEIGHTS = [4,10,20,32,44,32,20,12,6];
export const FLOOR_DRIFT = 1.35;
export function floorOffset(level){return [(level-4)*FLOOR_DRIFT,(level-4)*.30];}
export const WOODS = [
  {name:'自然橡木',color:'#c6a376'}, {name:'淺色白蠟木',color:'#d5bc94'},
  {name:'煙燻橡木',color:'#a28a67'}, {name:'溫潤樺木',color:'#d8bf96'},
  {name:'蜂蜜橡木',color:'#c6a06a'}, {name:'柔霧胡桃木',color:'#a68b6c'}
];
export const ACCENTS = ['#7c8971','#b4836b','#8b9b9a','#d1b983','#a1a58a','#a6a0ab','#b4a38e','#60796f'];
export const PROGRAMS = [
  {name:'靜謐起居室',kind:'living',desc:'低矮沙發與懸浮茶几，為日常留下一片安靜。'},
  {name:'光合工作室',kind:'work',desc:'極簡工作檯與數位介面，讓靈感在自然光裡發生。'},
  {name:'雲端臥室',kind:'sleep',desc:'懸浮床座、柔光床頭，收藏一整晚的安穩。'},
  {name:'慢讀書房',kind:'library',desc:'開放書架與一張閱讀椅，容納專注和片刻放空。'},
  {name:'共享餐敘間',kind:'dining',desc:'一張木桌、幾張輕巧座椅，讓對話自然展開。'},
  {name:'靜心冥想室',kind:'zen',desc:'低台、織物與一株綠意，留白也是一種生活。'},
  {name:'未來創作室',kind:'studio',desc:'數位畫板與模組展台，讓工具安靜地服務創作。'},
  {name:'森系交誼廳',kind:'lounge',desc:'圓桌、柔軟座席與綠植，打開相聚的可能。'}
];
export const FEATURES=['線性柔光 · 低彩度織物','環形吊燈 · 木質傢俱','間接光帶 · 幾何織毯','數位介面 · 柔霧木色','嵌入光點 · 室內綠植','線型吊燈 · 自然木紋'];
export const HERO_FAMILIES=[
  {short:'浮雕',title:'光譜浮雕牆',desc:'30 塊高低不同的立體單元，組成只屬於這間房的光譜。'},
  {short:'星環',title:'星環共鳴燈',desc:'三道光環以獨立角度交錯，每一組的軌道姿態都不同。'},
  {short:'稜晶',title:'折光稜晶庭',desc:'一組高低與排列各異的稜晶，安放在極簡展示台上。'},
  {short:'波紋',title:'參數波紋屏',desc:'木質薄片形成獨立的波峰、頻率與節奏，光線沿著稜線游移。'},
  {short:'軌道',title:'軌道桌上雕塑',desc:'金屬軌道與懸浮球體，為每間房留下不同的微型星系。'},
  {short:'光階',title:'懸浮螺旋光階',desc:'薄片沿獨立的螺旋向上展開，階數、轉角與層距各有不同。'},
  {short:'山水',title:'數位山水裝置',desc:'以不同高度的方柱，生成一幅專屬的小型立體地景。'},
  {short:'星圖',title:'星圖光牆',desc:'光點與連線在牆面構成獨立星圖，每間都有自己的座標。'},
  {short:'藏光',title:'稜鏡藏光架',desc:'錯位幾何框格與細光帶，組成一座不同形態的收藏裝置。'}
];
export function getHero(id,seed){const type=id%HERO_FAMILIES.length,variant=Math.floor(id/HERO_FAMILIES.length),family=HERO_FAMILIES[type];const a=['晨','霧','森','月','潮','星','暮','雲'],b=['序','汐','弧','境','律','脈'];return {type,variant,seed:hash(seed,type,variant),name:`${family.short}・${a[variant%8]}${b[Math.floor(variant/8)%6]}`,title:family.title,description:family.desc,signature:`${type}:${variant}`};}
export function getHeroAnchor(room){const index=room.faces===6?room.local.reduce((best,p,i)=>Math.hypot(...p)>Math.hypot(...room.local[best])?i:best,0):room.hero.variant%room.poly.length;const p=room.poly[index],fraction=room.faces===4?.43:.64;return {x:room.center[0]+(p[0]-room.center[0])*fraction,z:room.center[1]+(p[1]-room.center[1])*fraction,scale:room.faces===4?.62:room.faces===6?1.0:.85};}
export function hash(a,b=0,c=0){let n=Math.imul(a+131,374761393)^Math.imul(b+911,668265263)^Math.imul(c+53,1274126177);n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;}
export function rng(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const point=(q,r)=>[SIDE*(q+r*.5),SIDE*Math.sqrt(3)*.5*r];
function makeRoom(poly,level,q,r,part,index){
  const seed=hash(q*3+part,r,level), rand=rng(seed);
  const center=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]);
  const local=poly.map(p=>[p[0]-center[0],p[1]-center[1]]);
  const faces=poly.length===4?6:(seed%5===0?4:5);
  const wood=WOODS[Math.floor(rand()*WOODS.length)],accent=ACCENTS[Math.floor(rand()*ACCENTS.length)];
  const program=PROGRAMS[Math.floor(rand()*PROGRAMS.length)];
  let area=0;for(let i=0;i<poly.length;i++){let p=poly[i],n=poly[(i+1)%poly.length];area+=p[0]*n[1]-n[0]*p[1];}
  return {id:index,code:`R–${String(index+1).padStart(3,'0')}`,key:`${q}:${r}:${level}:${part}`,seed,level,q,r,part,faces,center,poly,local,area:Math.abs(area*.5),wood,accent,program,hero:getHero(index,seed),feature:FEATURES[seed%FEATURES.length],rotation:Math.atan2(local[1][1]-local[0][1],local[1][0]-local[0][0]),variation:rand(),signature:`${seed.toString(36)}-${q}-${r}-${level}-${part}`};
}
export function generateRooms(count=180){
  // Weighted fair allocation keeps 9 floors at every size and preserves earlier rooms.
  // The fifth floor is widest; the mass narrows above and below it.
  const candidates=Array.from({length:LEVELS},(_,level)=>{
    const shift=floorOffset(level),cells=[];
    for(let q=-13;q<=13;q++)for(let r=-13;r<=13;r++){
      const p=point(q+.5,r+.5);
      const score=Math.abs(p[0])*.46+Math.abs(p[1])*1.12+(hash(q,r,level)%100)*.0007;
      cells.push({q,r,score});
    }
    cells.sort((a,b)=>a.score-b.score||a.q-b.q||a.r-b.r);
    const result=[];
    for(const {q,r} of cells){
      const p=(u,v)=>{const a=point(u,v);return [a[0]+shift[0],a[1]+shift[1]];};
      const a=p(q,r),b=p(q+1,r),c=p(q,r+1),d=p(q+1,r+1);
      const polygons=hash(q,r,level)%4===0?[[a,b,d,c]]:[[a,b,c],[b,d,c]];
      polygons.forEach((poly,part)=>{
        // A reserved central shaft gives the concept an uninterrupted core to ground.
        const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]);
        if(Math.min(...xs)<1.65&&Math.max(...xs)>-1.65&&Math.min(...zs)<1.65&&Math.max(...zs)>-1.65)return;
        result.push({poly,q,r,part});
      });
    }
    return result;
  });
  const used=Array(LEVELS).fill(0),rooms=[];
  while(rooms.length<count){
    let level=0,cost=Infinity;
    for(let l=0;l<LEVELS;l++){const next=(used[l]+.5)/FLOOR_WEIGHTS[l];if(next<cost){cost=next;level=l;}}
    const descriptor=candidates[level][used[level]++];
    rooms.push(makeRoom(descriptor.poly,level,descriptor.q,descriptor.r,descriptor.part,rooms.length));
  }
  return rooms;
}
export function getStats(rooms){return {total:rooms.length,four:rooms.filter(r=>r.faces===4).length,five:rooms.filter(r=>r.faces===5).length,six:rooms.filter(r=>r.faces===6).length,levels:rooms.map(r=>r.level).filter((x,i,a)=>a.indexOf(x)===i).length,perFloor:Array.from({length:LEVELS},(_,l)=>rooms.filter(r=>r.level===l).length)};}
export function buildingRadius(rooms){return Math.max(...rooms.flatMap(r=>r.poly.map(p=>Math.hypot(p[0],p[1]))),LEVELS*LEVEL_HEIGHT*.62)+4;}
export function getEnvelope(rooms){return Array.from({length:LEVELS},(_,l)=>{const on=rooms.filter(r=>r.level===l),points=on.flatMap(r=>r.poly);return {level:l,count:on.length,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1])),y:l*LEVEL_HEIGHT+.24};});}
export function getSupportPlan(rooms){
  const envelope=getEnvelope(rooms),middle=envelope[4];
  return {envelope,columns:[{x:middle.minX-.45,z:0,top:middle.y-.1},{x:middle.maxX+.45,z:0,top:middle.y-.1}],core:{x:0,z:0,halfWidth:1.35,height:(LEVELS-1)*LEVEL_HEIGHT+3.58},bearingVerification:'NOT_ANALYSED'};
}
