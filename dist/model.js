import * as T from './vendor/three.module.min.js';
import {SIDE,ROOM_HEIGHT,LEVEL_HEIGHT,LEVELS,getSupportPlan,getHeroAnchor,rng,hash} from './layout.js';
import {createTextureSet} from './surfaces.js';
import {addPlant,addFurniture} from './furnishings.js';

const Y=new T.Vector3(0,1,0),tmp=new T.Object3D();
function roundedBox(segments){
  const g=new T.BoxGeometry(1,1,1,segments,segments,segments),p=g.attributes.position,n=g.attributes.normal;
  const grid=segments===5?[-.5,-.477,-.437,.437,.477,.5]:[-.5,-.437,.437,.5],v=new T.Vector3(),inner=new T.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);v.set(...[v.x,v.y,v.z].map(x=>grid[Math.round((x+.5)*segments)]));
    inner.set(T.MathUtils.clamp(v.x,-.40,.40),T.MathUtils.clamp(v.y,-.40,.40),T.MathUtils.clamp(v.z,-.40,.40));
    const normal=v.clone().sub(inner).normalize();v.copy(inner).addScaledVector(normal,.10);p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  g.computeBoundingSphere();return g;
}
function leafGeometry(){
  const p=[],uv=[],indices=[],segments=7;
  for(let i=0;i<=segments;i++){
    const t=i/segments,w=Math.sin(Math.PI*t)*.5;
    for(const side of [-1,1]){p.push(side*w,t-.5,Math.sin(Math.PI*t)*.17+side*side*w*.16);uv.push(side<0?0:1,t);}
  }
  for(let i=0;i<segments;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
const lathe=(profile,segments=24)=>new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),segments);
const BOX=new T.BoxGeometry(1,1,1),CYLINDER=new T.CylinderGeometry(.5,.5,1,24),SPHERE=new T.SphereGeometry(.5,24,14),CONE=new T.ConeGeometry(.5,1,7),TORUS=new T.TorusGeometry(.5,.018,8,48);
const GEOMETRIES={box:BOX,cylinder:CYLINDER,sphere:SPHERE,cone:CONE,torus:TORUS,rounded:roundedBox(5),leaf:leafGeometry(),plane:new T.PlaneGeometry(1,1),
  pot:lathe([[0,-.5],[.32,-.5],[.38,-.46],[.49,.40],[.50,.48],[.46,.50],[.44,.43],[.38,-.37],[0,-.37]]),
  vase:lathe([[0,-.5],[.27,-.5],[.43,-.4],[.5,-.1],[.46,.13],[.22,.33],[.19,.48],[.17,.5],[.14,.48],[.15,.30],[.39,.05],[.4,-.25],[.24,-.41],[0,-.41]]),
  pouf:lathe([[0,-.5],[.36,-.5],[.45,-.40],[.49,-.18],[.50,.13],[.47,.35],[.40,.47],[.28,.5],[0,.5]]),
  cup:lathe([[0,-.5],[.32,-.5],[.43,-.44],[.5,.43],[.49,.5],[.43,.5],[.40,.36],[.34,-.32],[0,-.32]],20)};
const LOW_GEOMETRIES={rounded:roundedBox(3),cylinder:new T.CylinderGeometry(.5,.5,1,12),sphere:new T.IcosahedronGeometry(.5,1),torus:new T.TorusGeometry(.5,.018,6,24)};
const SHARED_GEOMETRIES=new Set([...Object.values(GEOMETRIES),...Object.values(LOW_GEOMETRIES)]);
const c=new T.Color();

