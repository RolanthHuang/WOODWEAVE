import * as T from './vendor/three.module.min.js';
import {generateRooms,getStats,buildingRadius,getEnvelope,getHeroAnchor,LEVELS,LEVEL_HEIGHT,MAX_ROOMS} from './layout.js';
import {createMaterials,buildHabitat,buildLandscape,buildStructure,buildRoom,disposeModel,setModelDetail} from './model.js';
import {createEnvironment} from './surfaces.js';

const $=id=>document.getElementById(id),canvas=$('scene'),viewport=$('viewport');
const state={count:MAX_ROOMS,mode:'exterior',floor:-1,explode:0,night:false,spin:false,interior:false,selected:0,quality:'ultra'};
let rooms=[],habitat,landscape,structure,interiorModel,radius=35,renderHandle=0,lastTime=0,toastTimer,rangeTimer;
const scene=new T.Scene(),materials=createMaterials();
let renderer;
try{
  renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'default'});
}catch(error){
  $('loader').innerHTML='<span>目前無法啟動 3D 顯示</span><small>請啟用瀏覽器硬體加速後重新開啟。</small>';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.outputColorSpace=T.SRGBColorSpace;
const environment=createEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.42;
const camera=new T.PerspectiveCamera(37,1,.1,2000);
const hemi=new T.HemisphereLight('#faf5e7','#9ca08e',1.55);scene.add(hemi);
const sun=new T.DirectionalLight('#fff5df',2.7);sun.position.set(25,55,30);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.near=.5;sun.shadow.camera.far=180;sun.shadow.normalBias=.08;sun.shadow.bias=-.00012;sun.shadow.radius=3;scene.add(sun);
const fill=new T.DirectionalLight('#e4eeed',.75);fill.position.set(-40,25,-20);scene.add(fill);
const roomGlow=new T.PointLight('#ffe2ae',0,14,1.7);roomGlow.position.set(0,2.6,0);scene.add(roomGlow);
const groundMat=new T.MeshStandardMaterial({color:'#e9e9de',roughness:1});
const ground=new T.Mesh(new T.PlaneGeometry(1200,1200),groundMat);ground.rotation.x=-Math.PI/2;ground.position.y=-.25;ground.receiveShadow=true;scene.add(ground);
scene.fog=new T.Fog('#efeee7',220,480);
const highlight=new T.Group();scene.add(highlight);
const orbit={theta:.28,phi:1.35,distance:130,target:new T.Vector3(0,17,0),goalTheta:.28,goalPhi:1.35,goalDistance:130,goalTarget:new T.Vector3(0,17,0)};
let savedOrbit=null;
const raycaster=new T.Raycaster(),ndc=new T.Vector2();
let frames=0,contextLosses=0,benchmark=null,lastPerfPaint=0,autoBudget=0,adaptTime=0,frameWindow=[];
const perfNode=$('perf-live');


function requestRender(){if(!renderHandle)renderHandle=requestAnimationFrame(render);}
function fitDistance(){const w=viewport.clientWidth,h=viewport.clientHeight,aspect=w/h;return radius*(aspect<.8?4.7:aspect<1.15?3.9:2.85)+state.explode*.6;}
function overviewHeight(){return ((LEVELS-1)*(LEVEL_HEIGHT+state.explode*.035)+3.12)*.5;}
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;
  const offset=w>700?Math.min(125,w*.125):0;
  const verticalOffset=w<=600&&h<600?Math.min(state.interior?40:65,h*.14):0;
  camera.setViewOffset(w,h,offset,verticalOffset,w,h);camera.updateProjectionMatrix();requestRender();}
new ResizeObserver(resize).observe(viewport);
function render(time){
  renderHandle=0;const dt=Math.min((time-(lastTime||time))/1000,.06);lastTime=time;
  if(state.spin&&!document.hidden)orbit.goalTheta+=dt*(benchmark?.stage?.rapid?2.2:.13);
  const ease=1-Math.pow(.001,Math.max(dt,1/120));
  orbit.theta+=(orbit.goalTheta-orbit.theta)*ease;orbit.phi+=(orbit.goalPhi-orbit.phi)*ease;orbit.distance+=(orbit.goalDistance-orbit.distance)*ease;orbit.target.lerp(orbit.goalTarget,ease);
  const sph=new T.Spherical(orbit.distance,orbit.phi,orbit.theta);camera.position.setFromSpherical(sph).add(orbit.target);camera.lookAt(orbit.target);
  if(habitat){habitat.layers.forEach((layer,l)=>{layer.root.position.y=l*(LEVEL_HEIGHT+state.explode*.035);});habitat.root.updateMatrixWorld(true);}
  if(highlight.visible&&!state.interior){highlight.position.y=rooms[state.selected]?.level*(LEVEL_HEIGHT+state.explode*.035)||0;}
  $('compass-needle').style.transform=`rotate(${-orbit.theta*180/Math.PI}deg)`;
  canvas.dataset.cameraDistance=orbit.distance.toFixed(2);canvas.dataset.cameraTheta=orbit.theta.toFixed(3);canvas.dataset.cameraPhi=orbit.phi.toFixed(3);
  updateInteriorWall();updateDetail();
  const submitStart=performance.now();renderer.render(scene,camera);frames++;canvas.dataset.renderFrames=frames;
  measureFrame(time,performance.now()-submitStart);
  const moving=Math.abs(orbit.theta-orbit.goalTheta)+Math.abs(orbit.phi-orbit.goalPhi)+Math.abs(orbit.distance-orbit.goalDistance)+orbit.target.distanceTo(orbit.goalTarget)>.001;
  if((moving||state.spin||benchmark)&&!document.hidden)requestRender();
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function shadowUpdate(){
  const extent=state.interior?5.2:radius*1.3;
  sun.shadow.camera.left=-extent;sun.shadow.camera.right=extent;sun.shadow.camera.top=extent;sun.shadow.camera.bottom=-extent;sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias=state.interior?.012:.08;renderer.shadowMap.needsUpdate=true;requestRender();
}
function setButton(button,on){button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));}
function paintRange(input){const progress=((Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min)))*100;input.style.background=`linear-gradient(to right,var(--green) ${progress}%,#dce0d4 ${progress}%)`;}

