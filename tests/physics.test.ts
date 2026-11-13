import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAPIER, Simulation, STEP, type BikeSnapshot } from '../src/physics';
import { testLevel, level1, sampleSegment } from '../src/track';
import { balancedThrottle } from './driver';

await RAPIER.init();
const neutral={gas:false,brake:false,left:false,right:false};

test('suspended bike settles, drives over flat ground, and climbs the test ramp',()=>{
  const sim=new Simulation(testLevel);
  for(let i=0;i<120;i++) sim.step(neutral);
  assert.ok(sim.grounded,'wheels settle onto the ground');
  let peak=0;
  for(let i=0;i<900 && sim.bike.frame.translation().x<testLevel.finish[0];i++){
    sim.step({...neutral,gas:true});
    peak=Math.max(peak,sim.bike.frame.translation().y);
  }
  const p=sim.bike.frame.translation();
  console.log('test-course run',p,'peak',peak,'crashed',sim.crashed);
  assert.ok(p.x>30,'rear-wheel torque moves the bike across the ramp');
  assert.ok(peak>3.5,'bike climbed the ramp');
  assert.ok(!sim.crashed,'stable suspension keeps the head off terrain');
  sim.dispose();
});

test('lean controls apply opposite angular impulses',()=>{
  const sim=new Simulation(testLevel);
  sim.spawn([2,15]);
  sim.step({...neutral,left:true});
  assert.ok(sim.bike.frame.angvel()>0);
  sim.spawn([2,15]);
  sim.step({...neutral,right:true});
  assert.ok(sim.bike.frame.angvel()<0);
  sim.dispose();
});

test('braking slows the bike and holding the brake reverses it',()=>{
  const sim=new Simulation(testLevel);
  for(let i=0;i<180;i++)sim.step({...neutral,gas:true});
  const speed=sim.bike.frame.linvel().x;
  for(let i=0;i<120;i++)sim.step({...neutral,brake:true});
  assert.ok(sim.bike.frame.linvel().x<speed-2,'brakes reduce forward speed');
  for(let i=0;i<360;i++)sim.step({...neutral,brake:true});
  assert.ok(sim.bike.frame.linvel().x< -0.5,'holding brake applies reverse torque');
  sim.dispose();
});

test('head contact produces one crash and a jointed physical ragdoll',()=>{
  const sim=new Simulation(testLevel);
  let crashes=0;sim.onCrash=()=>crashes++;
  sim.spawn([2,1.0]);sim.bike.frame.setRotation(Math.PI,true);
  for(let i=0;i<120;i++)sim.step(neutral);
  assert.ok(sim.crashed);assert.equal(crashes,1);assert.equal(sim.ragdoll.length,6);
  sim.spawn([2,1.15]);
  assert.ok(!sim.crashed);assert.equal(sim.ragdoll.length,0);
  sim.dispose();
});

test('level JSON has smooth ramps, a closed loop and all required hazards',()=>{
  assert.equal(level1.checkpoints.length,4);
  for(const type of ['tnt','saw','spikes'])assert.ok(level1.hazards.some(h=>h.type===type));
  const points=sampleSegment(level1.segments[0]);
  assert.ok(points.length>50);assert.equal(points.at(-1)?.[1],4.2);
  assert.equal(STEP,1/120);
});

test('Level 1 can be completed through the vertical loop, and every saved checkpoint is recoverable',()=>{
  const sim=new Simulation(level1),snapshots:BikeSnapshot[]=[];
  for(let i=0;i<120*40 && sim.bike.frame.translation().x<195 && !sim.crashed;i++){
    sim.step(balancedThrottle(sim));
    const p=sim.bike.frame.translation(),next=level1.checkpoints[snapshots.length];
    if(next&&p.x>next[0]&&p.y>next[1]-0.5&&p.y<next[1]+5)snapshots.push(sim.captureCheckpoint());
  }
  assert.ok(!sim.crashed,'the course has a clean playable route');
  assert.ok(sim.bike.frame.translation().x>=195,'the rider reached the finish');
  assert.equal(sim.loopPhase,'complete','the bike traversed the full vertical loop');
  assert.equal(snapshots.length,4);
  for(const [index,snapshot]of snapshots.entries()){
    sim.crash();sim.restoreCheckpoint(snapshot);
    assert.equal(sim.ragdoll.length,0);
    assert.ok(Math.abs(sim.bike.frame.linvel().x-snapshot.bodies[0].vx)<0.001,'checkpoint preserves launch momentum');
    for(let i=0;i<120*35&&sim.bike.frame.translation().x<195&&!sim.crashed;i++)sim.step(balancedThrottle(sim));
    assert.ok(!sim.crashed,`checkpoint ${index+1} recovered cleanly; position ${JSON.stringify(sim.bike.frame.translation())}; angle ${sim.bike.frame.rotation()}; velocity ${JSON.stringify(sim.bike.frame.linvel())}; phase ${sim.loopPhase}`);
    assert.ok(sim.bike.frame.translation().x>=195,`checkpoint ${index+1} leads to the finish`);
  }
  sim.dispose();
});

test('TNT collision fires one explosion and one crash',()=>{
  const level={...testLevel,hazards:[{type:'tnt',x:5,y:0.58}]};
  const sim=new Simulation(level);let explosions=0,crashes=0;
  sim.onExplosion=()=>explosions++;sim.onCrash=()=>crashes++;
  for(let i=0;i<120*4;i++)sim.step({...neutral,gas:true});
  assert.equal(explosions,1);assert.equal(crashes,1);assert.equal(sim.exploded.size,1);
  sim.dispose();
});

for(const direction of [1,-1])test(`${direction>0?'backflip':'frontflip'} bonus waits for a clean wheel landing`,()=>{
  const sim=new Simulation(testLevel);sim.spawn([2,12]);
  for(const body of sim.bike.bodies)body.setLinvel({x:8,y:8},true);
  const awards:{count:number;direction:string}[]=[];
  sim.onFlip=(count,name)=>awards.push({count,direction:name});
  let unwrapped=0,last=0,wasAirborne=false;
  for(let i=0;i<360&&!sim.crashed&&awards.length===0;i++){
    const angle=sim.bike.frame.rotation();unwrapped+=Math.atan2(Math.sin(angle-last),Math.cos(angle-last));last=angle;
    const correction=(direction*Math.PI*2-unwrapped)*6-sim.bike.frame.angvel()*1.6;
    sim.step({...neutral,left:correction>0.2,right:correction< -0.2});
    if(!sim.grounded){wasAirborne=true;assert.equal(awards.length,0,'a flip in the air is not awarded yet');}
  }
  assert.ok(wasAirborne);assert.ok(!sim.crashed);assert.equal(sim.flips,1);
  assert.deepEqual(awards,[{count:1,direction:direction>0?'BACKFLIP':'FRONTFLIP'}]);
  sim.dispose();
});
