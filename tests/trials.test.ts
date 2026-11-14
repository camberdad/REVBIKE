import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RAPIER,Simulation,TRIALS_DIMENSIONS,BIKE_DIMENSIONS} from '../src/physics';
import {testLevel,sampleSegment,type Level} from '../src/track';
import {trialsCourses,trialsMedal,trialStars,betterTrial} from '../src/trials';
import {normalizeAppearance} from '../src/garage';
import {neutral} from './driver';
await RAPIER.init();
const flat=():Level=>({...testLevel,mode:'trials',spawn:[2,1.9],segments:[{points:[[-100,0],[1000,0]],smooth:true}]});
const settle=(s:Simulation)=>{for(let i=0;i<360;i++)s.step(neutral);};

test('30 compact Trials courses have five environments, three skill sections and two safe checkpoints',()=>{
 assert.equal(trialsCourses.length,30);
 assert.equal(new Set(trialsCourses.map(l=>l.environment)).size,5);
 for(const l of trialsCourses){
  assert.equal(l.mode,'trials');assert.equal(l.setPieces?.length,3);assert.equal(l.checkpoints.length,2);assert.equal(l.length,100);
  assert.ok(!l.loops?.length&&!l.loop);assert.ok(!l.mechanisms?.some(m=>['boost','spring'].includes(m.kind)));
  for(const [x,y]of l.checkpoints){assert.ok(l.segments.some(s=>sampleSegment(s).some(p=>Math.abs(p[0]-x)<.25&&Math.abs(p[1]-y)<.01)),'checkpoint is on a flat connecting section');}
  const sim=new Simulation(l);settle(sim);assert.ok(sim.grounded&&!sim.crashed,`safe spawn: ${l.name}`);sim.dispose();
 }
 const obstacles=trialsCourses.flatMap(l=>l.obstacles??[]);
 assert.ok(obstacles.some(o=>o.height>1.3));assert.ok(obstacles.some(o=>o.kind==='log'));
 for(const target of [55,60,65]){
  const l=trialsCourses.find(l=>l.setPieces?.some(p=>p.name.startsWith(`${target}°`)))!;
  let peak=0;for(const segment of l.segments){const p=sampleSegment(segment);for(let i=1;i<p.length;i++)peak=Math.max(peak,Math.atan2(p[i][1]-p[i-1][1],p[i][0]-p[i-1][0])*180/Math.PI);}
  assert.ok(Math.abs(peak-target)<2,`${target}° climb actually reaches ${peak.toFixed(1)}°`);
 }
});

test('larger rolling diameter and longer rear swingarm retain suspension clearance',()=>{
 const d=TRIALS_DIMENSIONS;assert.ok(d.wheelRadius>BIKE_DIMENSIONS.wheelRadius*1.35);
 assert.ok(d.wheelOffsets[1]-d.wheelOffsets[0]>2.3);assert.ok(-d.wheelOffsets[0]>1.25);
 const s=new Simulation(flat());settle(s);
 for(const t of s.getSuspensionTelemetry()){assert.ok(t.tireClearance>.1);assert.ok(t.compressionRatio>.05&&t.compressionRatio<.95);}
 s.dispose();
});

test('Space hops once when held, cannot jump in mid-air, and re-arms after a clean landing',()=>{
 const s=new Simulation(flat());settle(s);const y=s.bike.frame.translation().y;let peak=y,air=false;
 for(let i=0;i<180;i++){s.step({...neutral,hop:true});peak=Math.max(peak,s.bike.frame.translation().y);air||=!s.grounded;}
 assert.equal(s.hopCount,1);assert.ok(air&&peak-y>.55&&peak-y<1.5);assert.ok(s.grounded&&!s.crashed);
 s.step(neutral);s.step({...neutral,hop:true});assert.equal(s.hopCount,2);
 for(let i=0;i<12;i++)s.step(neutral);assert.ok(!s.grounded);
 s.step({...neutral,hop:true});assert.equal(s.hopCount,2,'pressing Space again in the air adds no impulse');
 s.restartRound();assert.equal(s.hopCount,0);s.dispose();
});

