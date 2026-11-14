import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RAPIER,Simulation,TRIALS_DIMENSIONS,BIKE_DIMENSIONS,type Controls} from '../src/physics';
import {testLevel,sampleSegment,type Level} from '../src/track';
import {trialsCourses,trialsMedal,trialStars,betterTrial,SECTION_LENGTH,type PieceKind} from '../src/trials';
import {normalizeAppearance} from '../src/garage';
import {neutral} from './driver';
import {rideSection} from './trials-bot';
await RAPIER.init();
const flat=():Level=>({...testLevel,mode:'trials',spawn:[2,1.9],segments:[{points:[[-100,0],[1000,0]],smooth:true}]});
const settle=(s:Simulation)=>{for(let i=0;i<360;i++)s.step(neutral);};
const course=(id:number)=>trialsCourses[id-1];
const section=(id:number,kind:PieceKind)=>course(id).setPieces!.find(p=>p.kind===kind)!;

test('30 Trials courses: five environments, four technical sections, three safe checkpoints',()=>{
 assert.equal(trialsCourses.length,30);
 assert.equal(new Set(trialsCourses.map(l=>l.environment)).size,5);
 for(const l of trialsCourses){
  assert.equal(l.mode,'trials');assert.equal(l.setPieces?.length,4);assert.equal(l.checkpoints.length,3);assert.equal(l.length,4*SECTION_LENGTH+10);
  assert.ok(!l.loops?.length&&!l.loop);assert.ok(!l.mechanisms?.some(m=>['boost','spring'].includes(m.kind)));
  assert.equal(new Set(l.setPieces!.map(p=>p.kind)).size,4,`${l.name} repeats a section`);
  for(const [x,y]of l.checkpoints){assert.ok(l.segments.some(s=>sampleSegment(s).some(p=>Math.abs(p[0]-x)<.25&&Math.abs(p[1]-y)<.01)),'checkpoint is on a flat connecting section');}
  const sim=new Simulation(l);settle(sim);assert.ok(sim.grounded&&!sim.crashed,`safe spawn: ${l.name}`);sim.dispose();
 }
 const kinds=new Set(trialsCourses.flatMap(l=>l.setPieces!.map(p=>p.kind)));
 for(const k of ['curbs','steps','ledge','wall','beam','seesaw','bridge','climb55','climb60','climb65','drop','precision','logs','rocks'])assert.ok(kinds.has(k),`${k} is used`);
 const obstacles=trialsCourses.flatMap(l=>l.obstacles??[]);
 assert.ok(obstacles.some(o=>o.kind==='concrete'&&o.y+o.height/2>1.4),'tall step-up walls');
 assert.ok(obstacles.some(o=>o.kind==='log'));assert.ok(obstacles.some(o=>o.kind==='stone'),'rocky bumps on climbs');
 for(const target of [55,60,65]){
  const l=trialsCourses.find(l=>l.setPieces?.some(p=>p.kind===`climb${target}`))!;
  let peak=0;for(const segment of l.segments){const p=sampleSegment(segment);for(let i=1;i<p.length;i++)peak=Math.max(peak,Math.atan2(p[i][1]-p[i-1][1],p[i][0]-p[i-1][0])*180/Math.PI);}
  assert.ok(Math.abs(peak-target)<2.5,`${target}° climb actually reaches ${peak.toFixed(1)}°`);
 }
});

test('rickety bridges hang from posts and sag under the bike; teeter-totters tip toward the exit',()=>{
 const l=course(4),bridge=section(4,'bridge'),s=new Simulation(l);
 const planks=s.machines.items.filter(m=>m.spec.kind==='bridge');assert.equal(planks.length,8);
 for(let i=0;i<240;i++)s.step(neutral);
 const rest=Math.min(...planks.map(p=>p.body.translation().y));assert.ok(rest<1.2&&rest>.2,`bridge hangs with slack (${rest.toFixed(2)})`);
 s.spawn([bridge.x+9.5,rest+2]);for(let i=0;i<120;i++)s.step(neutral);
 assert.ok(Math.min(...planks.map(p=>p.body.translation().y))<rest-.03,'the bike weighs the bridge down');s.dispose();
 const teeter=new Simulation(course(2)),deck=teeter.machines.items.find(m=>m.spec.kind==='seesaw')!;
 assert.ok(deck.body.rotation()>.15,'teeter rests tipped up toward the rider');
 teeter.spawn([deck.spec.x+2.5,deck.spec.y+2.2]);for(let i=0;i<240;i++)teeter.step({...neutral,brake:true});
 assert.ok(deck.body.rotation()<0,'weight past the pivot tips it down to the exit');teeter.dispose();
});

