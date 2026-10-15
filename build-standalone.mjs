import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const read=name=>readFile(resolve(root,'dist',name),'utf8');
let [html,css,three,layout,surfaces,furnishings,model,app]=await Promise.all(['index.html','style.css','vendor/three.module.min.js','layout.js','surfaces.js','furnishings.js','model.js','app.js'].map(read));
function moduleToScope(source,name,replacements={}){
  const exports=[...source.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g)].map(m=>m[1]);
  source=source.replace(/^import[^\n]+\n/gm,line=>{
    for(const [key,value] of Object.entries(replacements))if(line.includes(key))return value+'\n';
    throw new Error('Unrecognized import: '+line);
  });
  source=source.replace(/\bexport\s+(?=const|function|class)/g,'');
  return `const ${name}=(()=>{\n${source}\nreturn {${exports.join(',')}};\n})();`;
}
const exported=three.match(/export\{([^}]+)\};?\s*$/);if(!exported)throw new Error('THREE export structure changed');
const names=exported[1].split(',').map(entry=>{let parts=entry.trim().split(/\s+as\s+/);return parts.length===2?`${parts[1]}:${parts[0]}`:parts[0];}).join(',');
three=three.slice(0,exported.index)+`return {${names}};`;
const compiled=[`const THREE=(()=>{${three}})();`,moduleToScope(layout,'WWLayout'),moduleToScope(surfaces,'WWSurfaces',{'three.module.min.js':'const T=THREE;', './layout.js':'const {rng,MAX_ROOMS,LABEL_COLUMNS,LABEL_ROWS}=WWLayout;'}),moduleToScope(furnishings,'WWFurnishings',{'three.module.min.js':'const T=THREE;', './layout.js':'const {rng,MAX_ROOMS,LABEL_COLUMNS,LABEL_ROWS}=WWLayout;'}),moduleToScope(model,'WWModel',{
  'three.module.min.js':'const T=THREE;', './layout.js':"const {SIDE,ROOM_HEIGHT,LEVEL_HEIGHT,LEVELS,getSupportPlan,getHeroAnchor,rng,hash,LABEL_COLUMNS,LABEL_ROWS}=WWLayout;",
  './surfaces.js':'const {createTextureSet}=WWSurfaces;','./furnishings.js':'const {addPlant,addFurniture}=WWFurnishings;'
}),moduleToScope(app,'WWApp',{
  'three.module.min.js':'const T=THREE;', './layout.js':"const {generateRooms,getStats,buildingRadius,getEnvelope,getHeroAnchor,LEVELS,LEVEL_HEIGHT,MAX_ROOMS}=WWLayout;",'./model.js':"const {createMaterials,buildHabitat,buildLandscape,buildStructure,buildRoom,disposeModel,setModelDetail}=WWModel;",'./surfaces.js':'const {createEnvironment}=WWSurfaces;'
})].join('\n');
html=html.replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${css}</style>`).replace('<script type="module" src="./app.js"></script>',()=>`<script>\n${compiled.replace(/<\/script/gi,'<\\/script')}\n</script>`).replace('class="brand" href="./"','class="brand" href="#"');
const output=process.argv[2]?resolve(process.argv[2]):resolve(root,'dist/standalone.html');await mkdir(dirname(output),{recursive:true});await writeFile(output,html);
await writeFile(resolve(root,'dist/standalone.html'),html);
await writeFile(resolve(root,'index.html'),html);
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),externalRuntimeRequests:false}));
