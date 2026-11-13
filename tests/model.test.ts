import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the supplied bike is a self-contained optimized GLB with separately animated wheels',()=>{
  const file=fs.readFileSync(new URL('../public/models/revbike.glb',import.meta.url));
  assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.readUInt32LE(4),2);
  assert.ok(file.byteLength<3_000_000,'the authoring model has been optimized for browser delivery');
  const jsonLength=file.readUInt32LE(12),gltf=JSON.parse(file.subarray(20,20+jsonLength).toString());
  for(const name of ['chassis','frontWheel','rearWheel'])assert.ok(gltf.nodes.some((n:{name:string})=>n.name===name));
  assert.ok(!gltf.images?.length,'no missing external textures');
  assert.ok(gltf.buffers.every((b:{uri?:string})=>!b.uri),'geometry is embedded');
});
