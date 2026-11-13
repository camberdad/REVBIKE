import fs from 'node:fs';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Box3, Vector3 } from 'three';
const model=new OBJLoader().parse(fs.readFileSync(process.argv[2],'utf8'));
console.log('TOTAL',new Box3().setFromObject(model));
model.traverse(obj=>{
  if(!obj.isMesh)return;
  const bounds=new Box3().setFromObject(obj),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  console.log(JSON.stringify({name:obj.name,vertices:obj.geometry.attributes.position.count,triangles:obj.geometry.index?obj.geometry.index.count/3:obj.geometry.attributes.position.count/3,center:center.toArray(),size:size.toArray(),material:Array.isArray(obj.material)?obj.material.map(m=>m.name):obj.material.name}));
});