function regenerate(count,{notify=false}={}){
  state.count=Math.min(MAX_ROOMS,Math.max(36,Math.round(count/6)*6));
  const prevKey=rooms[state.selected]?.key;
  if(state.interior)leaveRoom(false);
  if(habitat){scene.remove(habitat.root);disposeModel(habitat.root);}
  if(landscape){scene.remove(landscape);disposeModel(landscape);}
  if(structure){scene.remove(structure.root);disposeModel(structure.root);}
  rooms=generateRooms(state.count);radius=buildingRadius(rooms);habitat=buildHabitat(rooms,materials);landscape=buildLandscape(radius,materials);structure=buildStructure(rooms,materials);
  scene.add(landscape,structure.root,habitat.root);state.selected=Math.max(0,rooms.findIndex(r=>r.key===prevKey));
  if(!prevKey){const candidates=rooms.filter(r=>r.level===4);state.selected=candidates[Math.floor(candidates.length*.65)]?.id||0;}
  const stats=getStats(rooms);$('room-count').textContent=stats.total;$('count-four').textContent=stats.four;$('count-five').textContent=stats.five;$('count-six').textContent=stats.six;
  if(state.floor>=stats.levels)state.floor=-1;
  $('floor-profile').innerHTML=stats.perFloor.map((n,l)=>({n,l})).reverse().map(({n,l})=>`<button data-floor="${l}" aria-pressed="false" title="${l+1}F · ${n} 間房間"><span class="floor-num">${l+1}F</span><span class="floor-track"><span class="floor-bar" style="width:${Math.max(8,n/Math.max(...stats.perFloor)*94)}%;left:${(l-4)*.8}px"></span></span><span class="floor-rooms">${n}</span></button>`).join('');
  $('room-range').value=state.count;paintRange($('room-range'));$('grow').disabled=state.count>=MAX_ROOMS;$('grow').querySelector('span').textContent=state.count>=MAX_ROOMS?'已達本次上限':'＋36 間';
  canvas.dataset.rooms=stats.total;canvas.dataset.uniqueRooms=new Set(rooms.map(r=>r.signature)).size;canvas.dataset.uniqueHeroes=new Set(rooms.map(r=>r.hero.signature)).size;canvas.dataset.levels=stats.levels;canvas.dataset.floorDistribution=stats.perFloor.join(',');canvas.dataset.supportColumns='2';canvas.dataset.strengthAnalysis='NOT_ANALYSED';
  sun.position.set(25,55,30).normalize().multiplyScalar(Math.max(67,radius*2.3));sun.shadow.camera.far=Math.max(180,radius*5);
  sun.shadow.camera.left=-radius*1.3;sun.shadow.camera.right=radius*1.3;sun.shadow.camera.top=radius*1.3;sun.shadow.camera.bottom=-radius*1.3;sun.shadow.camera.updateProjectionMatrix();
  scene.fog.near=fitDistance()+radius*2;scene.fog.far=fitDistance()+radius*5;
  $('room-number').max=state.count;
  orbit.goalDistance=fitDistance();orbit.goalTarget.set(0,overviewHeight(),0);
  applyVisibility();updateSelection();shadowUpdate();
  if(notify)toast(state.count===MAX_ROOMS?`已生長至 ${MAX_ROOMS.toLocaleString()} 間；本次顯示上限已達成。`:`聚落已向外延伸，目前共有 ${state.count} 個房間。`);
}
function applyVisibility(){
  if(!habitat)return;
  habitat.root.visible=!state.interior&&state.mode!=='structure';landscape.visible=!state.interior;highlight.visible=!state.interior&&state.mode!=='structure';
  structure.root.visible=!state.interior&&state.explode===0&&(state.floor===-1||state.mode==='structure');
  document.body.classList.toggle('structure-mode',!state.interior&&state.mode==='structure');
  habitat.layers.forEach((layer,l)=>{
    layer.root.visible=state.floor===-1||state.floor===l;
    if(layer.categories.roof)layer.categories.roof.visible=state.mode==='exterior';
    if(layer.categories.skin)layer.categories.skin.visible=state.mode==='exterior';
  });
  document.querySelectorAll('[data-mode]').forEach(b=>setButton(b,b.dataset.mode===state.mode));
  document.querySelectorAll('[data-floor]').forEach(b=>setButton(b,Number(b.dataset.floor)===state.floor));
  if(!state.interior){$('scene-label').textContent=state.mode==='structure'?'02 / THE SUPPORTING DIAMOND':state.mode==='cutaway'?'03 / NINE LAYERS OF LIVING':'01 / THE INCLINED DIAMOND';$('scene-description').textContent=state.mode==='structure'?'雙側巨柱＋中央核心＋轉換桁架 · 承載尚未驗算':state.mode==='cutaway'?'九層剖面 · 點選分布圖可單獨查看樓層':'九層斜向木構 · 第五層最寬，上下逐層收窄';$('view-status').textContent=state.floor===-1?`PERSPECTIVE / ${getStats(rooms).levels} LEVELS`:`PERSPECTIVE / LEVEL ${state.floor+1}`;}
  const room=rooms[state.selected];highlight.visible=!state.interior&&state.mode!=='structure'&&(state.floor===-1||room?.level===state.floor);
  shadowUpdate();
}
function updateSelection(){
  const room=rooms[state.selected];if(!room)return;
  $('selected-id').textContent=room.code;$('selected-name').textContent=room.program.name;$('selected-desc').textContent=room.program.desc;$('selected-level').textContent=`${room.level+1}F`;
  $('selected-type').textContent={4:'四面體',5:'五面體',6:'六面體'}[room.faces];$('selected-area').textContent=`${room.area.toFixed(1)} m²`;$('selected-material').textContent=room.wood.name;
  $('swatch-wood').style.background=room.wood.color;$('swatch-accent').style.background=room.accent;$('selected-feature').textContent=room.hero.title;
  $('room-number').value=room.id+1;
  $('hero-name').textContent=room.hero.name;$('hero-description').textContent=room.hero.description;
  canvas.dataset.selected=room.code;canvas.dataset.roomType=room.faces;canvas.dataset.roomSignature=room.signature;canvas.dataset.hero=room.hero.signature;
  while(highlight.children.length){const child=highlight.children[0];highlight.remove(child);child.geometry?.dispose();child.material?.dispose();}
  const pts=room.poly.map(p=>new T.Vector3(p[0],.495,p[1]));pts.push(pts[0].clone());
  const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#c08c50',depthTest:false,transparent:true,opacity:.85}));line.renderOrder=10;highlight.add(line);
  highlight.position.y=room.level*(LEVEL_HEIGHT+state.explode*.035);highlight.visible=!state.interior&&state.mode!=='structure'&&(state.floor===-1||room.level===state.floor);
  $('focus-furniture').hidden=!state.interior;
  $('enter-room').textContent=state.interior?'恢復全房視角':'走進這個房間';if(!state.interior){const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.innerHTML='<use href="#i-arrow"/>';$('enter-room').appendChild(icon);}
  requestRender();
}
function selectRoom(index){state.selected=(index+rooms.length)%rooms.length;updateSelection();if(state.interior)enterRoom(true);}
function enterRoom(replace=false){
  document.body.classList.remove('detail-view');$('toggle-room-info').setAttribute('aria-label','收合房間資訊');$('toggle-room-info').setAttribute('aria-expanded','true');$('toggle-room-info').textContent='−';
  if(state.interior&&!replace)return;
  if(!state.interior){savedOrbit={theta:orbit.goalTheta,phi:orbit.goalPhi,distance:orbit.goalDistance,target:orbit.goalTarget.clone()};}
  if(interiorModel){scene.remove(interiorModel.root);disposeModel(interiorModel.root);}
  state.interior=true;state.spin=false;setButton($('rotate'),false);const room=rooms[state.selected];materials.wall.side=T.FrontSide;materials.wall.needsUpdate=true;interiorModel=buildRoom(room,materials);scene.add(interiorModel.root);
  const roomViewScale=viewport.clientWidth<=600&&viewport.clientHeight<600?1.25:1;
  orbit.goalTarget.set(0,1.15,0);orbit.goalDistance=(room.faces===6?14.5:11.8)*roomViewScale;orbit.goalTheta=-(room.rotation+(room.faces===6?(room.seed%2)*Math.PI:0))+.32;orbit.goalPhi=.94;
  document.body.classList.add('interior');$('back').hidden=false;$('scene-label').textContent=`04 / ${room.code.replace('–','-')} · INTERIOR`;$('scene-description').textContent='獨立房間模型 · 移除頂蓋與玻璃以觀察內裝';$('view-status').textContent=`${room.faces} FACES / ${room.program.kind.toUpperCase()}`;
  roomGlow.intensity=state.night?15:0;applyVisibility();updateSelection();resize();
}
function leaveRoom(restore=true){
  document.body.classList.remove('detail-view');$('toggle-room-info').setAttribute('aria-label','收合房間資訊');$('toggle-room-info').setAttribute('aria-expanded','true');$('toggle-room-info').textContent='−';
  if(!state.interior)return;state.interior=false;materials.wall.side=T.DoubleSide;materials.wall.needsUpdate=true;
  if(interiorModel){scene.remove(interiorModel.root);disposeModel(interiorModel.root);interiorModel=null;}
  document.body.classList.remove('interior');$('back').hidden=true;roomGlow.intensity=0;
  if(restore&&savedOrbit){orbit.goalTheta=savedOrbit.theta;orbit.goalPhi=savedOrbit.phi;orbit.goalDistance=savedOrbit.distance;orbit.goalTarget.copy(savedOrbit.target);}
  applyVisibility();updateSelection();resize();
}
function resetView(){if(state.interior)leaveRoom();state.floor=-1;orbit.goalTheta=.28;orbit.goalPhi=1.35;orbit.goalDistance=fitDistance();orbit.goalTarget.set(0,overviewHeight(),0);setViewActive('axon');applyVisibility();requestRender();}
function setViewActive(key){setButton($('view-axon'),key==='axon');setButton($('view-top'),key==='top');setButton($('view-front'),key==='front');}
function zoom(factor){orbit.goalDistance=T.MathUtils.clamp(orbit.goalDistance*factor,state.interior?4:8,state.interior?32:radius*6);requestRender();}
function setNight(){
  state.night=!state.night;document.body.classList.toggle('night',state.night);setButton($('night'),state.night);
  hemi.intensity=state.night?1.0:1.55;hemi.color.set(state.night?'#a8bab2':'#faf5e7');sun.intensity=state.night?.5:2.7;sun.color.set(state.night?'#adbbb7':'#fff5df');fill.intensity=state.night?.55:.75;
  scene.fog.color.set(state.night?'#1e2926':'#efeee7');groundMat.color.set(state.night?'#52675e':'#e9e9de');renderer.toneMappingExposure=state.night?1.08:1.08;roomGlow.intensity=state.interior&&state.night?15:0;
  for(const [name,strength] of [['wood',.22],['wall',.12],['timber',.08],['white',.1],['fabric',.10],['felt',.09],['woodfelt',.09]]){materials[name].emissive.set('#b88b52');materials[name].emissiveIntensity=state.night?strength:0;}
  materials.light.color.set(state.night?'#ffcf82':'#ffe3ac');materials.screen.color.set(state.night?'#cce9db':'#ffffff');scene.environmentIntensity=state.night?.16:.42;
  $('night-label').textContent=state.night?'夜色':'日光';$('night-icon').innerHTML=state.night?'<use href="#i-moon"/>':'<use href="#i-sun"/>';shadowUpdate();
}

