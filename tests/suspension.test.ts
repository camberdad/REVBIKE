import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAPIER, Simulation, STEP, BIKE_DIMENSIONS, TUNING } from '../src/physics';
import { testLevel } from '../src/track';
import { neutral } from './driver';
await RAPIER.init();

test('raised chassis settles on its springs with useful sag and tire clearance',()=>{
  const sim=new Simulation(testLevel);
  for(let i=0;i<360;i++)sim.step(neutral);
  assert.ok(sim.grounded);assert.ok(sim.bike.frame.translation().y>1.0);assert.ok(sim.bike.frame.translation().y<1.23);
  for(const s of sim.getSuspensionTelemetry()){
    assert.ok(s.compressionRatio>0.25 && s.compressionRatio<0.7,'standing bike is between the travel stops');
    assert.ok(s.springCompression>0.1 && s.springCompression<0.3,'force-based spring supports real static sag');
    assert.ok(s.tireClearance>0.25,'tire has visible room beneath the fender');
  }
  sim.dispose();
});

test('suspension extends unloaded, compresses on landing, and settles without tire clipping',()=>{
  const sim=new Simulation(testLevel);
  for(let i=0;i<360;i++)sim.step(neutral);
  const standing=sim.getSuspensionTelemetry().map(s=>s.compression);
  // Lift the whole assembled bike, retaining its loaded spring pose, then drop it.
  for(const body of sim.bike.bodies){const p=body.translation();body.setTranslation({x:p.x,y:p.y+4},true);body.setLinvel({x:0,y:0},true);}
  let airborneMinimum=1,landingPeak=0,minClearance=1;
  for(let i=0;i<360;i++){
    sim.step(neutral);
    for(const s of sim.getSuspensionTelemetry()){
      if(i>12 && i<48)airborneMinimum=Math.min(airborneMinimum,s.compression);
      if(sim.grounded)landingPeak=Math.max(landingPeak,s.compression);
      minClearance=Math.min(minClearance,s.tireClearance);
    }
    if(i===29){
      const total=sim.bike.bodies.reduce((sum,b)=>sum+b.mass(),0);
      const vy=sim.bike.bodies.reduce((sum,b)=>sum+b.linvel().y*b.mass(),0)/total;
      assert.ok(Math.abs(vy-TUNING.gravity*STEP*30)<0.08,'suspension cannot add float or lift to the airborne center of mass');
    }
  }
  assert.ok(airborneMinimum<Math.min(...standing)-0.12,'wheels visibly droop after takeoff');
  assert.ok(landingPeak>Math.max(...standing)+0.2,'impact uses more travel than static sag');
  assert.ok(landingPeak<=BIKE_DIMENSIONS.fullBumpAxleY-BIKE_DIMENSIONS.fullDroopAxleY+0.035,'travel stops contain the hard landing');
  assert.ok(minClearance>0,'tires never clip into the raised fenders');assert.ok(!sim.crashed);
  sim.getSuspensionTelemetry().forEach((s,i)=>assert.ok(Math.abs(s.compression-standing[i])<0.03,'rebound settles back to the riding stance'));
  sim.dispose();
});

test('compression telemetry is measured in the chassis frame through flips and loops',()=>{
  const sim=new Simulation(testLevel);sim.spawn([2,20]);
  const original=sim.getSuspensionTelemetry(),origin=sim.bike.frame.translation();
  for(const body of sim.bike.bodies){
    const p=body.translation(),dx=p.x-origin.x,dy=p.y-origin.y;
    body.setTranslation({x:origin.x-dy,y:origin.y+dx},true);body.setRotation(Math.PI/2,true);
  }
  sim.getSuspensionTelemetry().forEach((s,i)=>{
    assert.ok(Math.abs(s.compression-original[i].compression)<0.00001);
    assert.ok(Math.abs(s.axleDrop+BIKE_DIMENSIONS.freeAxleY)<0.00001);
  });
  sim.dispose();
});

test('air torque ramps smoothly, limits spin, and responds to opposite lean input',()=>{
  const sim=new Simulation(testLevel);sim.spawn([2,70]);
  let early=0,later=0,peak=0,last=0,maxStepChange=0;
  for(let i=0;i<192;i++){
    sim.step({...neutral,left:true});const w=sim.bike.frame.angvel();
    if(i===11)early=w;if(i===59)later=w;
    peak=Math.max(peak,Math.abs(w));maxStepChange=Math.max(maxStepChange,Math.abs(w-last));last=w;
  }
  assert.ok(early>0 && early<later,'rotation accelerates rather than snapping instantly');
  assert.ok(peak<=TUNING.maxAirAngularSpeed+0.2,'holding lean does not produce runaway spin');
  assert.ok(maxStepChange<0.6,'per-step rotation is continuous');
  for(let i=0;i<96;i++)sim.step({...neutral,right:true});
  assert.ok(sim.bike.frame.angvel()<0,'opposite lean brakes and reverses rotation');
  sim.dispose();
});