export function createMaterials(){
  const tex=createTextureSet(),std=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.75,...extra});
  const oak={map:tex.wood,bumpMap:tex.woodHeight,bumpScale:.013,roughnessMap:tex.woodRoughness,roughness:.84};
  return {
    wood:std('#ffffff',{...oak,map:tex.floor,vertexColors:true,side:T.DoubleSide}),
    timber:std('#ffffff',oak),wall:std('#ffffff',{...oak,vertexColors:true,side:T.DoubleSide}),
    white:std('#eeeadd',{roughness:.53}),dark:std('#455349',{roughness:.43}),
    metal:std('#ffffff',{metalness:.78,roughness:.30,envMapIntensity:.8}),
    ceramic:std('#ffffff',{roughness:.26,metalness:.04}),paper:std('#eee8d7',{roughness:.96}),
    fabric:std('#ffffff',{map:tex.textile,bumpMap:tex.textileHeight,bumpScale:.011,roughness:.94}),
    felt:new T.MeshPhysicalMaterial({color:'#ffffff',map:tex.wool,bumpMap:tex.woolHeight,bumpScale:.028,roughness:.98,sheen:.72,sheenColor:new T.Color('#e6dfca'),sheenRoughness:.93}),
    woodfelt:std('#ffffff',{map:tex.woodfelt,bumpMap:tex.woodfeltHeight,bumpScale:.035,roughness:1}),
    glass:std('#acc4bd',{transparent:true,opacity:.13,roughness:.12,metalness:.3,depthWrite:false,side:T.DoubleSide}),
    roofglass:std('#c5d6c8',{transparent:true,opacity:.21,metalness:.2,roughness:.16,side:T.DoubleSide,depthWrite:false}),
    stone:std('#ffffff',{map:tex.stone,roughness:.78}),leaves:std('#ffffff',{roughness:.87,side:T.DoubleSide}),soil:std('#776e52'),
    light:new T.MeshBasicMaterial({color:'#ffe3ac',toneMapped:false}),
    screen:new T.MeshBasicMaterial({map:tex.screen,color:'#ffffff',toneMapped:false}),
    label:new T.MeshBasicMaterial({map:tex.label,color:'#ffffff',toneMapped:false,side:T.DoubleSide}),
    contact:new T.MeshBasicMaterial({map:tex.contact,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1}),
    cyan:new T.MeshBasicMaterial({color:'#abc6b3',toneMapped:false})
  };
}