$('room-range').addEventListener('input',e=>{paintRange(e.target);$('room-count').textContent=e.target.value;clearTimeout(rangeTimer);rangeTimer=setTimeout(()=>regenerate(Number(e.target.value)),90);});
$('room-range').addEventListener('change',e=>{clearTimeout(rangeTimer);regenerate(Number(e.target.value));});
$('grow').addEventListener('click',()=>regenerate(Math.min(MAX_ROOMS,state.count+36),{notify:true}));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{if(state.interior)leaveRoom();state.mode=b.dataset.mode;if(state.mode==='structure'){state.floor=-1;state.explode=0;$('explode').value=0;$('explode-value').textContent='0%';paintRange($('explode'));orbit.goalTarget.set(0,overviewHeight(),0);orbit.goalDistance=fitDistance();}applyVisibility();}));
$('floor-controls').addEventListener('click',event=>{const b=event.target.closest('[data-floor]');if(!b)return;if(state.interior)leaveRoom();if(state.mode==='structure')state.mode='cutaway';state.floor=Number(b.dataset.floor);applyVisibility();if(state.floor>=0){const choice=rooms.find(r=>r.level===state.floor);if(choice)selectRoom(choice.id);const e=getEnvelope(rooms)[state.floor];orbit.goalTarget.set((e.minX+e.maxX)/2,state.floor*(LEVEL_HEIGHT+state.explode*.035)+1.6,(e.minZ+e.maxZ)/2);orbit.goalDistance=Math.max(25,(e.maxX-e.minX)*1.65,(e.maxZ-e.minZ)*2.5);requestRender();}else{orbit.goalTarget.set(0,overviewHeight(),0);orbit.goalDistance=fitDistance();requestRender();}});
$('explode').addEventListener('input',e=>{if(state.interior)leaveRoom();if(state.mode==='structure')state.mode='cutaway';state.floor=-1;state.explode=Number(e.target.value);$('explode-value').textContent=`${state.explode}%`;paintRange(e.target);orbit.goalTarget.set(0,overviewHeight(),0);orbit.goalDistance=fitDistance();applyVisibility();shadowUpdate();});
$('room-jump').addEventListener('submit',e=>{e.preventDefault();const input=$('room-number');if(!input.reportValidity())return;selectRoom(Number(input.value)-1);});
$('prev-room').addEventListener('click',()=>selectRoom(state.selected-1));$('next-room').addEventListener('click',()=>selectRoom(state.selected+1));
$('enter-room').addEventListener('click',()=>enterRoom(state.interior));$('back').addEventListener('click',()=>leaveRoom());
function collapseRoomInfo(){document.body.classList.add('detail-view');$('toggle-room-info').setAttribute('aria-label','展開房間資訊');$('toggle-room-info').setAttribute('aria-expanded','false');$('toggle-room-info').textContent='＋';}
$('toggle-room-info').addEventListener('click',()=>{if(document.body.classList.contains('detail-view')){document.body.classList.remove('detail-view');$('toggle-room-info').setAttribute('aria-label','收合房間資訊');$('toggle-room-info').setAttribute('aria-expanded','true');$('toggle-room-info').textContent='−';}else collapseRoomInfo();});
$('focus-furniture').addEventListener('click',()=>{if(!state.interior)enterRoom();for(const category of ['ceiling','roof','structure'])if(interiorModel.categories[category])interiorModel.categories[category].visible=false;const room=rooms[state.selected];collapseRoomInfo();orbit.goalTarget.set(0,.77,0);orbit.goalDistance=6.1;orbit.goalTheta=-(room.rotation+(room.faces===6?(room.seed%2)*Math.PI:0))+.27;orbit.goalPhi=1.04;shadowUpdate();});
$('focus-hero').addEventListener('click',()=>{if(!state.interior)enterRoom();for(const category of ['ceiling','roof','structure'])if(interiorModel.categories[category])interiorModel.categories[category].visible=false;collapseRoomInfo();const room=rooms[state.selected],anchor=getHeroAnchor({...room,center:[0,0],poly:room.local});orbit.goalTarget.set(anchor.x,.51+anchor.scale*.77,anchor.z);orbit.goalDistance=4.6;orbit.goalTheta=Math.atan2(-anchor.x,-anchor.z);orbit.goalPhi=.95;shadowUpdate();});
$('zoom-in').addEventListener('click',()=>zoom(.8));$('zoom-out').addEventListener('click',()=>zoom(1.25));$('reset').addEventListener('click',resetView);
$('view-axon').addEventListener('click',()=>{orbit.goalTheta=.28;orbit.goalPhi=1.35;setViewActive('axon');requestRender();});
$('view-front').addEventListener('click',()=>{orbit.goalTheta=0;orbit.goalPhi=1.55;setViewActive('front');requestRender();});
$('view-top').addEventListener('click',()=>{orbit.goalPhi=.025;orbit.goalTheta=0;setViewActive('top');requestRender();});
$('rotate').addEventListener('click',()=>{state.spin=!state.spin;setButton($('rotate'),state.spin);requestRender();});$('night').addEventListener('click',setNight);
$('mobile-controls').addEventListener('click',()=>{const open=$('sidebar').classList.toggle('open');$('mobile-controls').setAttribute('aria-expanded',String(open));});
$('snapshot').addEventListener('click',()=>{
  renderer.render(scene,camera);const image=document.createElement('canvas');image.width=canvas.width;image.height=canvas.height;const ctx=image.getContext('2d');ctx.fillStyle=state.night?'#1e2926':'#efeee7';ctx.fillRect(0,0,image.width,image.height);ctx.drawImage(canvas,0,0);
  ctx.fillStyle=state.night?'#c3cbb9':'#596e4c';ctx.font=`${Math.round(image.width/80)}px sans-serif`;ctx.fillText('木序  /  WOODWEAVE',image.width*.035,image.height*.07);
  ctx.font=`${Math.round(image.width/125)}px monospace`;ctx.fillText(state.interior?`${rooms[state.selected].code} / ${rooms[state.selected].program.name}`:`${rooms.length} ROOMS / A LIVING GEOMETRY`,image.width*.035,image.height*.105);
  image.toBlob(blob=>{if(!blob){toast('圖片暫時無法儲存，請再試一次。');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=state.interior?`woodweave-room-${state.selected+1}.png`:'woodweave-habitat.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);toast('建築圖片已準備下載。');},'image/png');
});

// Mouse and touch share the same orbit model. A gesture never selects a room.
const pointers=new Map();let dragged=false,gestureStart=null,lastPoint=null,twoFinger=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastPoint={x:e.clientX,y:e.clientY};gestureStart={x:e.clientX,y:e.clientY};dragged=false;$('tooltip').hidden=true;canvas.classList.add('dragging');if(pointers.size===2){twoFinger=touchMeasure();dragged=true;}});
function touchMeasure(){const p=[...pointers.values()];return {distance:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};}
function pan(dx,dy){const speed=orbit.goalDistance/viewport.clientHeight*.65;const right=new T.Vector3(Math.cos(orbit.theta),0,-Math.sin(orbit.theta));const forward=new T.Vector3(-Math.sin(orbit.theta),0,-Math.cos(orbit.theta));orbit.goalTarget.addScaledVector(right,-dx*speed);orbit.goalTarget.addScaledVector(forward,-dy*speed);}
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)){hoverAt(e);return;}
  const dx=e.clientX-lastPoint.x,dy=e.clientY-lastPoint.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(Math.hypot(e.clientX-gestureStart.x,e.clientY-gestureStart.y)>4)dragged=true;
  if(pointers.size===2){const now=touchMeasure();if(twoFinger){zoom(twoFinger.distance/Math.max(1,now.distance));pan(now.x-twoFinger.x,now.y-twoFinger.y);}twoFinger=now;}
  else if(e.buttons===2||e.buttons===4||e.shiftKey){pan(dx,dy);}else{orbit.goalTheta-=dx*.006;orbit.goalPhi=T.MathUtils.clamp(orbit.goalPhi-dy*.005,.025,1.52);setViewActive('custom');}
  lastPoint={x:e.clientX,y:e.clientY};requestRender();
});
function pointerEnd(e){const wasMulti=!!twoFinger;pointers.delete(e.pointerId);if(!pointers.size){canvas.classList.remove('dragging');twoFinger=null;if(!dragged&&!wasMulti&&e.button===0&&!state.interior){const room=pickAt(e.clientX,e.clientY);if(room!==null)selectRoom(room);}}else{const point=[...pointers.values()][0];lastPoint={...point};gestureStart={...point};dragged=true;}}
canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',e=>{pointers.clear();twoFinger=null;canvas.classList.remove('dragging');});
canvas.addEventListener('pointerleave',()=>{$('tooltip').hidden=true;});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(T.MathUtils.clamp(e.deltaY,-120,120)*.002));},{passive:false});
canvas.addEventListener('keydown',e=>{let handled=true;switch(e.key){case 'ArrowLeft':orbit.goalTheta-=.12;break;case 'ArrowRight':orbit.goalTheta+=.12;break;case 'ArrowUp':orbit.goalPhi=Math.max(.025,orbit.goalPhi-.10);break;case 'ArrowDown':orbit.goalPhi=Math.min(1.52,orbit.goalPhi+.10);break;case '+':case '=':zoom(.85);break;case '-':zoom(1.18);break;case 'Home':resetView();break;case 'Escape':leaveRoom();break;default:handled=false;}if(handled){e.preventDefault();requestRender();}});
let lastHover=0;
function pickAt(x,y){
  const rect=canvas.getBoundingClientRect();ndc.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);raycaster.setFromCamera(ndc,camera);
  if(state.mode==='structure')return null;
  const active=habitat.pickables.filter(m=>m.visible&&m.parent.visible&&m.parent.parent.visible);
  const hits=raycaster.intersectObjects(active,false);for(const hit of hits){const id=hit.object.userData.rooms[hit.faceIndex];if(id>=0)return id;}return null;
}
function hoverAt(e){if(state.interior||performance.now()-lastHover<65)return;lastHover=performance.now();const id=pickAt(e.clientX,e.clientY);if(id===null){$('tooltip').hidden=true;canvas.style.cursor='grab';return;}
  const room=rooms[id],rect=viewport.getBoundingClientRect();$('tooltip').textContent=`${room.code} · ${room.program.name}`;$('tooltip').style.left=`${Math.min(e.clientX-rect.left+14,rect.width-190)}px`;$('tooltip').style.top=`${e.clientY-rect.top-36}px`;$('tooltip').hidden=false;canvas.style.cursor='pointer';}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&benchmark)finishBenchmark('分頁轉入背景，測試停止');if(!document.hidden){lastTime=0;requestRender();}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLosses++;canvas.dataset.contextLosses=contextLosses;if(benchmark)finishBenchmark('3D 顯示中斷');toast('3D 顯示暫停，請重新整理以恢復。');});


