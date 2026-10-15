import * as T from './vendor/three.module.min.js';
import {rng} from './layout.js';

// Close-view assets are shared by all suites, but never applied to the distant
// habitat. Normal/roughness maps use non-colour data; albedo uses sRGB.
function texture(canvas,color=false){
  const t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;
  t.anisotropy=16;if(color)t.colorSpace=T.SRGBColorSpace;return t;
}
function canvas(n){const c=document.createElement('canvas');c.width=c.height=n;return c;}
function pack(n,draw,strength=2){
  const image=canvas(n),ctx=image.getContext('2d',{willReadFrequently:true});draw(ctx,n);
  const pixels=ctx.getImageData(0,0,n,n),height=new Float32Array(n*n);
  for(let i=0;i<height.length;i++)height[i]=(pixels.data[i*4]*.2126+pixels.data[i*4+1]*.7152+pixels.data[i*4+2]*.0722)/255;
  const normals=canvas(n),nc=normals.getContext('2d'),np=nc.createImageData(n,n);
  const rough=canvas(n),rc=rough.getContext('2d'),rp=rc.createImageData(n,n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x,j=i*4,dx=(height[y*n+(x+n-1)%n]-height[y*n+(x+1)%n])*strength;
    const dy=(height[((y+n-1)%n)*n+x]-height[((y+1)%n)*n+x])*strength;
    const inv=1/Math.hypot(dx,dy,1);
    np.data[j]=(dx*inv*.5+.5)*255;np.data[j+1]=(-dy*inv*.5+.5)*255;np.data[j+2]=(inv*.5+.5)*255;np.data[j+3]=255;
    const r=192+height[i]*54;rp.data[j]=rp.data[j+1]=rp.data[j+2]=r;rp.data[j+3]=255;
  }
  nc.putImageData(np,0,0);rc.putImageData(rp,0,0);
  return {map:texture(image,true),normalMap:texture(normals),roughnessMap:texture(rough)};
}
function oak(ctx,n){
  const r=rng(85021),im=ctx.createImageData(n,n),tau=Math.PI*2;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n,v=y/n;
    const bend=Math.sin(v*tau)*.012+Math.sin(v*tau*3)*.003;
    const grain=Math.sin((u+bend)*tau*68+Math.sin(v*tau*2)*.7);
    const late=Math.pow(.5+.5*Math.sin((u+bend)*tau*34+Math.sin(v*tau)*1.1),9);
    const pore=Math.pow(Math.max(0,Math.sin((u+bend)*tau*321+Math.sin(v*tau*4)*.8)),22);
    const ray=Math.pow(Math.max(0,Math.sin(v*tau*109+u*14)),32)*Math.sin(u*tau*11);
    const shade=grain*4.5-late*18-pore*(6+5*Math.sin(v*tau*79))+ray*5+(r()-.5)*5;
    const i=(y*n+x)*4;im.data[i]=242+shade;im.data[i+1]=233+shade*1.1;im.data[i+2]=211+shade*1.2;im.data[i+3]=255;
  }ctx.putImageData(im,0,0);
}
function felt(ctx,n,woody=false){
  const r=rng(woody?59024:41795);ctx.fillStyle=woody?'#ded0b6':'#e0ddd4';ctx.fillRect(0,0,n,n);ctx.lineCap='round';
  const count=woody?85000:240000;
  for(let k=0;k<count;k++){
    const x=r()*n,y=r()*n,a=r()*Math.PI*2,l=(woody?7:2)+r()*(woody?39:13);
    ctx.lineWidth=woody?.7+r()*1.8:.4+r()*.9;
    ctx.strokeStyle=k%4===0?(woody?'rgba(255,248,221,.65)':'rgba(255,254,246,.61)'):(woody?'rgba(105,77,41,.19)':'rgba(80,80,69,.15)');
    for(const dx of [-n,0,n])for(const dy of [-n,0,n]){
      if(x+dx<-l||x+dx>n+l||y+dy<-l||y+dy>n+l)continue;
      ctx.beginPath();ctx.moveTo(x+dx,y+dy);ctx.quadraticCurveTo(x+dx+Math.cos(a+.5)*l*.5,y+dy+Math.sin(a+.5)*l*.5,x+dx+Math.cos(a)*l,y+dy+Math.sin(a)*l);ctx.stroke();
    }
  }
}