test('ground lean physically transfers rider mass; checkpoint retry restores its posture',()=>{
 const s=new Simulation(flat());settle(s);
 for(let i=0;i<180;i++)s.step({...neutral,left:true});const back=s.riderShift;
 for(let i=0;i<240;i++)s.step({...neutral,right:true});const forward=s.riderShift;
 assert.ok(back<-.35&&forward>.35,`physical rider travel ${back} to ${forward}`);
 assert.ok(s.riderCrouch<-.12);assert.ok(!s.crashed);assert.equal(s.bike.rider!.mass(),3);
 const saved=s.captureCheckpoint();s.crash();s.restoreCheckpoint(saved);
 assert.deepEqual(s.captureCheckpoint().riderTargets,saved.riderTargets);
 assert.ok(Math.abs(s.bike.rider!.translation().x-saved.bodies.at(-1)!.x)<.0001);
 for(let i=0;i<30;i++)s.step({...neutral,right:true});assert.ok(s.riderShift>.35&&!s.crashed);
 s.dispose();
});

test('snappy Trials brakes stop a 5 m/s roll without switching into reverse',()=>{
 const s=new Simulation(flat());settle(s);
 for(const b of s.bike.bodies)b.setLinvel({x:5,y:0},true);
 for(const w of s.bike.wheels)w.setAngvel(-5/s.dimensions.wheelRadius,true);
 for(let i=0;i<36;i++)s.step({...neutral,brake:true});
 assert.ok(Math.abs(s.bike.frame.linvel().x)<.2);assert.ok(!s.crashed);
 for(let i=0;i<180;i++)s.step({...neutral,brake:true});
 assert.ok(Math.abs(s.bike.frame.linvel().x)<.2);s.dispose();
});

test('gas taps release quickly and precision throttle reduces the low-speed burst',()=>{
 const velocities:number[]=[];
 for(const precision of [false,true]){
  const s=new Simulation(flat());settle(s);
  for(let i=0;i<24;i++)s.step({...neutral,gas:true,precision});
  velocities.push(s.bike.frame.linvel().x);assert.ok(s.throttle>(precision?.35:.95));
  for(let i=0;i<24;i++)s.step(neutral);assert.ok(s.throttle<.005);s.dispose();
 }
 assert.ok(velocities[0]>velocities[1]*1.5);
});

test('tire rolling stays within 3 mm on level ground and draw interpolation leaves physics untouched',()=>{
 const s=new Simulation(flat());settle(s);
 let lo=Infinity,hi=-Infinity;
 for(const b of s.bike.bodies)b.setLinvel({x:5,y:0},true);
 for(const w of s.bike.wheels)w.setAngvel(-5/s.dimensions.wheelRadius,true);
 for(let i=0;i<960;i++){
  const vx=s.bike.frame.linvel().x;
  for(const b of s.bike.bodies)b.applyImpulse({x:(5-vx)*b.mass()*.25,y:0},true);
  s.step(neutral);if(i>359){const y=s.bike.frame.translation().y;lo=Math.min(lo,y);hi=Math.max(hi,y);}
 }
 assert.ok(hi-lo<.003,`chassis ripple ${(hi-lo)*1000} mm`);
 const before=s.captureCheckpoint(),a=s.getRenderPoses(0),b=s.getRenderPoses(1),mid=s.getRenderPoses(.5);
 for(let i=0;i<3;i++)assert.ok(Math.abs(mid[i].x-(a[i].x+b[i].x)/2)<1e-6);
 assert.deepEqual(s.captureCheckpoint(),before);s.dispose();
});