test('larger rolling diameter and longer rear swingarm retain suspension clearance',()=>{
 const d=TRIALS_DIMENSIONS;assert.ok(d.wheelRadius>BIKE_DIMENSIONS.wheelRadius*1.35);
 assert.ok(d.wheelOffsets[1]-d.wheelOffsets[0]>2.3);assert.ok(-d.wheelOffsets[0]>1.25);
 const s=new Simulation(flat());settle(s);
 for(const t of s.getSuspensionTelemetry()){assert.ok(t.tireClearance>.1);assert.ok(t.compressionRatio>.05&&t.compressionRatio<.95);}
 s.dispose();
});

function ride(input:(i:number,s:Simulation)=>Controls,steps:number,level=flat()){
 const s=new Simulation(level);settle(s);const y0=s.bike.frame.translation().y;let pitch=0,peak=0;
 for(let i=0;i<steps&&!s.crashed;i++){s.step(input(i,s));pitch=Math.max(pitch,s.bike.frame.rotation());peak=Math.max(peak,s.bike.frame.translation().y-y0);}
 return {s,pitch,peak};
}
test('engine torque reacts into the chassis: full gas bucks, leaning forward pins the front, leaning back loops out',()=>{
 const neutralGas=ride(()=>({...neutral,gas:true}),360),forward=ride(()=>({...neutral,gas:true,right:true}),360),back=ride(()=>({...neutral,gas:true,left:true}),360);
 assert.ok(neutralGas.pitch>.3&&!neutralGas.s.crashed,`full gas lifts the front (${(neutralGas.pitch*57.3).toFixed(0)}°)`);
 assert.ok(forward.pitch<neutralGas.pitch*.7,'forward weight keeps the front down');
 assert.ok(back.s.crashed,'full gas while leaning back loops the bike out');
 const precise=ride(()=>({...neutral,gas:true,precision:true}),360);assert.ok(precise.pitch<.15,'precision throttle stays planted');
 for(const r of [neutralGas,forward,back,precise])r.s.dispose();
 // A steep slope: neutral full gas loops, forward weight climbs it.
 const slope:Level={...flat(),segments:[{points:[[-100,0],[6,0],[40,34*Math.tan(55*Math.PI/180)]],smooth:true}]};
 const loop=ride(()=>({...neutral,gas:true}),600,slope),climb=ride((_,s)=>({...neutral,gas:s.bike.frame.translation().y<14,right:true}),600,slope);
 assert.ok(loop.s.crashed,'neutral full gas loops out on 55°');assert.ok(!climb.s.crashed&&climb.peak>8,'gas + D climbs the same 55° slope');
 loop.s.dispose();climb.s.dispose();
});

test('A → D weight snap with gas bunny-hops; without gas or preload it does not',()=>{
 const pop=ride(i=>({...neutral,left:i<36,right:i>=36,gas:i>=30&&i<60}),180);
 assert.equal(pop.s.hopCount,1);assert.ok(pop.peak>.5,`pop height ${pop.peak.toFixed(2)}`);assert.ok(!pop.s.crashed);
 const noGas=ride(i=>({...neutral,left:i<36,right:i>=36}),180);assert.equal(noGas.s.hopCount,0);
 const noPreload=ride(i=>({...neutral,right:i>=2,gas:i<30}),180);assert.equal(noPreload.s.hopCount,0);
 const stale=ride(i=>({...neutral,left:i<36,right:i>=120,gas:i>=110}),240);assert.equal(stale.s.hopCount,0,'the A preload expires');
 for(const r of [pop,noGas,noPreload,stale])r.s.dispose();
});