export function createCraftMaterials(base){
  const result=Object.fromEntries(Object.entries(base).map(([k,m])=>[k,m.clone()]));
  const wood=pack(2048,oak,3.2),wool=pack(2048,(ctx,n)=>felt(ctx,n),6.5),woodfelt=pack(1024,(ctx,n)=>felt(ctx,n,true),3.8);
  const linen=pack(1024,(ctx,n)=>{
    ctx.fillStyle='#e8e5d9';ctx.fillRect(0,0,n,n);const r=rng(5729);
    for(let k=0;k<n;k+=3){ctx.strokeStyle=k%2?'rgba(255,255,245,.5)':'rgba(110,107,90,.15)';ctx.lineWidth=.7+r();ctx.beginPath();ctx.moveTo(k,0);ctx.lineTo(k,n);ctx.moveTo(0,k);ctx.lineTo(n,k);ctx.stroke();}
  },2.8);
  const end=pack(1024,(ctx,n)=>{
    const im=ctx.createImageData(n,n),r=rng(3719);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const a=Math.atan2(y-n*.56,x+n*.18),d=Math.hypot((x+n*.18)*.85,y-n*.56),g=Math.sin(d*.22+Math.sin(a*7)*2.5),p=Math.pow(Math.max(0,Math.sin(d*1.8)),18);
      const h=g*9-p*9+(r()-.5)*5,i=(y*n+x)*4;im.data[i]=235+h;im.data[i+1]=217+h;im.data[i+2]=184+h;im.data[i+3]=255;
    }ctx.putImageData(im,0,0);
  },2.1);
  const finish=(key,maps,extra={})=>{Object.assign(result[key],{...maps,bumpMap:null,normalScale:new T.Vector2(.7,.7),...extra});result[key].needsUpdate=true;};
  for(const key of ['wood','wall','timber'])finish(key,wood,{roughness:.77});
  finish('woodend',end,{roughness:.82});finish('fabric',linen,{roughness:.98});
  finish('felt',wool,{normalScale:new T.Vector2(.9,.9),roughness:.99,sheen:1,sheenRoughness:.94,sheenColor:new T.Color('#eee8dc')});
  finish('cloth',wool,{normalScale:new T.Vector2(.9,.9),roughness:.99,sheen:1});
  finish('woodfelt',woodfelt,{roughness:1,normalScale:new T.Vector2(.8,.8)});
  result.metal.roughness=.24;result.ceramic.roughness=.20;
  result.label.userData.singlePlaque=true;result.label.map=null;
  result._textures=[...new Set([wood,wool,woodfelt,linen,end].flatMap(p=>Object.values(p)))];
  return result;
}

export function createRoomPlaque(room){
  const c=canvas(1024);c.height=320;const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,320);g.addColorStop(0,'#ded3b2');g.addColorStop(.5,'#c5b38b');g.addColorStop(1,'#e3d8b9');ctx.fillStyle=g;ctx.fillRect(0,0,1024,320);
  ctx.strokeStyle='#91815f';ctx.lineWidth=3;ctx.strokeRect(10,10,1004,300);
  ctx.fillStyle='#35473d';ctx.font='500 87px sans-serif';ctx.fillText(`W / ${String(room.id+1).padStart(4,'0')}`,42,118);
  ctx.font='32px sans-serif';ctx.fillText(room.hero.name,46,184);ctx.fillRect(45,211,932,2);
  ctx.font='22px monospace';ctx.fillText(`WOODWEAVE  /  ATELIER 05  /  ${room.level+1}F`,46,264);
  for(let k=0;k<28;k++){const bit=(room.hero.seed>>>(k%30))&1;ctx.fillRect(760+k*7,49,bit?4:2,52+(k%3)*7);}
  const t=texture(c,true);t.wrapS=t.wrapT=T.ClampToEdgeWrapping;return t;
}
