// Offline conversion only. The shipped game loads the small GLB, never the OBJ/FBX.
import fs from 'node:fs';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Box3, Vector3, Group, Mesh, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, Matrix4, Color } from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';

const source=process.argv[2];
if(!source)throw new Error('Usage: node scripts/prepare-bike.mjs <absolute OBJ path>');
await MeshoptSimplifier.ready;
const input=new OBJLoader().parse(fs.readFileSync(source,'utf8'));
const root=new Group();root.name='REVBIKE_CG_Dirt_Conversion';
const groups={chassis:new Group(),rearWheel:new Group(),frontWheel:new Group()};
for(const [name,group]of Object.entries(groups)){group.name=name;root.add(group);}
const scale=1.88/(2.714927+4.272143),mid=(2.714927-4.272143)/2;
// OBJ is Y-up and faces +Z. Convert to our X/Y gameplay plane, axle along Z.
const transform=new Matrix4().set(0,0,scale,-mid*scale, 0,scale,0,0.878337*scale-0.35, -scale,0,0,0, 0,0,0,1);
const sourceMats=JSON.parse(fs.readFileSync('artifacts/model-materials.json','utf8'));
const cache=new Map(),batches=new Map();
let originalTriangles=0,finalTriangles=0,skipped=0;
function matFor(name,objectName){
  let color=sourceMats[name]?.color??'9ba69e';
  // Match the game's orange plastics and expose the donor bike's engine detail.
  if(name==='Material.010')color='ef653b';
  if(['Material.066','Material.079','Material.067','Material.038','Material.032'].includes(name))color='8d9993';
  if(name==='Material.062')color='b2b9aa';
  if(objectName.startsWith('rear_light'))color='ef653b';
  const key=color;
  if(!cache.has(key)){
    const c=new Color('#'+color),brightness=(c.r+c.g+c.b)/3;
    cache.set(key,new MeshStandardMaterial({name:'CG_'+color,color:c,roughness:brightness<0.07?0.88:0.59,metalness:brightness>0.2 && c.r-c.g<0.2?0.35:0.06}));
  }
  return cache.get(key);
}
input.traverse(obj=>{
  if(!obj.isMesh)return;
  const bounds=new Box3().setFromObject(obj),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  originalTriangles+=obj.geometry.attributes.position.count/3;
  // The authoring scene includes a huge floor, minute lettering and stray hardware.
  if(obj.name.startsWith('Plane')||obj.name.startsWith('Text')||Math.abs(center.x)>2||size.length()<0.055){skipped++;return;}
  let part='chassis';
  if(bounds.max.y<1.1 && center.z>2.25 && bounds.min.z>1.05)part='frontWheel';
  else if(bounds.max.y<1.1 && center.z< -3.65 && bounds.max.z< -2.5)part='rearWheel';
  const positions=obj.geometry.attributes.position;
  const materials=Array.isArray(obj.material)?obj.material:[obj.material];
  const slices=obj.geometry.groups.length?obj.geometry.groups:[{start:0,count:positions.count,materialIndex:0}];
  for(const slice of slices){
    const values=new Float32Array(slice.count*3);
    for(let i=0;i<slice.count;i++){
      const idx=slice.start+i;values[i*3]=positions.getX(idx);values[i*3+1]=positions.getY(idx);values[i*3+2]=positions.getZ(idx);
    }
    let geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(values,3));
    geo=mergeVertices(geo,0.00004);
    const oldIndex=new Uint32Array(geo.index.array),pos=geo.attributes.position.array;
    const target=Math.max(36,Math.min(9000,Math.floor(oldIndex.length*0.2/3)*3));
    if(oldIndex.length>target){
      const [indices]=MeshoptSimplifier.simplify(oldIndex,pos,3,target,0.003,['Prune']);geo.setIndex(Array.from(indices));
    }
    // Simplification changes the index stream; discard now-unreferenced vertices.
    const remap=new Map(),compact=[],indices=[];
    for(const old of geo.index.array){
      if(!remap.has(old)){remap.set(old,compact.length/3);compact.push(pos[old*3],pos[old*3+1],pos[old*3+2]);}
      indices.push(remap.get(old));
    }
    geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(compact,3));geo.setIndex(indices);
    geo.applyMatrix4(transform);
    if(part==='frontWheel')geo.translate(-0.94,0.35,0);
    if(part==='rearWheel')geo.translate(0.94,0.35,0);
    geo.computeVertexNormals();
    finalTriangles+=geo.index.count/3;
    const material=matFor(materials[slice.materialIndex??0].name,obj.name);
    const key=part+':'+material.uuid;
    if(!batches.has(key))batches.set(key,{part,material,geometries:[]});
    batches.get(key).geometries.push(geo);
  }
});
for(const {part,material,geometries}of batches.values()){
  const geometry=mergeGeometries(geometries,false),obj=new Mesh(geometry,material);obj.name=part+'_'+material.name;
  groups[part].add(obj);
}
// Browser exporter compatibility for offline Node conversion.
globalThis.FileReader=class{
  async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();}
  async readAsDataURL(blob){this.result='data:application/octet-stream;base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');this.onloadend?.();}
};
const glb=await new GLTFExporter().parseAsync(root,{binary:true});
fs.mkdirSync('public/models',{recursive:true});fs.writeFileSync('public/models/revbike.glb',Buffer.from(glb));
const report={source:'User-supplied cgbike1.obj / cgbike1.fbx',originalTriangles,finalTriangles,skippedObjects:skipped,drawCalls:batches.size,bytes:glb.byteLength,
  note:'Materials recovered from matching FBX. Floor and micro-lettering removed. Meshes simplified, batched by material, reoriented and split into independently animated chassis and wheels.'};
fs.writeFileSync('public/models/provenance.json',JSON.stringify(report,null,2));console.log(report);