test('technical steps require more than holding full throttle; tutorial remains accessible',()=>{
 const tutorial=new Simulation(trialsCourses[0]);let checkpoints=0;
 for(let i=0;i<120*25&&!tutorial.crashed&&tutorial.bike.frame.translation().x<100;i++){
  tutorial.step({...neutral,gas:true});if(tutorial.bike.frame.translation().x>tutorial.level.checkpoints[checkpoints]?.[0])checkpoints++;
 }
 assert.ok(!tutorial.crashed&&tutorial.bike.frame.translation().x>=100);assert.equal(checkpoints,2);tutorial.dispose();
 const steps=new Simulation(trialsCourses[2]);for(let i=0;i<120*18&&!steps.crashed;i++)steps.step({...neutral,gas:true});
 assert.ok(steps.crashed||steps.bike.frame.translation().x<30,'unbalanced full throttle does not clear the staircase');steps.dispose();
});

for(const id of [16,28])test(`forward weight and controlled air alignment crest the ${id===16?60:65}° face`,()=>{
 const s=new Simulation(trialsCourses[id-1]);s.spawn([42,1.8]);let peak=0;
 for(let i=0;i<120*20&&!s.crashed&&s.bike.frame.translation().x<54;i++){
  const a=s.bike.frame.rotation(),v=s.bike.frame.linvel(),w=s.bike.frame.angvel();peak=Math.max(peak,s.bike.frame.translation().y);
  const correction=-a*4-w*2;
  s.step({...neutral,gas:s.grounded||v.y>0,right:s.grounded||correction<-.2,left:!s.grounded&&correction>.2});
 }
 assert.ok(!s.crashed&&s.bike.frame.translation().x>=54,'ordinary gas and lean inputs crest the actual authored climb');
 assert.ok(peak>(id===16?5:5.5));s.dispose();
});

test('timed hops and rider weight clear the staircase and both tall ledges',()=>{
 const s=new Simulation(trialsCourses[2]);
 for(let i=0;i<120*45&&!s.crashed&&s.bike.frame.translation().x<65;i++){
  const p=s.bike.frame.translation(),v=s.bike.frame.linvel(),angle=s.bike.frame.rotation(),w=s.bike.frame.angvel(),front=s.bike.wheels[1].translation();
  const obs=s.level.obstacles?.find(o=>o.x+o.width/2>front.x-.15&&o.x-o.width/2<front.x+2&&o.height>front.y-.55);
  const near=!!obs&&obs.x-obs.width/2-front.x<.9,target=obs&&front.x<obs.x-obs.width/2+.3?.3:0;
  const correction=(target-angle)*5-w*2;
  s.step({...neutral,gas:v.x<3||angle>.25&&angle<1.1,precision:v.x>1&&!near,left:s.grounded?near&&angle<.4:correction>.2,right:s.grounded?angle>.15&&!near:correction<-.2,hop:near&&s.grounded&&i%75===0});
 }
 assert.ok(!s.crashed&&s.bike.frame.translation().x>=65);assert.ok(s.hopCount>=2);s.dispose();
});

test('faults rank ahead of time and garage unlocks validate saved customization',()=>{
 assert.ok(betterTrial({faults:0,time:120},{faults:1,time:20}));assert.ok(!betterTrial({faults:1,time:20},{faults:0,time:120}));
 assert.equal(trialsMedal({faults:0,time:44},45),'PLATINUM');assert.equal(trialsMedal({faults:0,time:46},45),'GOLD');
 assert.equal(trialsMedal({faults:3,time:10},45),'SILVER');assert.equal(trialStars({faults:8,time:10}),1);
 assert.equal(normalizeAppearance({bike:'crawler'},0).bike,'trail');assert.equal(normalizeAppearance({bike:'crawler'},1).bike,'crawler');
 assert.equal(normalizeAppearance({bike:'section'},4).bike,'trail');assert.equal(normalizeAppearance({bike:'section'},5).bike,'section');
 assert.deepEqual(normalizeAppearance({paint:'#abcdef',jersey:'bad',helmet:'#123456',number:42},0),{bike:'trail',paint:'#abcdef',jersey:'#3d7467',helmet:'#123456',number:42});
 assert.equal(normalizeAppearance({number:Infinity},0).number,7);
});
