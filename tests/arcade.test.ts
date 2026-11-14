import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RAPIER,Simulation,STEP} from '../src/physics';
import {testLevel} from '../src/track';
import {neutral} from './driver';
await RAPIER.init();

for(const gas of [false,true])test(`lean back lifts the front tire from flat ground ${gas?'with throttle':'from a standstill'}`,()=>{
  const sim=new Simulation(testLevel);
  for(let i=0;i<240;i++)sim.step(neutral);
  let frontLift=0;
  for(let i=0;i<60;i++){
    sim.step({...neutral,left:true,gas});
    frontLift=Math.max(frontLift,sim.bike.wheels[1].translation().y-0.44);
  }
  assert.ok(frontLift>(gas?.3:.09),'held input deliberately lifts the front wheel; throttle helps');
  assert.ok(sim.bike.frame.rotation()>0.25);assert.ok(!sim.crashed);
  sim.dispose();
});

for(const left of [true,false])test(`releasing ${left?'backflip':'frontflip'} input slows the whole rig without snapping its angle`,()=>{
  const sim=new Simulation(testLevel);sim.spawn([2,70]);
  for(let i=0;i<60;i++)sim.step({...neutral,left,right:!left});
  const before=sim.bike.frame.angvel();
  assert.ok(Math.abs(before)>5,'pitch response reaches a useful flip speed within half a second');
  let previous=sim.bike.frame.rotation();
  for(let i=0;i<120;i++){
    sim.step(neutral);
    const angle=sim.bike.frame.rotation(),delta=Math.atan2(Math.sin(angle-previous),Math.cos(angle-previous));
    assert.ok(Math.abs(delta)<Math.abs(before)*STEP+0.015,'release braking stays continuous');previous=angle;
  }
  assert.ok(Math.abs(sim.bike.frame.angvel())<Math.abs(before)*0.1,'neutral lean removes over 90% of spin within a second');
  assert.ok(!sim.crashed);sim.dispose();
});

for(const height of [4,6,9])test(`a tire-first drop from ${height} meters compresses and bounces without ejecting the rider`,()=>{
  const sim=new Simulation(testLevel);sim.spawn([2,height]);
  let contact=false,bounceSpeed=0,compression=0;
  for(let i=0;i<480;i++){
    sim.step(neutral);contact||=sim.grounded;
    if(contact)bounceSpeed=Math.max(bounceSpeed,sim.bike.frame.linvel().y);
    compression=Math.max(compression,...sim.getSuspensionTelemetry().map(s=>s.compression));
    assert.ok(!sim.crashed,'hard tire impacts do not trigger an impact-force crash');
  }
  assert.ok(contact);assert.ok(compression>0.55,'landing visibly uses the spring travel');
  assert.ok(bounceSpeed>1,'the landing has a visible spring rebound');
  assert.equal(sim.ragdoll.length,0);assert.ok(sim.grounded,'the bike settles after bouncing');sim.dispose();
});

test('direct torso contact with terrain still causes a ragdoll while the helmet is clear',()=>{
  const height=testLevel.spawn[1]+0.77;
  const level={...testLevel,segments:[{points:[[1.6,height],[2.1,height]] as [number,number][],smooth:false}],hazards:[]};
  const sim=new Simulation(level);
  assert.ok(sim.bike.head.translation().y-height>0.4,'helmet is clear of the ledge');
  sim.step(neutral);
  assert.ok(sim.crashed);assert.equal(sim.ragdoll.length,6);sim.dispose();
});

test('a short backward tap stays small and backward air speed is lower than forward air speed',()=>{
 const s=new Simulation(testLevel);for(let i=0;i<240;i++)s.step(neutral);
 for(let i=0;i<24;i++)s.step({...neutral,left:true});
 assert.ok(s.bike.wheels[1].translation().y-.44<.04,'a 200 ms flat-ground tap does not pop a large wheelie');s.dispose();
 const speeds:number[]=[];
 for(const left of [true,false]){const sim=new Simulation(testLevel);sim.spawn([2,100]);for(let i=0;i<240;i++)sim.step({...neutral,left,right:!left});speeds.push(Math.abs(sim.bike.frame.angvel()));sim.dispose();}
 assert.ok(speeds[0]<7.4);assert.ok(speeds[1]>speeds[0]+.7,'forward pitch retains its faster response');
});