class Batch {
  constructor(materials){this.materials=materials;this.instances=new Map();this.surfaces=new Map();}
  instance(geometry,material,category,pos,scale,color,rotation=0,quaternion=null){
    const key=`${geometry}:${material}:${category}`;
    if(!this.instances.has(key))this.instances.set(key,{geometry,material,category,items:[]});
    tmp.position.set(...pos);tmp.scale.set(...scale);tmp.rotation.set(0,rotation,0);if(quaternion)tmp.quaternion.copy(quaternion);tmp.updateMatrix();
    this.instances.get(key).items.push({matrix:tmp.matrix.clone(),color:color||'#ffffff'});
  }
  box(material,category,pos,scale,color,rotation=0){this.instance('box',material,category,pos,scale,color,rotation);}
  beam(material,category,a,b,width,color,depth=width){const va=new T.Vector3(...a),vb=new T.Vector3(...b),dir=vb.clone().sub(va);this.instance('box',material,category,va.add(vb).multiplyScalar(.5).toArray(),[width,dir.length(),depth],color,0,new T.Quaternion().setFromUnitVectors(Y,dir.normalize()));}
  cylinder(material,category,pos,scale,color,rotation=0){this.instance('cylinder',material,category,pos,scale,color,rotation);}
  sphere(material,category,pos,scale,color){this.instance('sphere',material,category,pos,scale,color);}
  tri(material,category,a,b,d,color,room=-1){
    const key=`${material}:${category}`;if(!this.surfaces.has(key))this.surfaces.set(key,{material,category,p:[],uv:[],colors:[],rooms:[]});
    const s=this.surfaces.get(key);c.set(color||'#ffffff');for(const v of [a,b,d]){s.p.push(...v);s.uv.push((v[0]+v[1]*.13)/3,(v[2]+v[1]*.7)/3);s.colors.push(c.r,c.g,c.b);}s.rooms.push(room);
  }
  label(pos,scale,rotation,id){
    const cs=Math.cos(rotation),sn=Math.sin(rotation),p=(x,y)=>[pos[0]+x*cs,pos[1]+y,pos[2]-x*sn];
    this.quad('label','micro',p(-scale[0]/2,-scale[1]/2),p(scale[0]/2,-scale[1]/2),p(scale[0]/2,scale[1]/2),p(-scale[0]/2,scale[1]/2),'#ffffff');
    const b=this.surfaces.get('label:micro'),u=(id%20)/20,v=1-(Math.floor(id/20)+1)/18,du=1/20,dv=1/18;
    b.uv.splice(b.uv.length-12,12,u,v,u+du,v,u+du,v+dv,u,v,u+du,v+dv,u,v+dv);
  }
  quad(material,category,a,b,d,e,color,room=-1){this.tri(material,category,a,b,d,color,room);this.tri(material,category,a,d,e,color,room);}
  polygon(material,category,poly,y,color,room=-1){const center=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,y,a[2]+p[1]/poly.length],[0,y,0]);for(let i=0;i<poly.length;i++){let a=poly[i],b=poly[(i+1)%poly.length];this.tri(material,category,[b[0],y,b[1]],[a[0],y,a[1]],center,color,room);}}
  finish(){
    const root=new T.Group(),categories={};const pickables=[];
    const group=key=>categories[key]||(categories[key]=new T.Group());
    for(const b of this.instances.values()){
      const geometry=GEOMETRIES[b.geometry];
      const mesh=new T.InstancedMesh(geometry,this.materials[b.material],b.items.length);
      b.items.forEach((o,i)=>{mesh.setMatrixAt(i,o.matrix);mesh.setColorAt(i,c.set(o.color));});
      mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      mesh.userData.highGeometry=geometry;mesh.userData.lowGeometry=LOW_GEOMETRIES[b.geometry]||geometry;
      mesh.castShadow=!['light','screen','label','contact','glass','roofglass'].includes(b.material)&&b.category!=='micro';mesh.receiveShadow=b.category!=='micro'&&b.material!=='contact';mesh.computeBoundingSphere();group(b.category).add(mesh);
    }
    for(const b of this.surfaces.values()){
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(b.p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(b.colors,3));geo.computeVertexNormals();
      const mesh=new T.Mesh(geo,this.materials[b.material]);mesh.castShadow=!['glass','roofglass','label','contact','light'].includes(b.material)&&b.category!=='micro';mesh.receiveShadow=b.material!=='label';mesh.userData.rooms=b.rooms;
      group(b.category).add(mesh);if(b.rooms.some(n=>n>=0))pickables.push(mesh);
    }
    for(const [name,g] of Object.entries(categories)){g.name=name;root.add(g);}
    return {root,categories,pickables};
  }
}

const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);