test('Space hops once when held, cannot jump in mid-air, and re-arms after a clean landing',()=>{
 const s=new Simulation(flat());settle(s);const y=s.bike.frame.translation().y;let peak=y,air=false;
 for(let i=0;i<180;i++){s.step({...neutral,hop:true});peak=Math.max(peak,s.bike.frame.translation().y);air||=!s.grounded;}
 assert.equal(s.hopCount,1);assert.ok(air&&peak-y>1.2&&peak-y<2,`Space jump height ${(peak-y).toFixed(2)}`);assert.ok(s.grounded&&!s.crashed);
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

test('snappy Trials brakes stop a 5 m/s roll within 0.4 s, hold on a 45° slope, and never reverse',()=>{
 const s=new Simulation(flat());settle(s);
 for(const b of s.bike.bodies)b.setLinvel({x:5,y:0},true);
 for(const w of s.bike.wheels)w.setAngvel(-5/s.dimensions.wheelRadius,true);
 for(let i=0;i<48;i++)s.step({...neutral,brake:true});
 assert.ok(Math.abs(s.bike.frame.linvel().x)<.2);assert.ok(!s.crashed);
 for(let i=0;i<180;i++)s.step({...neutral,brake:true});
 assert.ok(Math.abs(s.bike.frame.linvel().x)<.2);s.dispose();
 const hill=new Simulation({...flat(),segments:[{points:[[-100,0],[0,0],[20,20]],smooth:false}],spawn:[8,9.5]});
 for(let i=0;i<120;i++)hill.step({...neutral,brake:true,right:true});const x0=hill.bike.frame.translation().x;
 for(let i=0;i<240;i++)hill.step({...neutral,brake:true,right:true});
 assert.ok(Math.abs(hill.bike.frame.translation().x-x0)<.02&&!hill.crashed,'high-grip tyres hold the bike dead on a 45° incline');hill.dispose();
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

test('a hard nose-first landing is a fault; the same drop rear-wheel-first is absorbed',()=>{
 for(const [pitch,expectCrash] of [[-.75,true],[.3,false]] as const){
  const s=new Simulation(flat());settle(s);s.spawn([2,4.4]);
  for(const b of s.bike.bodies){const p=b.translation(),dx=p.x-2,dy=p.y-4.4;b.setTranslation({x:2+dx*Math.cos(pitch)-dy*Math.sin(pitch),y:4.4+dx*Math.sin(pitch)+dy*Math.cos(pitch)},true);b.setRotation(pitch,true);b.setLinvel({x:0,y:-4},true);}
  for(let i=0;i<120&&!s.crashed;i++)s.step(neutral);
  assert.equal(s.crashed,expectCrash,`pitch ${pitch}`);if(expectCrash)assert.equal(s.crashReason,'NOSE-FIRST LANDING');s.dispose();
 }
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

test('holding full throttle alone never finishes a single Trials course',()=>{
 for(const l of trialsCourses){
  const s=new Simulation(l);
  for(let i=0;i<120*30&&!s.crashed&&s.bike.frame.translation().x<l.length;i++)s.step({...neutral,gas:true});
  assert.ok(s.crashed||s.bike.frame.translation().x<l.length,`${l.name} must not be beaten by holding W`);s.dispose();
 }
});

// Each anchor is a real authored section cleared by a scripted rider that only
// presses W / S / A / D, using the technique a player would for that section.
const anchors:[number,PieceKind][]=[[1,'curbs'],[2,'logs'],[1,'beam'],[1,'drop'],[27,'drop'],[2,'seesaw'],[29,'seesaw'],[4,'bridge'],[30,'bridge'],[4,'rocks'],
 [4,'climb55'],[16,'climb60'],[28,'climb65'],[30,'climb65'],[12,'wall'],[30,'wall'],[12,'precision'],[28,'precision'],[9,'steps'],[21,'steps'],[3,'ledge'],[15,'ledge']];
for(const [id,kind] of anchors)test(`technique clears ${course(id).name}: ${kind}`,()=>{
 const s=new Simulation(course(id)),p=section(id,kind),r=rideSection(s,p.x-8,p.x+20.5);
 assert.ok(r.cleared,`${kind} on course ${id}: ${r.crashed?r.reason:'stuck'} at +${(r.x-p.x).toFixed(1)} m`);s.dispose();
});

function spaceHopStaircase(id:number){
 const l=course(id),piece=section(id,'steps'),s=new Simulation(l);s.step(neutral);s.spawn([piece.x-8,1.9]);
 for(let i=0;i<120*45&&!s.crashed&&s.bike.frame.translation().x<piece.x+20;i++){
  const v=s.bike.frame.linvel(),angle=s.bike.frame.rotation(),w=s.bike.frame.angvel(),front=s.bike.wheels[1].translation();
  const obs=l.obstacles?.find(o=>o.x+o.width/2>front.x-.15&&o.x-o.width/2<front.x+2&&o.y+o.height/2>front.y-.55);
  const near=!!obs&&obs.x-obs.width/2-front.x<.9,target=obs&&front.x<obs.x-obs.width/2+.3?.3:0,correction=(target-angle)*5-w*2;
  s.step({...neutral,gas:v.x<3||angle>.25&&angle<1.1,precision:v.x>1&&!near,left:s.grounded?near&&angle<.4:correction>.2,right:s.grounded?angle>.15&&!near:correction<-.2,hop:near&&s.grounded&&i%75===0});
 }
 const ok=!s.crashed&&s.bike.frame.translation().x>=piece.x+20;s.dispose();return ok;
}
test('every crate staircase is cleared by Space hops or the A → D weight-snap technique',()=>{
 for(const l of trialsCourses.filter(l=>l.setPieces!.some(p=>p.kind==='steps'))){
  const id=l.id!,p=section(id,'steps');
  if(spaceHopStaircase(id))continue;
  const s=new Simulation(l),r=rideSection(s,p.x-8,p.x+20.5);s.dispose();
  assert.ok(r.cleared,`staircase on course ${id}`);
 }
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
