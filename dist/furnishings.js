import * as T from './vendor/three.module.min.js';
import {rng} from './layout.js';

export function addPlant(batch,x,y,z,size=1,color='#75876b',category='furniture'){
  batch.instance('pot','ceramic',category,[x,y+.20*size,z],[.44*size,.40*size,.44*size],'#ece5d4');
  batch.cylinder('soil',category,[x,y+.37*size,z],[.31*size,.025*size,.31*size]);
  batch.instance('torus','metal','micro',[x,y+.385*size,z],[.36*size,.36*size,.36*size],'#a9946e',0,new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2));
  for(let k=0;k<13;k++){
    const a=k*2.39996,reach=(.24+(k%3)*.055)*size,h=(.52+(k%5)*.095)*size;
    const p=[x+Math.cos(a)*reach,y+h,z+Math.sin(a)*reach];
    batch.beam('timber',category,[x,y+.37*size,z],p,.012*size,'#78846a');
    const q=new T.Quaternion().setFromEuler(new T.Euler(.45+(k%3)*.21,a,.25));
    batch.instance('leaf','leaves',category,p,[.17*size,.40*size,.15*size],k%3===0?'#9eac7c':color,0,q);
    batch.beam('leaves','micro',p,[p[0]+Math.sin(a)*.08*size,p[1]+.18*size,p[2]+Math.cos(a)*.08*size],.006*size,'#bdc4a0');
  }
}

