import {test} from 'node:test';
import assert from 'node:assert/strict';
import {campaign,environments} from '../src/campaign';
import {sampleSegment,loopPoints,testLevel,type Level,type Mechanism} from '../src/track';
import {RAPIER,Simulation,STEP} from '../src/physics';
import {balancedThrottle,neutral} from './driver';
await RAPIER.init();

test('25 unlocked course definitions span five environments, with two checkpoints and medal targets',()=>{
 assert.equal(campaign.length,25);assert.equal(new Set(campaign.map(l=>l.name)).size,25);
 for(const env of environments)assert.equal(campaign.filter(l=>l.environment===env.id).length,5);
 for(const [i,l]of campaign.entries()){
  assert.equal(l.id,i+1);assert.equal(l.checkpoints.length,2);assert.ok(l.setPieces!.length>=3&&l.setPieces!.length<=5);
  assert.ok(l.stars[0]<l.stars[1]&&l.stars[1]<l.stars[2]);assert.ok(l.targetSeconds!>=35&&l.targetSeconds!<=60);
  assert.ok(l.checkpoints[0][0]>0&&l.checkpoints[1][0]>l.checkpoints[0][0]&&l.checkpoints[1][0]<l.finish[0]);
 }
});

test('campaign curves have finite dense samples, gentle adjacent normals and seamless static joins',()=>{
 for(const l of campaign){
  const paths=[...l.segments.map(sampleSegment),...(l.loops??[]).map(loopPoints),...(l.paths??[])];
  for(const path of paths){
   for(let i=0;i<path.length;i++)assert.ok(path[i].every(Number.isFinite),`finite ${l.id}`);
   for(let i=1;i<path.length-1;i++){
    const a=path[i-1],b=path[i],c=path[i+1],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]);
    assert.ok(ab<.5&&bc<.5,`dense collision curve in ${l.id}`);
    const turn=Math.atan2(Math.sin(Math.atan2(c[1]-b[1],c[0]-b[0])-Math.atan2(b[1]-a[1],b[0]-a[0])),Math.cos(Math.atan2(c[1]-b[1],c[0]-b[0])-Math.atan2(b[1]-a[1],b[0]-a[0])));
    assert.ok(Math.abs(turn)<.24,`no sharp interior vertex in level ${l.id}: ${turn}`);
   }
  }
 }
});

for(const level of campaign)test(`Level ${level.id}: ${level.name} has a complete input-driven route`,()=>{
 const sim=new Simulation(level);const checkpoints=new Set<number>();let i=0;
 for(;i<120*65&&!sim.crashed&&sim.bike.frame.translation().x<level.finish[0];i++){
  sim.step(balancedThrottle(sim));const p=sim.bike.frame.translation();
  level.checkpoints.forEach(([x,y],index)=>{if(p.x>x&&p.x<x+4&&p.y>y-.5&&p.y<y+5)checkpoints.add(index);});
 }
 assert.ok(!sim.crashed,`clean route at ${JSON.stringify(sim.bike.frame.translation())}`);
 assert.ok(sim.bike.frame.translation().x>=level.finish[0],`finish reached at ${i*STEP}s, ${JSON.stringify(sim.bike.frame.translation())}`);
 assert.equal(checkpoints.size,2,'both checkpoints can be collected');
 assert.ok(i*STEP>=30&&i*STEP<=60,'compact course timing remains near the 35–60 s design range');
 if(level.loops?.length)assert.ok(sim.campaignLoops.every(l=>l.phase==='complete'),'each physical loop was traversed');
 if(level.magneticPaths?.length)assert.equal(sim.machines.magnetDone.size,level.magneticPaths.length,'both ceiling sections were ridden');
 sim.dispose();
});