function addHero(batch,room,detail=false){
  const hero=room.hero,rand=rng(hero.seed),anchor=getHeroAnchor(room),s=anchor.scale;
  const ax=anchor.x,az=anchor.z;
  const normal=new T.Vector2(room.center[0]-ax,room.center[1]-az).normalize(),right=[normal.y,-normal.x],rotation=Math.atan2(normal.x,normal.y),base=.51;
  const at=(x,y,z)=>[ax+(x*right[0]+z*normal.x)*s,base+y*s,az+(x*right[1]+z*normal.y)*s];
  const box=(mat,x,y,z,w,h,d,color,angle=0)=>batch.box(mat,'furniture',at(x,y,z),[w*s,h*s,d*s],color,rotation+angle);
  const sphere=(mat,x,y,z,d,color)=>batch.sphere(mat,'furniture',at(x,y,z),[d*s,d*s,d*s],color);
  const beam=(mat,a,b,width,color)=>batch.beam(mat,'furniture',at(...a),at(...b),width*s,color);
  const ring=(mat,x,y,z,diameter,tilt,color)=>batch.instance('torus',mat,'furniture',at(x,y,z),[diameter*s,diameter*s,diameter*s],color,0,new T.Quaternion().setFromEuler(new T.Euler(tilt[0],tilt[1],tilt[2])));
  const wood=room.wood.color,accent=room.accent;
  batch.instance('rounded','stone','furniture',at(0,.08,0),[1.19*s,.16*s,.74*s],'#ded9c5',rotation);
  box('metal',0,.17,0,1.06,.022,.62,'#a9946e');
  box('light',0,.026,0,.99,.012,.56);
  batch.label(at(0,.095,.377),[.34*s,.105*s],rotation,room.id);
  for(const x of [-.50,.50])for(const z of [-.27,.27]){
    batch.cylinder('metal','micro',at(x,.189,z),[.027*s,.009*s,.027*s],'#c9bd93');
    box('dark',x,.195,z,.016,.002,.002,'#515e53');
  }
  // Six visible height-coded light blocks guarantee different geometry within each family.
  for(let k=0;k<6;k++){const bit=(hero.variant>>k)&1;box(bit?'light':'metal',-.45+k*.18,.19+bit*.035,.30,.10,.025+bit*.07,.06);}
  switch(hero.type){
    case 0:
      box('timber',0,.85,-.12,1.22,1.20,.11,wood);
      for(let y=0;y<5;y++)for(let x=0;x<6;x++){
        const encoded=y===0?((hero.variant>>x)&1):null,depth=encoded===null?.04+rand()*.22:.05+encoded*.18;
        box((x+y)%7===0?'light':'fabric',-.48+x*.19,.40+y*.20,-.04+depth*.5,.15,.16,depth,(x+y)%3?accent:'#e4dfcd');
      }break;
    case 1:
      beam('metal',[0,.2,0],[0,1.22,0],.035);
      for(let k=0;k<3;k++)ring('light',0,.58+k*.26,0,.65+k*.10,[Math.PI/2+(rand()-.5)*1.6,(rand()-.5)*2,rand()*Math.PI]);
      sphere('fabric',0,.85,0,.17,accent);break;
    case 2:{
      const count=3+hero.variant%4;
      for(let k=0;k<count;k++){const angle=k*2.4+rand()*.6,radius=k===0?0:.18+rand()*.16,h=.44+rand()*.8;batch.instance('cone','fabric','furniture',at(Math.cos(angle)*radius,.20+h*.5,Math.sin(angle)*radius),[.24*s,h*s,.24*s],k%2?accent:'#d5d8ca',rotation+angle);}
      box('light',0,.19,0,.95,.025,.58);break;}
    case 3:{
      const count=9+hero.variant%5,phase=rand()*6.28,frequency=1.0+rand()*2.1;
      for(let k=0;k<count;k++){const x=-.47+k*.94/(count-1),h=.46+.58*(.5+.5*Math.sin(k/(count-1)*Math.PI*frequency+phase));box('timber',x,.20+h*.5,Math.sin(k*.6+phase)*.12,.048,h,.19,wood);box('light',x,.20+h,.105+Math.sin(k*.6+phase)*.12,.035,.022,.022);}
      break;}
    case 4:
      beam('metal',[0,.20,0],[0,1.0,0],.026);
      for(let k=0;k<2;k++)ring('metal',0,.78,0,.90+k*.2,[Math.PI/2+rand()*.7,rand()*Math.PI,rand()*Math.PI],'#66786a');
      for(let k=0;k<4;k++){const a=rand()*Math.PI*2; sphere(k===0?'light':'fabric',Math.cos(a)*.40,.60+rand()*.44,Math.sin(a)*.27,.12+rand()*.10,k%2?accent:'#e3dfcf');}break;
    case 5:{
      const count=7+hero.variant%6,twist=.42+rand()*.50;
      beam('metal',[0,.2,0],[0,1.38,0],.025);
      for(let k=0;k<count;k++){const a=k*twist+hero.variant*.3,x=Math.cos(a)*.24,z=Math.sin(a)*.24,y=.28+k*1.0/count;box('timber',x,y,z,.43,.055,.20,wood,a);box('light',x,y+.036,z,.30,.014,.15);}
      break;}
    case 6:
      for(let z=0;z<4;z++)for(let x=0;x<5;x++){const h=.13+Math.pow(rand(),1.3)*.95;box('fabric',-.42+x*.21,.20+h*.5,-.22+z*.15,.16,h,.11,(x+z)%3?accent:'#d9d2b9');if((x+z)%4===0)box('light',-.42+x*.21,.21+h,-.22+z*.15,.12,.018,.08);}
      break;
    case 7:{
      box('timber',0,.84,-.10,1.20,1.18,.07,wood);
      const stars=Array.from({length:9},(_,k)=>[-.43+(k%3)*.42+(rand()-.5)*.10,.38+Math.floor(k/3)*.32+(rand()-.5)*.10,.01]);
      stars.forEach((p,k)=>{sphere(k%2?'light':'cyan',...p,.055+rand()*.025);if(k>0)beam('light',stars[Math.max(0,k-1-(hero.variant%2))],p,.012);});break;}
    case 8:
      for(let k=0;k<4;k++){
        const a=(rand()-.5)*.7,x=(rand()-.5)*.28,y=.29+k*.27,w=.60+rand()*.35;
        box('timber',x,y,-.03,w,.055,.42,wood,a);box('white',x-w*.43,y+.12,-.03,.06,.24,.39,null,a);box('white',x+w*.43,y+.12,-.03,.06,.24,.39,null,a);box('light',x,y+.04,.15,w*.75,.015,.025,null,a);
        sphere('fabric',x,.40+k*.27,.02,.12+rand()*.06,accent);
      }break;
  }
  // Fine etched scale marks and an individual atlas plaque exist in every module.
  for(let k=0;k<12;k++)batch.box('metal','micro',at(-.48+k*.087,.194,.29),[.005*s,.004*s,(k%3===0?.042:.023)*s],'#c1b28b',rotation);
  if(hero.type===0||hero.type===7)for(const x of [-.56,.56]){
    batch.beam('metal','micro',at(x,.23,-.055),at(x,1.39,-.055),.012*s,'#aa9469');
  }
  if(hero.type===2)for(let k=0;k<16;k++){const a=k*2.4,r=.1+rand()*.36;batch.sphere('stone','micro',at(Math.cos(a)*r,.22,Math.sin(a)*r),[.055*s,.035*s,.055*s],'#d6d1bc');}
}