// Open the wall nearest the viewer as a model maker would remove a wall panel.
// Its slats and acoustic inserts follow the same rule as the solid wall.
function updateInteriorWall(){
  if(!state.interior||!interiorModel?.categories.skin)return;
  const room=rooms[state.selected],i=room.faces===4?0:room.seed%room.local.length,a=room.local[i],b=room.local[(i+1)%room.local.length];
  const mx=(a[0]+b[0])*.5,mz=(a[1]+b[1])*.5;
  let nx=-(b[1]-a[1]),nz=b[0]-a[0];if(nx*(-mx)+nz*(-mz)<0){nx=-nx;nz=-nz;}
  const show=(camera.position.x-mx)*nx+(camera.position.z-mz)*nz>=0;
  for(const mesh of interiorModel.categories.skin.children)if(mesh.material!==materials.glass)mesh.visible=show;
}
function setQuality(value){
  state.quality=value;$('quality').value=value;
  const cap=value==='ultra'?2:value==='eco'?1:1.75;
  renderer.setPixelRatio(Math.min(devicePixelRatio,Math.max(1,cap-(value==='auto'?autoBudget*.35:0))));resize();
  $('quality-label').textContent=`細節 · ${{auto:'自動',ultra:'極致',eco:'輕盈'}[value]}`;canvas.dataset.quality=value;shadowUpdate();
}
function updateDetail(){
  const px=viewport.clientHeight/(2*Math.tan(camera.fov*Math.PI/360)*orbit.distance)*6.4;
  const high=state.quality==='ultra'||state.quality==='auto'&&px>(autoBudget?64:44);
  const micro=state.quality==='ultra'||state.quality==='auto'&&px>(autoBudget?85:62);
  if(habitat)habitat.layers.forEach(layer=>setModelDetail(layer,high,micro));
  if(interiorModel)setModelDetail(interiorModel,true,state.quality!=='eco');
  canvas.dataset.detail=state.interior?'ROOM_FULL':high?(micro?'FULL':'CURVED'):'DISTANT';
}
const memorySnapshot=()=>({geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
  jsHeapMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576*10)/10:null});
