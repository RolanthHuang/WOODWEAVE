import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import * as T from './dist/vendor/three.module.min.js';
import {generateRooms,getStats,buildingRadius,LEVELS,FLOOR_WEIGHTS,getSupportPlan,getEnvelope,floorOffset,MAX_ROOMS,LABEL_COLUMNS,LABEL_ROWS} from './dist/layout.js';
import {buildHabitat,buildStructure,buildRoom,disposeModel,setModelDetail} from './dist/model.js';
for(const n of [36,72,180,216,360,720,1080]){
  const rooms=generateRooms(n),stats=getStats(rooms);
  assert.equal(rooms.length,n);assert.equal(new Set(rooms.map(r=>r.key)).size,n);
  assert.equal(new Set(rooms.map(r=>r.signature)).size,n);
  assert.equal(new Set(rooms.map(r=>r.hero.signature)).size,n);
  assert.equal(new Set(rooms.map(r=>r.hero.name)).size,n);
  assert.equal(new Set(rooms.map(r=>r.hero.type)).size,9);
  assert.ok(stats.four>0&&stats.five>0&&stats.six>0);
  assert.equal(stats.levels,LEVELS);assert.ok(stats.perFloor.every(n=>n>=1));
  assert.equal(stats.perFloor.indexOf(Math.max(...stats.perFloor)),4);
  const e=getEnvelope(rooms);assert.ok(e[4].maxX-e[4].minX>e[0].maxX-e[0].minX);assert.ok(e[4].maxX-e[4].minX>e[8].maxX-e[8].minX);
  for(const r of rooms){
    assert.equal(r.poly.length,r.faces===6?4:3);assert.ok(r.area>17&&r.area<36);
    assert.ok(r.level>=0&&r.level<9);
  }
  console.log(JSON.stringify({n,...stats,radius:buildingRadius(rooms)}));
}
assert.equal(MAX_ROOMS,1080);
assert.deepEqual(generateRooms(1080).slice(0,360),generateRooms(360),'Growth must preserve existing rooms and interiors');
assert.equal(LABEL_COLUMNS*LABEL_ROWS,1080);
assert.deepEqual(getStats(generateRooms(180)).perFloor,FLOOR_WEIGHTS);assert.ok(floorOffset(8)[0]>floorOffset(0)[0]);
const materials=Object.fromEntries(['wood','timber','white','dark','metal','fabric','glass','roofglass','wall','stone','leaves','soil','light','screen','cyan','ceramic','paper','label','contact','felt','woodfelt'].map(name=>[name,new T.MeshStandardMaterial()]));
const rooms=generateRooms(MAX_ROOMS),habitat=buildHabitat(rooms,materials);let drawBatches=0,instances=0,triangles=0;
assert.equal(habitat.layers.length,9);
assert.equal(new Set(habitat.pickables.flatMap(mesh=>mesh.userData.rooms.filter(id=>id>=0))).size,MAX_ROOMS,'Every room must remain pickable');
for(const layer of habitat.layers){assert.ok(layer.categories.micro,'All floors must contain close-range details');setModelDetail(layer,false,false);assert.equal(layer.categories.micro.visible,false);setModelDetail(layer,true,true);assert.equal(layer.categories.micro.visible,true);}
habitat.root.traverse(obj=>{if(obj.isMesh){drawBatches++;if(obj.isInstancedMesh)instances+=obj.count;triangles+=(obj.geometry.index?obj.geometry.index.count:obj.geometry.attributes.position.count)/3*(obj.count||1);assert.ok(obj.geometry.attributes.position.array.every(Number.isFinite));if(obj.isInstancedMesh)assert.ok(obj.instanceMatrix.array.every(Number.isFinite));if(obj.material===materials.label)assert.ok(obj.geometry.attributes.uv.array.every(n=>n>=0&&n<=1));}});
for(const faces of [4,5,6]){const model=buildRoom(rooms.find(r=>r.faces===faces),materials);assert.ok(model.root.children.length>=3);assert.equal(model.categories.roof.visible,faces===4);disposeModel(model.root);}
const labelCells=new Set();
for(const layer of habitat.layers)for(const mesh of layer.categories.micro.children){
  if(mesh.material!==materials.label)continue;
  const uv=mesh.geometry.attributes.uv.array;
  for(let i=0;i<uv.length;i+=12)labelCells.add(`${uv[i].toFixed(6)}:${uv[i+1].toFixed(6)}`);
}
assert.equal(labelCells.size,MAX_ROOMS,'Every physical plaque must address a distinct atlas cell');
disposeModel(habitat.root);
// Compare actual furniture geometry, transforms and colors. Ignore the label UVs
// so different room numbers alone cannot make identical interiors pass.
const interiorFingerprints=new Set();
for(const room of rooms){
  const model=buildRoom(room,materials),digest=createHash('sha256');
  for(const mesh of model.categories.furniture.children){
    digest.update(mesh.geometry.type);
    for(const attribute of [mesh.geometry.attributes.position,mesh.instanceMatrix,mesh.instanceColor]){
      if(!attribute)continue;
      const quantized=Int32Array.from(attribute.array,n=>Math.round(n*10000));
      digest.update(new Uint8Array(quantized.buffer));
    }
  }
  interiorFingerprints.add(digest.digest('hex'));disposeModel(model.root);
}
assert.equal(interiorFingerprints.size,MAX_ROOMS,'Rendered room furniture must be distinct, independently of names or plaques');
const supports=buildStructure(rooms,materials);assert.equal(supports.root.userData.extraColumns,2);assert.equal(supports.plan.core.height>30,true);assert.equal(supports.plan.bearingVerification,'NOT_ANALYSED');supports.root.traverse(o=>{if(o.isInstancedMesh)assert.ok(o.instanceMatrix.array.every(Number.isFinite));});disposeModel(supports.root);
const html=await readFile(new URL('./dist/standalone.html',import.meta.url),'utf8');assert.ok(!/<script[^>]+src=/.test(html));assert.ok(!/<link[^>]+rel="stylesheet"/.test(html));
const bundledScript=html.match(/<script>\n([\s\S]*)\n<\/script>/)?.[1];assert.ok(bundledScript);new Script(bundledScript,{filename:'woodweave-standalone.js'});
console.log(JSON.stringify({nineFloors:'PASS',diamondRoomDistribution:'PASS',twoSideColumns:'PASS',rooms:MAX_ROOMS,uniqueHeroPerRoom:'PASS',uniqueFurnitureGeometry:interiorFingerprints.size,distinctPhysicalPlaques:labelCells.size,strengthAnalysis:'NOT_ANALYSED',stableExtension:'PASS',geometry:'PASS',allThreeRoomTypes:'PASS',selfContained:'PASS',drawBatches,instances,triangles}));