function fixture(spec:Partial<Mechanism>&Pick<Mechanism,'kind'>):Level{
 return {...testLevel,spawn:[5,1.55],segments:[{points:[[-20,0],[-5,0]],smooth:true},{points:[[15,0],[40,0]],smooth:true}],mechanisms:[{x:5,y:0,width:16,...spec}]};
}
test('a real central-pivot seesaw tips under an off-center rider',()=>{
 const sim=new Simulation(fixture({kind:'seesaw'}));sim.spawn([9,1.55]);for(let i=0;i<120;i++)sim.step(neutral);
 assert.ok(sim.machines.items[0].body.rotation()<-.05);assert.ok(!sim.crashed);sim.dispose();
});
test('a hydraulic platform lifts both wheels before its exit',()=>{
 const sim=new Simulation(fixture({kind:'lift',rise:7,speed:3}));for(let i=0;i<240;i++)sim.step(neutral);
 assert.ok(sim.machines.items[0].body.translation().y>3);assert.ok(sim.bike.frame.translation().y>4);assert.ok(!sim.crashed);sim.dispose();
});
test('a rickety deck falls 0.4 seconds after tire contact and checkpoint restore rebuilds it',()=>{
 const sim=new Simulation(fixture({kind:'collapse',delay:.4}));let i=0;while(!sim.machines.items[0].activated&&i++<120)sim.step(neutral);
 const snapshot=sim.captureCheckpoint();for(let j=0;j<20;j++)sim.step(neutral);assert.equal(sim.machines.items[0].broken,false);
 for(let j=0;j<40;j++)sim.step(neutral);assert.equal(sim.machines.items[0].broken,true);
 sim.restoreCheckpoint(snapshot);assert.equal(sim.machines.items[0].broken,false);assert.ok(Math.abs(sim.clock-snapshot.clock!)<.00001);sim.dispose();
});
test('forward and reverse belts apply opposite surface motion',()=>{
 const velocities:number[]=[];for(const speed of [-7,9]){const sim=new Simulation(fixture({kind:'conveyor',speed}));for(let i=0;i<90;i++)sim.step(neutral);velocities.push(sim.bike.frame.linvel().x);sim.dispose();}
 assert.ok(velocities[0]<-1&&velocities[1]>1);
});
test('a spring pad launches a tire landing onto an upper deck height',()=>{
 const sim=new Simulation(fixture({kind:'spring',rise:22}));sim.spawn([5,4]);let peak=0;for(let i=0;i<150;i++){sim.step(neutral);peak=Math.max(peak,sim.bike.frame.translation().y);}
 assert.ok(peak>9);assert.ok(!sim.crashed);sim.dispose();
});
test('a contact TNT fuse delays its explosion and a full restart clears it',()=>{
 const level={...testLevel,hazards:[{type:'tnt',x:2,y:1.3,delay:.65}]};const sim=new Simulation(level);
 for(let i=0;i<24;i++)sim.step(neutral);assert.equal(sim.exploded.size,0);assert.ok(!sim.crashed);
 for(let i=0;i<80;i++)sim.step(neutral);assert.equal(sim.exploded.size,1);sim.restartRound();assert.equal(sim.exploded.size,0);assert.equal(sim.clock,0);sim.dispose();
});
test('triggered rocks become dynamic and checkpoint retry restores their waiting state',()=>{
 const sim=new Simulation({...testLevel,hazards:[{type:'boulder',x:0,y:8,radius:1,triggerX:10}]});
 for(let i=0;i<30;i++)sim.step(neutral);const snapshot=sim.captureCheckpoint();assert.equal(sim.hazardBodies[0].isDynamic(),false);
 sim.spawn([11,1.55]);sim.step(neutral);assert.ok(sim.hazardBodies[0].isDynamic());
 sim.restoreCheckpoint(snapshot);assert.equal(sim.hazardBodies[0].isDynamic(),false);assert.equal(sim.hazardBodies[0].translation().y,8);sim.dispose();
});
for(const turns of [1,2])test(`the canyon mega-ramp supports a clean ${turns===1?'single':'double'} backflip and awards its landing`,()=>{
 const sim=new Simulation(campaign[14]);let stunt=false,rotation=0,last=0,awards=0;
 sim.onFlip=count=>awards+=count;
 for(let i=0;i<120*35&&!sim.crashed&&sim.bike.frame.translation().x<410;i++){
  const p=sim.bike.frame.translation(),angle=sim.bike.frame.rotation();
  if(!stunt&&p.x>276&&p.y>6&&!sim.grounded){stunt=true;rotation=angle;last=angle;}
  let input=balancedThrottle(sim);
  if(stunt){rotation+=Math.atan2(Math.sin(angle-last),Math.cos(angle-last));last=angle;const correction=(turns*Math.PI*2-rotation)*6-sim.bike.frame.angvel()*1.6;input={...neutral,gas:true,left:correction>.2,right:correction<-.2};}
  sim.step(input);
 }
 assert.ok(stunt);assert.ok(!sim.crashed);assert.equal(awards,turns);sim.dispose();
});