function addRoom(batch,room,detail=false){
  const {poly,faces,id,seed}=room,wood=room.wood.color;
  const center=room.center,shrink=.965;
  const points=poly.map(p=>[center[0]+(p[0]-center[0])*shrink,center[1]+(p[1]-center[1])*shrink]);
  const floor=.46,top=floor+ROOM_HEIGHT;
  batch.polygon('wood','floor',points,floor,wood,id);
  batch.polygon('stone','structure',points,.25,'#d3cfbd',id);
  const roofCenter=[center[0],top,center[1]];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],a3=[a[0],floor,a[1]],b3=[b[0],floor,b[1]],at=[a[0],top,a[1]],bt=[b[0],top,b[1]];
    batch.quad('wall','floor',a3,b3,[b[0],.25,b[1]],[a[0],.25,a[1]],'#af9572',id);
    batch.beam('timber','structure',a3,b3,.15,wood,.21);
    if(faces===4){
      batch.tri(i===0?'wall':'glass','skin',a3,b3,roofCenter,i===0?wood:null,id);
      batch.beam('timber','roof',a3,roofCenter,.14,wood);
      const m=mix(a3,b3,.5);batch.beam('timber','roof',m,roofCenter,.055,wood);
      batch.beam('light',detail?'ceiling':'furniture',mix(a3,roofCenter,.18),mix(b3,roofCenter,.18),.025,null);
    }else {
      batch.beam('timber','structure',a3,at,.13,wood);
      batch.beam('timber','roof',at,bt,.18,wood,.24);
      // A solid service wall alternates with full-height glazing.
      if(i===seed%points.length){
        batch.quad('wall','skin',a3,b3,bt,at,wood,id);
        const wallMid=mix(a3,b3,.5),nx=center[0]-wallMid[0],nz=center[1]-wallMid[2],nl=Math.hypot(nx,nz),angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
        for(let k=0;k<3;k++){
          const pos=mix(a3,b3,.27+k*.23);pos[0]+=nx/nl*.055;pos[2]+=nz/nl*.055;pos[1]=2.15;
          batch.instance('rounded',k===1?'felt':'woodfelt','skin',pos,[.82,.94,.055],k===1?room.accent:'#c4b18e',angle);
          batch.box('metal',detail?'skin':'micro',[pos[0],pos[1]-.50,pos[2]],[.12,.013,.06],'#b6a37f',angle);
        }
        const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
        for(let k=1;k<len/.25;k++){
          const u=k/(Math.floor(len/.25)+1),p=mix(a3,b3,u),pt=[p[0],top,p[2]];
          batch.beam('timber','skin',[p[0],floor+.06,p[2]],pt,.026,'#bda57d',.03);
        }
      }else {
        batch.quad('glass','skin',a3,b3,bt,at,null,id);
        const m=mix(a3,b3,.5);batch.beam('metal',detail?'glazingframe':'skin',m,[m[0],top,m[2]],.035,null);
        batch.beam('timber','structure',[a[0],floor+.14,a[1]],[b[0],floor+.14,b[1]],.065,wood);
      }
      // Roof surfaces alternate wood and clear skylight facets.
      if(i%2===0)batch.tri('wall','roof',at,bt,roofCenter,wood,id);
      else batch.tri('roofglass','roof',at,bt,roofCenter,null,id);
      batch.beam('timber','roof',at,roofCenter,.065,wood);
      // Ceiling-side warm lines remain when the upper skin is opened.
      batch.beam('light','roof',mix(at,roofCenter,.16),mix(bt,roofCenter,.16),.035,null);
    }
  }
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    const inset=p=>[center[0]+(p[0]-center[0])*.974,floor+.012,center[1]+(p[1]-center[1])*.974];
    batch.beam('metal','micro',inset(a),inset(b),.014,'#b39b6e',.008);
    for(const p of [mix([a[0],floor+.038,a[1]],[b[0],floor+.038,b[1]],.06),mix([a[0],floor+.038,a[1]],[b[0],floor+.038,b[1]],.94)]){
      batch.cylinder('metal','micro',p,[.045,.009,.045],'#756f58');
    }
  }
  addFurniture(batch,room,detail);
  addHero(batch,room,detail);
  // Some modules host a small roof garden; each is fixed to its own seed.
  if(faces!==4&&seed%6===0){
    const p=points[0],x=center[0]+(p[0]-center[0])*.44,z=center[1]+(p[1]-center[1])*.44;
    batch.box('timber','roof',[x,top+.14,z],[.8,.25,.65],wood,-room.rotation);
    batch.sphere('leaves','roof',[x,top+.42,z],[.75,.49,.62],'#8c9a78');
  }
}