function percentile(samples,p){const sorted=samples.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]||0;}
function measureFrame(time,submit){
  const gap=time-(measureFrame.previous||time);measureFrame.previous=time;
  if(gap>0&&gap<250){frameWindow.push(gap);if(frameWindow.length>90)frameWindow.shift();}
  if(time-lastPerfPaint>800){
    const fps=frameWindow.length?1000/(frameWindow.reduce((a,b)=>a+b,0)/frameWindow.length):0;
    perfNode.textContent=`${fps.toFixed(1)} FPS · ${renderer.info.render.calls} 次繪製 · ${(renderer.info.render.triangles/1e6).toFixed(2)}M 三角形\n${canvas.width} × ${canvas.height} · ${memorySnapshot().geometries} 幾何資源 · ${renderer.info.memory.textures} 貼圖`;
    canvas.dataset.fps=fps.toFixed(1);lastPerfPaint=time;
    if(!benchmark&&state.quality==='auto'&&frameWindow.length>40&&time-adaptTime>6000){
      const next=fps<28?1:fps>52?0:autoBudget;if(next!==autoBudget){autoBudget=next;adaptTime=time;setQuality('auto');}
    }
  }
  if(!benchmark)return;
  const b=benchmark,stage=b.stage;
  if(!b.stageStart)b.stageStart=time;
  const elapsed=time-b.stageStart,warmup=stage.rapid?6000:3000,duration=stage.duration||20000;
  // Count all measured gaps, including the first rapid zoom and long stalls.
  if(elapsed>=warmup&&b.lastSample){
    b.samples.push(time-b.lastSample);b.submits.push(submit);b.calls=Math.max(b.calls,renderer.info.render.calls);b.triangles=Math.max(b.triangles,renderer.info.render.triangles);
    if(stage.rapid){
      if(b.motionStartTheta===null)b.motionStartTheta=orbit.theta;
      b.motionMin=Math.min(b.motionMin,orbit.distance);b.motionMax=Math.max(b.motionMax,orbit.distance);b.motionRadians=Math.abs(orbit.theta-b.motionStartTheta);
      const phase=Math.floor((elapsed-warmup)/800);
      if(phase!==b.zoomPhase){b.zoomPhase=phase;zoom((phase%2===0?12:b.farDistance)/orbit.goalDistance);b.zoomToggles++;}
      orbit.goalPhi=1.16+Math.sin((elapsed-warmup)/1800)*.15;
    }
  }
  b.lastSample=time;
  if(stage.cycle&&elapsed-b.lastCycle>650){
    b.lastCycle=elapsed;
    if(b.cycles<24){selectRoom(state.selected+1);b.cycles++;b.roomSwitches++;}
    else if(b.cycles<28){regenerate(b.cycles%2?MAX_ROOMS:720);b.cycles++;b.growthRebuilds++;state.mode='cutaway';state.spin=true;applyVisibility();}
  }
  if(time-(b.lastPaint||0)>450){$('test-summary').textContent=`${b.index+1} / ${b.stages.length} · ${stage.name} · ${Math.min(duration/1000,Math.floor(Math.max(0,elapsed-warmup)/1000))} / ${duration/1000} 秒`;b.lastPaint=time;}
  if(elapsed>=warmup+duration){
    const sum=b.samples.reduce((a,b)=>a+b,0),fps=1000*b.samples.length/sum,p99=percentile(b.samples,.99),slow=b.samples.filter(n=>n>50).length;
    b.results.push({name:stage.name,rooms:state.count,quality:state.quality,mode:state.interior?'interior':state.mode,view:stage.rapid?'rapid':stage.near?'near':stage.interior?'interior':'overview',detail:canvas.dataset.detail,
      viewport:{width:viewport.clientWidth,height:viewport.clientHeight,renderWidth:canvas.width,renderHeight:canvas.height,pixelRatio:renderer.getPixelRatio()},
      samples:b.samples.length,seconds:+(sum/1000).toFixed(2),averageFPS:+fps.toFixed(1),
      frameP95ms:+percentile(b.samples,.95).toFixed(2),frameP99ms:+p99.toFixed(2),maxFrameMs:+Math.max(...b.samples).toFixed(2),framesOver50ms:slow,
      meanSubmissionMs:+(b.submits.reduce((a,b)=>a+b,0)/b.submits.length).toFixed(2),maxDrawCalls:b.calls,maxTriangles:b.triangles,resources:memorySnapshot(),contextLosses,
      rapidInteraction:stage.rapid?{zoomToggles:b.zoomToggles,zoomIntervalMs:800,rotationRadians:+b.motionRadians.toFixed(2),rotationSpeedRadiansPerSecond:2.2,cameraDistance:[+b.motionMin.toFixed(2),+b.motionMax.toFixed(2)],fixedQuality:true}:null,
      smoothnessPass:stage.cycle?null:fps>=45&&p99<=28&&slow===0&&contextLosses===0});
    b.index++;
    if(b.index>=b.stages.length){finishBenchmark();return;}startBenchmarkStage();
  }
}
function startBenchmarkStage(){
  const b=benchmark,stage=b.stages[b.index];b.stage=stage;b.stageStart=0;b.lastSample=0;b.lastCycle=0;b.cycles=0;b.samples=[];b.submits=[];b.calls=0;b.triangles=0;b.zoomPhase=-1;b.zoomToggles=0;b.motionStartTheta=null;b.motionMin=Infinity;b.motionMax=0;b.motionRadians=0;
  if(state.interior)leaveRoom(false);state.explode=0;state.floor=-1;state.mode=stage.mode||'exterior';$('explode').value=0;$('explode-value').textContent='0%';paintRange($('explode'));
  const began=performance.now(),reuse=state.count===stage.count;if(!reuse)regenerate(stage.count);b.buildTimes.push({name:stage.name,reused:reuse,milliseconds:Math.round(performance.now()-began)});
  setQuality(stage.quality);resetView();state.mode=stage.mode||'exterior';applyVisibility();
  if(stage.near||stage.rapid){
    const r=rooms.filter(r=>r.level===4).reduce((a,r)=>Math.hypot(...r.center)<Math.hypot(...a.center)?r:a);
    orbit.goalTarget.set(r.center[0],r.level*LEVEL_HEIGHT+1.5,r.center[1]);orbit.goalDistance=stage.near?24:fitDistance()*1.10;orbit.goalPhi=1.16;
  }
  if(stage.interior){selectRoom(rooms.find(r=>r.faces===6&&r.program.kind==='work')?.id||0);enterRoom();$('focus-furniture').click();}
  orbit.distance=orbit.goalDistance;orbit.phi=orbit.goalPhi;orbit.theta=orbit.goalTheta;orbit.target.copy(orbit.goalTarget);b.farDistance=fitDistance()*1.10;
  state.spin=true;setButton($('rotate'),true);requestRender();
}
function finishBenchmark(reason=null){
  if(!benchmark)return;const b=benchmark;benchmark=null;state.spin=false;setButton($('rotate'),false);
  const result={edition:'ATELIER_04_1080',status:reason?'STOPPED':'COMPLETED',reason,
    viewport:{width:viewport.clientWidth,height:viewport.clientHeight,devicePixelRatio,renderWidth:canvas.width,renderHeight:canvas.height},
    criteria:{averageFPSMin:45,frameP99msMax:28,framesOver50msMax:0},
    initialResources:b.initialResources,buildTimes:b.buildTimes,results:b.results,finalResources:memorySnapshot(),roomSwitches:b.roomSwitches,growthRebuilds:b.growthRebuilds,
    smoothnessPass:!reason&&b.results.filter(r=>r.smoothnessPass!==null).every(r=>r.smoothnessPass),contextLosses,
    limits:'Short browser test only. Render frame scheduling is not input-to-photon latency. JS heap is not total process or GPU memory. Rebuilding models is measured separately from orbit/zoom. No structural strength analysis.'};
  $('test-json').textContent=JSON.stringify(result,null,2);$('test-results').hidden=false;
  $('test-summary').textContent=reason||`完成 ${b.results.length} 組測試 · 顯示中斷 ${contextLosses} 次。`;
  $('run-test').hidden=false;$('stop-test').hidden=true;
  if(!reason){if(state.interior)leaveRoom();state.mode='exterior';if(state.count!==MAX_ROOMS)regenerate(MAX_ROOMS);selectRoom(b.originalSelected);setQuality(b.originalQuality);resetView();toast('流暢度測試完成，結果保留在細節面板。');}
  requestRender();
}
$('quality').addEventListener('change',e=>{if(benchmark)finishBenchmark('手動調整品質，測試停止');setQuality(e.target.value);});
$('run-test').addEventListener('click',()=>{
  if(benchmark)return;if(state.night)setNight();
  benchmark={index:0,results:[],buildTimes:[],roomSwitches:0,growthRebuilds:0,originalSelected:state.selected,originalQuality:state.quality,initialResources:memorySnapshot(),stages:[
    {name:'1,080 間・極致全景',count:MAX_ROOMS,quality:'ultra'},
    {name:'1,080 間・極致近景',count:MAX_ROOMS,quality:'ultra',near:true},
    {name:'1,080 間・快速旋轉與縮放',count:MAX_ROOMS,quality:'ultra',rapid:true,duration:60000},
    {name:'1,080 間・極致剖面',count:MAX_ROOMS,quality:'ultra',mode:'cutaway',duration:12000},
    {name:'單房・材質近看',count:MAX_ROOMS,quality:'ultra',interior:true,duration:12000},
    {name:'24 次換房與反覆增建',count:MAX_ROOMS,quality:'ultra',interior:true,cycle:true}
  ]};
  $('run-test').hidden=true;$('stop-test').hidden=false;$('test-results').hidden=true;startBenchmarkStage();
});
$('stop-test').addEventListener('click',()=>finishBenchmark('手動停止'));

regenerate(MAX_ROOMS);setQuality('ultra');orbit.distance=orbit.goalDistance;orbit.target.copy(orbit.goalTarget);setViewActive('axon');resize();
requestAnimationFrame(()=>{$('loader').classList.add('done');canvas.dataset.ready='true';setTimeout(()=>$('loader').hidden=true,550);});
