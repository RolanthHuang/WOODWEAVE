import * as T from './vendor/three.module.min.js';
import {rng,DESIGN_ROOMS,LABEL_COLUMNS,LABEL_ROWS} from './layout.js';

// All surface images are generated locally. Colour and height maps use separate
// colour spaces, so the weave and wood pores also respond to the real lights.
function bitmap(size,draw,color=true){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  draw(canvas.getContext('2d'),size);
  const tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  if(color)tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;return tex;
}
function field(size,sample,color=true){return bitmap(size,(ctx,n)=>{
  const pixels=ctx.createImageData(n,n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const value=sample(x,y),i=(y*n+x)*4;
    const rgb=Array.isArray(value)?value:[value,value,value];
    pixels.data[i]=rgb[0];pixels.data[i+1]=rgb[1];pixels.data[i+2]=rgb[2];pixels.data[i+3]=255;
  }ctx.putImageData(pixels,0,0);
},color);}

export function createTextureSet(){
  const rand=rng(91275),n=512,heights=new Float32Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const bend=Math.sin(y*.012)*3.8+Math.sin(y*.041)*.8;
    const rings=Math.sin((x+bend)*.24)+.45*Math.sin((x+bend)*.77);
    const pores=Math.pow(Math.max(0,Math.sin(x*2.7+Math.sin(y*.035)*.8)),16);
    heights[y*n+x]=rings*3.5-pores*8+(rand()-.5)*4;
  }
  const wood=field(n,(x,y)=>{const h=heights[y*n+x];return [236+h,231+h,218+h];});
  const woodHeight=field(n,(x,y)=>126+heights[y*n+x]*2,false);
  const woodRoughness=field(n,(x,y)=>185+heights[y*n+x]*1.1,false);
  const floor=bitmap(1024,(ctx,n)=>{
    ctx.fillStyle='#ede7d8';ctx.fillRect(0,0,n,n);
    const row=128;
    for(let i=0;i<8;i++)for(let j=-1;j<3;j++){
      const x=j*512+(i%3)*170,y=i*row;
      ctx.drawImage(wood.image,x,y,512,row);
      ctx.fillStyle=`rgba(91,64,34,${.025+(i*7+j+6)%5*.008})`;ctx.fillRect(x,y,512,row);
      ctx.strokeStyle='rgba(62,45,27,.23)';ctx.lineWidth=1.3;ctx.strokeRect(x,y,512,row);
      ctx.strokeStyle='rgba(255,255,248,.48)';ctx.strokeRect(x+1.5,y+1.5,509,125);
    }
  });
  const textile=field(256,(x,y)=>{
    const weave=Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2)*8;
    const yarn=(Math.sin(x*.39)+Math.sin(y*.46))*2.5;
    return 231+weave+yarn+(rand()-.5)*8;
  });textile.repeat.set(5,5);
  const textileHeight=field(256,(x,y)=>126+Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2)*23+(rand()-.5)*5,false);textileHeight.repeat.set(5,5);
  const wool=bitmap(512,(ctx,n)=>{
    ctx.fillStyle='#dedbd1';ctx.fillRect(0,0,n,n);
    for(let k=0;k<23000;k++){
      const x=rand()*n,y=rand()*n,a=rand()*Math.PI*2,l=2+rand()*9;
      ctx.strokeStyle=k%3===0?'rgba(255,254,241,.38)':'rgba(86,83,66,.14)';ctx.lineWidth=.45+rand()*.55;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.cos(a+.4)*l*.5,y+Math.sin(a+.4)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);ctx.stroke();
    }
  });wool.repeat.set(2,2);
  const woolHeight=bitmap(512,(ctx,n)=>{ctx.drawImage(wool.image,0,0);},false);woolHeight.repeat.set(2,2);
  const woodfelt=bitmap(512,(ctx,n)=>{
    ctx.fillStyle='#ddd0b8';ctx.fillRect(0,0,n,n);
    for(let k=0;k<10500;k++){
      const x=rand()*n,y=rand()*n,a=rand()*Math.PI,l=4+rand()*24;
      ctx.strokeStyle=k%2?'rgba(100,74,40,.20)':'rgba(255,244,214,.55)';ctx.lineWidth=.65+rand()*1.3;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);ctx.stroke();
    }
  });woodfelt.repeat.set(2,2);
  const woodfeltHeight=bitmap(512,(ctx,n)=>ctx.drawImage(woodfelt.image,0,0),false);woodfeltHeight.repeat.set(2,2);
  const stone=field(256,(x,y)=>{
    const vein=Math.pow(Math.max(0,Math.sin(x*.055+y*.035+Math.sin(y*.06)*.7)),24);
    const v=234-vein*17+(rand()-.5)*7;return [v,v,v-3];
  });
  const screen=bitmap(512,(ctx,n)=>{
    const g=ctx.createLinearGradient(0,0,n,n);g.addColorStop(0,'#182e2c');g.addColorStop(1,'#24453e');ctx.fillStyle=g;ctx.fillRect(0,0,n,n);
    ctx.fillStyle='#cbdccd';ctx.font='500 19px sans-serif';ctx.fillText('W / LIVING SYSTEM',30,43);
    ctx.fillStyle='#7e9e8e';ctx.font='12px monospace';ctx.fillText('ENVIRONMENT / PERSONAL SPACE',30,69);
    ctx.strokeStyle='#58766b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(30,88);ctx.lineTo(482,88);ctx.stroke();
    ctx.fillStyle='#e7e8d2';ctx.font='300 72px sans-serif';ctx.fillText('23.5°',29,180);
    ctx.fillStyle='#95b2a0';ctx.font='13px monospace';ctx.fillText('COMFORT  /  OPTIMAL',34,207);
    for(let k=0;k<30;k++){
      const h=20+Math.sin(k*.42)*17+Math.cos(k*.8)*8;ctx.fillStyle=k>23?'#b9c6a5':'#648f7d';ctx.fillRect(34+k*14,288-h,7,h);
    }
    ctx.font='11px monospace';ctx.fillText('00:00',34,310);ctx.fillText('24:00',418,310);
    for(let k=0;k<3;k++){
      const y=355+k*52;ctx.fillStyle='#87a697';ctx.font='12px sans-serif';ctx.fillText(['LIGHT','AIR QUALITY','ENERGY'][k],34,y);
      ctx.fillStyle='#3a5a50';ctx.fillRect(178,y-7,260,4);ctx.fillStyle='#b1c4a6';ctx.fillRect(178,y-7,[196,233,149][k],4);
      ctx.beginPath();ctx.arc(178+[196,233,149][k],y-5,5,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='#759386';ctx.font='10px monospace';ctx.fillText('CONNECTED     •     WOODWEAVE HABITAT',34,489);
  });
  const contact=bitmap(128,(ctx,n)=>{
    const g=ctx.createRadialGradient(n/2,n/2,5,n/2,n/2,n/2);g.addColorStop(0,'rgba(33,35,25,.32)');g.addColorStop(.48,'rgba(33,35,25,.17)');g.addColorStop(1,'rgba(33,35,25,0)');ctx.fillStyle=g;ctx.fillRect(0,0,n,n);
  });
  const label=bitmap(2048,(ctx,n)=>{
    ctx.fillStyle='#c7bda1';ctx.fillRect(0,0,n,n);ctx.fillStyle='#3c4c43';
    // One shared atlas covers every plaque, including the four-digit room numbers.
    const cellWidth=n/LABEL_COLUMNS,cellHeight=n/LABEL_ROWS;
    for(let id=0;id<DESIGN_ROOMS;id++){
      const x=(id%LABEL_COLUMNS)*cellWidth,y=Math.floor(id/LABEL_COLUMNS)*cellHeight;
      ctx.font='bold 13px sans-serif';ctx.fillText(`W ${String(id+1).padStart(3,'0')}`,x+5,y+cellHeight*.42);
      ctx.fillRect(x+6,y+cellHeight*.58,cellWidth-12,1);ctx.font='5px sans-serif';ctx.fillText('PRIVATE SUITE',x+6,y+cellHeight*.78);
    }
  });
  return {wood,woodHeight,woodRoughness,floor,textile,textileHeight,wool,woolHeight,woodfelt,woodfeltHeight,stone,screen,contact,label};
}

export function createEnvironment(renderer){
  const texture=bitmap(256,(ctx,n)=>{
    const g=ctx.createLinearGradient(0,0,0,n);g.addColorStop(0,'#b5c9c3');g.addColorStop(.48,'#fff9e7');g.addColorStop(.6,'#d7d2b9');g.addColorStop(1,'#626b61');ctx.fillStyle=g;ctx.fillRect(0,0,n,n);
    ctx.fillStyle='#fffef6';ctx.fillRect(25,30,13,76);ctx.fillRect(135,48,35,48);
  });texture.mapping=T.EquirectangularReflectionMapping;
  const generator=new T.PMREMGenerator(renderer),target=generator.fromEquirectangular(texture);texture.dispose();generator.dispose();return target;
}