export function buildHabitat(rooms,materials){
  const layers=[],pickables=[],root=new T.Group();
  for(let l=0;l<LEVELS;l++){
    const batch=new Batch(materials);rooms.filter(r=>r.level===l).forEach(r=>addRoom(batch,r));
    const layer=batch.finish();layer.root.position.y=l*LEVEL_HEIGHT;root.add(layer.root);layers.push(layer);pickables.push(...layer.pickables);
  }
  root.updateMatrixWorld(true);return {root,layers,pickables};
}
export function buildRoom(room,materials){
  const localRoom={...room,center:[0,0],poly:room.local.map(p=>p.slice())};
  const batch=new Batch(materials);addRoom(batch,localRoom,true);const result=batch.finish();
  if(result.categories.roof)result.categories.roof.visible=room.faces===4;
  if(result.categories.glazingframe)result.categories.glazingframe.visible=false;
  // Keep the service wall, but remove the glazing for an unobstructed model view.
  if(result.categories.skin)for(const m of result.categories.skin.children)if(m.material===materials.glass)m.visible=false;
  return result;
}

export function buildLandscape(radius,materials){
  const batch=new Batch(materials),root=new T.Group();
  const base=new T.Mesh(new T.CylinderGeometry(radius*1.03,radius*1.04,.28,6),materials.stone);
  base.rotation.y=Math.PI/6;base.position.y=-.03;base.receiveShadow=true;root.add(base);
  // The plaza stays clear beneath the inclined core and the two side columns.
  for(let j=0;j<4;j++){
    const tx=(j%2?1:-1)*radius*.64,tz=(j<2?1:-1)*radius*.49;
    batch.cylinder('stone','garden',[tx,.22,tz],[3.9,.22,3.9],'#d1d2c1');
    batch.cylinder('leaves','garden',[tx,.35,tz],[3.5,.08,3.5],'#a7b092');
    batch.box('timber','garden',[tx,.43,tz+2.3],[3.3,.28,.6],'#c6ae87');
    batch.beam('timber','garden',[tx,.2,tz],[tx+.17,2.5,tz],.16,'#968367');
    for(let k=0;k<5;k++){let a=k*2.4;batch.sphere('leaves','garden',[tx+Math.cos(a)*.6,2.3+k*.22,tz+Math.sin(a)*.65],[1.8,1.1,1.6],['#809475','#91a282','#7e9279'][k%3]);}
  }
  batch.box('stone','garden',[-4,.20,radius*.34],[4.5,.12,radius*.62],'#deded0');
  const deco=batch.finish();root.add(deco.root);return root;
}