export function addFurniture(batch,room,detail=false){
  const rand=rng(room.seed+441),center=room.center,rot=room.rotation+(room.faces===6?(room.seed%2)*Math.PI:0);
  const base=.51,fit=(room.faces===4?.58:room.faces===5?.79:1.05)*(.94+rand()*.12);
  const shiftX=(rand()-.5)*.35,shiftZ=(rand()-.5)*.25,cos=Math.cos(rot),sin=Math.sin(rot);
  const at=(x,y,z)=>[center[0]+(x*fit+shiftX)*cos-(z*fit+shiftZ)*sin,base+y*fit,center[1]+(x*fit+shiftX)*sin+(z*fit+shiftZ)*cos];
  const box=(m,x,y,z,w,h,d,col,angle=0,cat='furniture')=>batch.box(m,cat,at(x,y,z),[w*fit,h*fit,d*fit],col,-rot-angle);
  const soft=(m,x,y,z,w,h,d,col,angle=0,cat='furniture')=>batch.instance('rounded',m,cat,at(x,y,z),[w*fit,h*fit,d*fit],col,-rot-angle);
  const cyl=(m,x,y,z,w,h,d,col,cat='furniture')=>batch.cylinder(m,cat,at(x,y,z),[w*fit,h*fit,d*fit],col);
  const beam=(m,a,b,w,col,cat='micro')=>batch.beam(m,cat,at(...a),at(...b),w*fit,col);
  const sphere=(m,x,y,z,w,h,d,col,cat='furniture')=>batch.sphere(m,cat,at(x,y,z),[w*fit,h*fit,d*fit],col);
  const torus=(m,x,y,z,d,col,cat='micro')=>batch.instance('torus',m,cat,at(x,y,z),[d*fit,d*fit,d*fit],col,0,new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2));
  const wood=room.wood.color,accent=room.accent,light=['#e5dfce','#e8e3d6','#d3d7c9'][room.seed%3],ink='#47574e',brass='#a58e62';
  const stitch=(a,b,col='#bdb6a5')=>batch.thread(at(...a),at(...b),col);
  const piping=(x,y,z,w,d,angle=0)=>{
    if(!detail)return;
    const ca=Math.cos(angle),sa=Math.sin(angle),p=(u,v)=>at(x+u*ca-v*sa,y,z+u*sa+v*ca),r=Math.min(w,d)*.13,points=[];
    for(let corner=0;corner<4;corner++)for(let k=0;k<=8;k++){
      const a=-Math.PI/2+corner*Math.PI/2+k*Math.PI/16;
      points.push([(corner===0||corner===1?1:-1)*(w*.5-r)+Math.cos(a)*r,(corner===0||corner===3?-1:1)*(d*.5-r)+Math.sin(a)*r]);
    }
    for(let k=0;k<points.length;k++){
      const a=points[k],b=points[(k+1)%points.length];batch.cord('felt','atelier',p(...a),p(...b),.006*fit,light);
      const q=[a[0]*.975,a[1]*.975],e=[q[0]+(b[0]-a[0])*.42,q[1]+(b[1]-a[1])*.42];batch.thread(p(...q),p(...e),'#a8a18e');
    }
  };
  const joinery=(x,y,z,w,d)=>{
    if(!detail)return;
    for(const sign of [-1,1]){
      soft('woodend',x+sign*(w*.5-.003),y,z,.008,.064,d*.82,wood,0,'atelier');
      for(let j=0;j<5;j++)box('timber',x+sign*(w*.5+.002),y-.016+j*.009,z+(j%2?.013:-.013),.008,.004,d*.54,'#9d815c',0,'atelier');
      for(const zz of [-d*.34,d*.34]){cyl('metal',x+sign*w*.38,y+.048,z+zz,.021,.002,.021,brass,'atelier');stitch([x+sign*w*.38-.006,y+.05,z+zz],[x+sign*w*.38+.006,y+.05,z+zz],ink);}
    }
  };
  const contact=(x,z,w,d)=>batch.instance('plane','contact','ambient',at(x,.009,z),[w*fit,d*fit,1],null,0,new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));
  const book=(x,y,z,w=.21,d=.31,col=accent)=>{
    soft('fabric',x,y,z,w,.046,d,col,0,'micro');box('paper',x,y+.004,z,w*.94,.028,d*.94,null,0,'micro');
    for(let k=0;k<3;k++)box('fabric',x,y-.005+k*.008,z+d*.477,w*.9,.0015,.002,'#c1baa7',0,'micro');
  };
  const cup=(x,y,z)=>{
    batch.instance('cup','ceramic','micro',at(x,y+.055,z),[.13*fit,.11*fit,.13*fit],light);
    cyl('dark',x,y+.104,z,.09,.004,.09,ink,'micro');
    batch.instance('torus','ceramic','micro',at(x+.079,y+.06,z),[.065*fit,.065*fit,.065*fit],light,0,new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2));
  };
  const vase=(x,y,z,scale=.4)=>{
    batch.instance('vase','ceramic','furniture',at(x,y+scale*.5,z),[scale*.52*fit,scale*fit,scale*.52*fit],room.seed%2?light:accent);
    for(let k=0;k<3;k++){
      const a=rand()*6.28,h=scale*(1.1+rand()*.55),px=x+Math.cos(a)*scale*.35,pz=z+Math.sin(a)*scale*.35;
      beam('timber',[x,y+scale*.8,z],[px,y+h,pz],.008,'#94876a');
      const q=new T.Quaternion().setFromEuler(new T.Euler(.8,-rot+a,.3));batch.instance('leaf','leaves','micro',at(px,y+h,pz),[scale*.15*fit,scale*.3*fit,scale*.1*fit],'#8d9a76',0,q);
    }
  };
  const lamp=(x,y,z)=>{
    cyl('metal',x,y+.025,z,.22,.05,.22,brass);cyl('metal',x,y+.19,z,.023,.33,.023,brass);
    sphere('ceramic',x,y+.37,z,.29,.21,.29,light);cyl('light',x,y+.32,z,.23,.015,.23);
  };
  const chair=(x,z,angle=0)=>{
    const ca=Math.cos(angle),sa=Math.sin(angle),p=(xx,zz)=>[x+xx*ca-zz*sa,z+xx*sa+zz*ca];
    const piece=(xx,y,zz,w,h,d,mat,col,cat='furniture')=>{const q=p(xx,zz);soft(mat,q[0],y,q[1],w,h,d,col,angle,cat);};
    piece(0,.43,0,.59,.15,.57,'felt',light);piece(0,.70,-.245,.60,.46,.115,'timber',wood);piece(0,.7,-.17,.48,.34,.08,'felt',light);
    piping(x,.506,z,.53,.51,angle);
    for(const dx of [-.21,.21])for(const dz of [-.21,.21]){
      const q=p(dx,dz),f=p(dx*1.14,dz*1.14);beam('metal',[f[0],.045,f[1]],[q[0],.40,q[1]],.027,ink,'furniture');cyl('metal',f[0],.035,f[1],.04,.04,.04,brass,'micro');
    }
    for(const dx of [-.26,.26])piece(dx,.59,0,.035,.025,.36,'metal',brass,'micro');
    contact(x,z,.88,.88);
  };
  const sofa=(x,z,w=1.9)=>{
    contact(x,z,w*1.22,1.2);soft('timber',x,.20,z,w,.17,.85,wood);
    for(const dx of [-w*.39,w*.39])for(const dz of [-.28,.28])cyl('metal',x+dx,.09,z+dz,.055,.16,.055,brass);
    soft('felt',x,.73,z-.33,w,.63,.25,light);
    const count=w>1.5?3:2,cw=(w-.14)/count;
    for(let k=0;k<count;k++){
      const xx=x-w*.5+.07+cw*(k+.5);soft('felt',xx,.43,z+.015,cw-.025,.26,.70,light);
      soft('felt',xx,.72,z-.215,cw-.028,.42,.16,light);
      box('felt',xx,.562,z+.34,cw*.90,.008,.012,'#c1bdac',0,'micro');
      piping(xx,.560,z+.015,cw-.055,.64);
      if(detail)for(let j=0;j<20;j++)stitch([xx-cw*.4+j*cw*.04,.75,z-.131],[xx-cw*.4+j*cw*.04+.010,.75,z-.131],light);
    }
    for(const sign of [-1,1]){
      soft('felt',x+sign*w*.5,.51,z,.16,.58,.84,light);
      const q=new T.Quaternion().setFromEuler(new T.Euler(-.13,-rot,sign*.16));
      batch.instance('rounded','felt','furniture',at(x+sign*w*.32,.70,z-.08),[.34*fit,.33*fit,.14*fit],accent,0,q);
      for(let k=0;k<3;k++)box('felt',x+sign*w*.32+(-.08+k*.08),.71,z+.004,.003,.20,.006,'#b8b19b',0,'micro');
    }
    // The casually folded throw has an actual hanging edge and fringe.
    if(!detail){soft('felt',x-w*.28,.575,z+.17,.41,.033,.48,accent,0,'micro');soft('felt',x-w*.28,.40,z+.414,.41,.36,.027,accent,0,'micro');}
    else{
      const surface=(u,v)=>{const yy=v<.72?.597:.597-(v-.72)/.28*.39;return [x-w*.28+(u-.5)*.43,yy+Math.sin(u*Math.PI*9+room.seed%7)*(.008+v*.013),z-.07+Math.min(v/.72,1)*.49+(v>.72?(v-.72)*.025:0)];};
      for(let row=0;row<24;row++)for(let col=0;col<24;col++)batch.quad('cloth','atelier',at(...surface(col/24,row/24)),at(...surface((col+1)/24,row/24)),at(...surface((col+1)/24,(row+1)/24)),at(...surface(col/24,(row+1)/24)),accent);
      for(let k=0;k<30;k++){const a=surface(k/30,1),b=[a[0]+.003,a[1]-.055,a[2]+.008];batch.cord('felt','atelier',at(...a),at(...b),.004*fit,light);}
    }
    for(let k=0;k<8;k++)box('felt',x-w*.47+k*.052,.202,z+.425,.009,.063,.01,light,0,'micro');
  };
  const table=(x,y,z,w,d)=>{
    contact(x,z,w*1.3,d*1.5);soft('timber',x,y,z,w,.09,d,wood);
    joinery(x,y,z,w,d);
    soft('metal',x,y-.06,z,w*.91,.025,d*.90,brass,0,'micro');
    for(const dx of [-w*.35,w*.35])for(const dz of [-d*.32,d*.32])beam('metal',[x+dx,y-.05,z+dz],[x+dx*1.04,.035,z+dz*1.04],.033,ink,'furniture');
  };
  const rugShape=room.seed%3;
  if(rugShape===0)cyl('felt',0,.018,.10,2.58,.024,2.35,accent);
  else soft('felt',0,.019,.12,2.70,.025,1.94,accent);
  // Recessed border and discrete tassels are close-range details in every room.
  if(rugShape!==0){
    for(const x of [-1.27,1.27])box('felt',x,.034,.12,.015,.003,1.78,light,0,'micro');
    for(const z of [-.76,1])box('felt',0,.034,z,2.54,.003,.014,light,0,'micro');
    for(let k=0;k<20;k++)for(const sign of [-1,1])box('felt',-1.22+k*.128,.016,.12+sign*1.01,.015,.008,.09,light,0,'micro');
  }else batch.instance('torus','felt','micro',at(0,.028,.10),[2.46*fit,2.23*fit,.22*fit],light,0,new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2));

  for(let k=0;k<44;k++){const x=-1.15+rand()*2.3,z=-.68+rand()*1.55;beam('felt',[x,.034,z],[x+(rand()-.5)*.025,.040+rand()*.008,z+(rand()-.5)*.025],.0025,light);}
  if(detail){
    const fibers=rng(room.seed+77391);
    for(let k=0;k<2600;k++){
      const x=(fibers()-.5)*2.45,z=.10+(fibers()-.5)*1.75;
      if(rugShape===0&&x*x/(1.20*1.20)+(z-.1)*(z-.1)/(.99*.99)>1)continue;
      const a=fibers()*Math.PI*2,len=.006+fibers()*.018;
      stitch([x,.037,z],[x+Math.cos(a)*len,.04+fibers()*.012,z+Math.sin(a)*len],k%3?'#ddd5c0':'#a99d83');
    }
  }

  switch(room.program.kind){
    case 'sleep':{
      contact(0,-.12,2.25,2.9);soft('timber',0,.22,-.12,1.76,.27,2.21,wood);box('light',0,.11,-.12,1.45,.02,1.91);
      soft('fabric',0,.43,-.12,1.61,.25,2.05,'#ece9db');soft('fabric',0,.58,.18,1.67,.075,1.39,light);
      for(const x of [-.415,.415]){
        soft('fabric',x,.62,-.82,.70,.17,.42,'#f5f0e2');soft('fabric',x,.70,-.98,.61,.19,.32,light);
        box('fabric',x,.634,-.603,.58,.006,.008,'#c4bdad',0,'micro');
      }
      soft('fabric',0,.642,.65,1.69,.043,.42,accent);soft('fabric',0,.49,1.0,1.68,.30,.036,accent,0,'micro');
      piping(0,.622,.18,1.59,1.30);piping(0,.669,.65,1.61,.36);
      if(detail)for(let k=0;k<60;k++)stitch([-.73+k*.025,.648,-.602],[-.72+k*.025,.648,-.602],light);
      for(let k=0;k<9;k++)box('fabric',-.76+k*.19,.67,.65,.012,.005,.38,light,0,'micro');
      soft('timber',0,.77,-1.24,1.89,1.40,.13,wood);soft('fabric',0,.84,-1.14,1.72,.86,.10,light);
      for(const x of [-.55,0,.55])box('fabric',x,.84,-1.079,.008,.74,.007,'#bbb8a9',0,'micro');
      box('light',0,1.36,-1.13,1.58,.018,.02);
      for(const x of [-1.19,1.19]){
        soft('timber',x,.43,-.85,.47,.40,.48,wood);box('dark',x,.47,-.604,.36,.012,.012,ink,0,'micro');lamp(x,.64,-.87);
      }
      book(.98,.67,-.64,.19,.23);break;
    }
    case 'work':case 'studio':{
      table(0,.79,-.60,2.04,.85);soft('dark',.20,1.23,-.80,.90,.53,.05,ink);
      box('metal',.20,.96,-.80,.035,.32,.032,brass);soft('metal',.20,.84,-.70,.32,.018,.20,brass);
      box('screen',.20,1.23,-.769,.82,.45,.006);cyl('light',.54,.986,-.763,.012,.012,.012);
      soft('dark',.20,.85,-.37,.66,.018,.24,ink,0,'micro');
      for(let row=0;row<4;row++)for(let key=0;key<12;key++)soft('paper',-.08+key*.049,.864,-.45+row*.049,.040,.008,.035,'#b4bfb1',0,'micro');
      soft('metal',.68,.858,-.34,.095,.045,.145,'#b3baa7',0,'micro');chair(0,.30,Math.PI);
      book(-.72,.87,-.47,.25,.34);cup(-.70,.835,-.78);
      cyl('metal',-.86,.91,-.79,.08,.17,.08,brass,'micro');
      for(let k=0;k<4;k++)box('timber',-.88+k*.014,1.05,-.79,.008,.22,.008,wood,0,'micro');
      lamp(.85,.835,-.82);box('light',0,.72,-.49,1.70,.013,.025);
      if(room.program.kind==='studio'){
        soft('stone',.88,.36,.84,.61,.72,.61,'#e1dfd0');batch.instance('torus','metal','furniture',at(.88,.96,.84),[.40*fit,.40*fit,.40*fit],brass,0,new T.Quaternion().setFromEuler(new T.Euler(.4,.7,.2)));
        sphere('ceramic',.88,.94,.84,.20,.25,.20,accent);book(.90,.736,.82,.24,.27);
      }break;
    }
    case 'library':{
      // Open-front cabinetry, rather than a solid block of timber.
      box('timber',0,1.13,-1.10,2.05,2.16,.055,wood);
      for(const x of [-1.02,0,1.02])box('timber',x,1.13,-.94,.055,2.16,.36,wood);
      if(detail)for(const x of [-1.02,0,1.02])for(let y=.24;y<2.1;y+=.064)stitch([x+.028,y,-.82],[x+.028,y+.012,-.82],brass);
      for(let row=0;row<5;row++){
        const y=.17+row*.45;box('timber',0,y,-.94,2.06,.055,.37,wood);box('light',0,y-.025,-.795,1.94,.014,.015);
        if(row<4)for(let j=0;j<9;j++){
          const h=.22+rand()*.15,x=-.88+j*.214,w=.067+rand()*.047,col=[accent,'#c9bea5','#d9ddcf','#758c7b','#bbb49b'][j%5];
          soft('fabric',x,y+.035+h*.5,-.90,w,h,.22,col);
          for(const fy of [.22,.69])box('paper',x,y+.04+h*fy,-.785,w*.64,.005,.004,null,0,'micro');
          box('metal',x,y+.055,-.783,w*.6,.012,.005,brass,0,'micro');
        }
      }
      sofa(-.34,.35,1.08);cyl('timber',.77,.46,.62,.68,.075,.68,wood);cyl('metal',.77,.23,.62,.065,.43,.065,brass);book(.75,.52,.60);cup(.90,.50,.48);break;
    }
    case 'dining':{
      contact(0,0,2,2);cyl('timber',0,.79,0,1.57,.10,1.57,wood);cyl('metal',0,.41,0,.12,.74,.12,brass);cyl('metal',0,.05,0,.64,.045,.64,ink);
      for(const sign of [-1,1]){
        chair(sign*.99,0,sign<0?-Math.PI/2:Math.PI/2);const x=sign*.40;
        cyl('fabric',x,.85,0,.46,.008,.48,accent,'micro');cyl('ceramic',x,.866,0,.34,.024,.34,light);torus('ceramic',x,.882,0,.30,light);
        cyl('ceramic',x,.889,0,.24,.012,.24,'#ded7bf','micro');cup(x,.852,.29);
        for(const z of [-.22,.22]){box('metal',x,.866,z,.18,.008,.018,brass,0,'micro');}
      }
      vase(0,.85,0,.30);break;
    }
    case 'zen':{
      contact(0,-.2,2.5,2.4);soft('timber',0,.12,-.25,2.13,.20,1.88,wood);
      for(let k=0;k<10;k++)box('timber',-.97+k*.215,.224,-.25,.006,.002,1.77,'#b4a27c',0,'micro');
      for(const x of [-.53,.53]){batch.instance('pouf','felt','furniture',at(x,.30,.13),[.72*fit,.16*fit,.72*fit],x<0?light:accent);torus('felt',x,.30,.13,.69,light);}
      piping(-.53,.373,.13,.59,.59);piping(.53,.373,.13,.59,.59);
      table(0,.43,-.49,.94,.54);soft('stone',0,.49,-.49,.64,.025,.36,'#aeb7a1');
      sphere('ceramic',0,.59,-.53,.18,.16,.18,accent,'micro');cyl('timber',0,.69,-.53,.06,.025,.06,wood,'micro');
      beam('ceramic',[.055,.60,-.53],[.15,.65,-.53],.035,accent);
      batch.instance('torus','ceramic','micro',at(-.095,.62,-.53),[.10*fit,.10*fit,.10*fit],accent,0,new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2));
      for(const x of [-.22,.22])cup(x,.51,-.47);vase(.76,.225,-.94,.49);break;
    }
    case 'lounge':
      sofa(-.30,-.50,1.74);chair(.86,.65,Math.PI);cyl('stone',-.29,.44,.58,1.04,.085,1.04,'#e8e3d3');cyl('metal',-.29,.24,.58,.08,.40,.08,brass);cyl('metal',-.29,.055,.58,.55,.035,.55,ink);book(-.43,.51,.61);cup(-.04,.49,.49);vase(-.41,.49,.35,.25);break;
    default:
      sofa(0,-.64,1.98);table(0,.44,.49,1.24,.69);book(-.23,.515,.49);book(-.21,.565,.50,.24,.30,light);vase(.32,.49,.45,.28);cup(.23,.49,.69);
  }
  if(room.faces!==4){const p=at(-1.24,0,.49);addPlant(batch,p[0],base,p[2],.77*fit,['#7c906c','#94a67c','#637e68'][room.seed%3]);}
  else{const p=at(-1.0,0,.38);addPlant(batch,p[0],base,p[2],.31*fit,'#8d9e77');}
  const lightY=room.faces===4?1.85:2.93,lightingCategory=detail?'ceiling':'roof';
  if(room.seed%3===1){
    const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
    batch.instance('torus','metal',lightingCategory,[center[0],lightY+.035,center[1]],[1.12,1.12,1.12],brass,0,q);
    batch.instance('torus','light',lightingCategory,[center[0],lightY,center[1]],[1.07,1.07,1.07],null,0,q);
    for(const dx of [-.32,.32])batch.beam('metal',lightingCategory,[center[0]+dx,lightY,center[1]],[center[0]+dx,3.35,center[1]],.008,brass);
  }else{
    batch.box('metal',lightingCategory,[center[0],lightY+.025,center[1]],[1.40*fit,.055,.095],brass,-rot);
    batch.box('light',lightingCategory,[center[0],lightY-.009,center[1]],[1.30*fit,.012,.065],null,-rot);
  }
  box('light',0,.074,-1.01,1.5,.018,.022);
}