export function buildStructure(rooms,materials){
  const batch=new Batch(materials),plan=getSupportPlan(rooms),wood='#ad865a',steel='#59685f';
  const {envelope,columns,core}=plan;
  // These are a connected architectural load-path concept, not a strength simulation.
  const coreCorners=[[-core.halfWidth,-core.halfWidth],[core.halfWidth,-core.halfWidth],[core.halfWidth,core.halfWidth],[-core.halfWidth,core.halfWidth]];
  batch.box('stone','core',[0,.22,0],[5.2,.70,5.2],'#c4c7b9');
  coreCorners.forEach(([x,z])=>batch.beam('timber','core',[x,.42,z],[x,core.height,z],.34,wood));
  for(let l=0;l<LEVELS;l++){
    const y=l*LEVEL_HEIGHT+.18;
    for(let i=0;i<4;i++){
      const a=coreCorners[i],b=coreCorners[(i+1)%4];batch.beam('timber','core',[a[0],y,a[1]],[b[0],y,b[1]],.22,wood);
      if(l<LEVELS-1)batch.beam('metal','core',[a[0],y,a[1]],[b[0],y+LEVEL_HEIGHT,b[1]],.065,steel);
    }
    // Stepped internal landings indicate a continuous vertical circulation core.
    batch.box('stone','core',[0,y+.10,0],[2.4,.14,2.4],'#bfc3b4');
    if(l<LEVELS-1)for(let flight=0;flight<2;flight++)for(let j=0;j<12;j++)batch.box('timber','core',[flight?.65:-.65,y+.2+(flight*12+j)*LEVEL_HEIGHT/24,flight?1-j*.17:-1+j*.17],[1.0,.11,.22],'#c1a47d');
  }
  // Exactly two added side columns have their own expressed footings.
  for(const p of columns){
    batch.box('stone','columns',[p.x,.20,p.z],[3.4,.75,3.4],'#b9c0af');
    batch.beam('timber','columns',[p.x,.45,p.z],[p.x,p.top,p.z],1.02,'#a48053',1.02);
    batch.box('metal','columns',[p.x,p.top-.08,0],[1.24,.27,1.24],steel);
    for(let y=3;y<p.top;y+=3.85)batch.box('metal','columns',[p.x,y,0],[1.065,.10,1.065],steel);
    batch.box('light','columns',[p.x+.53,p.top*.5,.02],[.025,p.top-.6,.04]);
  }
  for(const e of envelope){
    // Floor collectors and secondary beams connect every occupied module to the core.
    const depth=Math.max(3.2,(e.maxZ-e.minZ)*.26),zc=(e.minZ+e.maxZ)/2;
    const floorRooms=rooms.filter(r=>r.level===e.level);
    const spanAt=z=>{
      const xs=[];
      for(const r of floorRooms)for(let i=0;i<r.poly.length;i++){
        const a=r.poly[i],b=r.poly[(i+1)%r.poly.length];
        if(z>=Math.min(a[1],b[1])&&z<=Math.max(a[1],b[1])){
          if(Math.abs(b[1]-a[1])<.0001)xs.push(a[0],b[0]);
          else xs.push(a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]));
        }
      }
      return xs.length?[Math.min(...xs),Math.max(...xs)]:[e.minX,e.maxX];
    };
    const collectors=[zc-depth,zc+depth].map(z=>({z,span:spanAt(z)}));
    for(const {z,span} of collectors){
      batch.beam('timber','floorgirders',[span[0],e.y-.14,z],[span[1],e.y-.14,z],.32,wood,.32);
      batch.beam('metal','floorgirders',[0,e.y-.14,0],[T.MathUtils.clamp(0,...span),e.y-.14,z],.22,steel);
    }
    for(const r of floorRooms){
      const target=collectors.reduce((a,b)=>Math.abs(r.center[1]-a.z)<Math.abs(r.center[1]-b.z)?a:b);
      batch.beam('timber','floorgirders',[r.center[0],e.y-.14,r.center[1]],[T.MathUtils.clamp(r.center[0],...target.span),e.y-.14,target.z],.19,wood,.25);
    }
  }
  // A deep hybrid truss at the widest storey distributes the large cantilevers.
  const middle=envelope[4],x0=columns[0].x,x1=columns[1].x,y0=middle.y-LEVEL_HEIGHT,y1=middle.y;
  const zWidth=1.0,zCenter=0;
  for(const z of [zCenter-zWidth,zCenter+zWidth]){
    batch.beam('timber','transfer',[x0,y0,z],[x1,y0,z],.42,wood,.42);
    batch.beam('timber','transfer',[x0,y1,z],[x1,y1,z],.42,wood,.42);
    const divisions=12;
    for(let i=0;i<=divisions;i++){
      const x=x0+(x1-x0)*i/divisions;
      batch.beam('metal','transfer',[x,y0,z],[x,y1,z],.12,steel);
      if(i<divisions){const nx=x0+(x1-x0)*(i+1)/divisions;batch.beam('metal','transfer',[x,i%2?y1:y0,z],[nx,i%2?y0:y1,z],.13,steel);}
    }
    batch.beam('light','transfer',[x0,y1+.08,z+.04],[x1,y1+.08,z+.04],.027,null);
  }
  for(const p of columns)batch.beam('timber','transfer',[p.x,p.top,zCenter-zWidth],[p.x,p.top,zCenter+zWidth],.48,wood,.44);
  // Four continuous edge ribs draw the inclined diamond and tie floors together.
  for(const side of [-1,1])for(const front of [-1,1]){
    for(let l=0;l<LEVELS-1;l++){
      const a=envelope[l],b=envelope[l+1];
      const node=e=>{const points=rooms.filter(r=>r.level===e.level).flatMap(r=>r.poly);const chosen=points.reduce((best,p)=>p[0]*side*.65+p[1]*front>best[0]*side*.65+best[1]*front?p:best);return [chosen[0],e.y,chosen[1]];};
      const pa=node(a),pb=node(b);batch.beam('timber','diagrid',pa,pb,.27,'#99764e');
      batch.beam('light','diagrid',[pa[0]+side*.15,pa[1],pa[2]],[pb[0]+side*.15,pb[1],pb[2]],.025,null);
    }
  }
  const result=batch.finish();result.plan=plan;result.root.userData.extraColumns=2;result.root.userData.strengthAnalysis='NOT_ANALYSED';return result;
}

export function setModelDetail(model,high=true,micro=true){
  const key=`${high}:${micro}`;if(model.root.userData.detailState===key)return;model.root.userData.detailState=key;
  if(model.categories.micro)model.categories.micro.visible=micro;
  model.root.traverse(o=>{if(o.isInstancedMesh&&o.userData.highGeometry)o.geometry=high?o.userData.highGeometry:o.userData.lowGeometry;});
}
export function disposeModel(root){root.traverse(obj=>{if(obj.isInstancedMesh){obj.dispose();}else if(obj.isMesh&&!SHARED_GEOMETRIES.has(obj.geometry)){obj.geometry.dispose();}});}
