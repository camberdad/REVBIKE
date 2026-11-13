import { RAPIER, Simulation, STEP } from '../src/physics';
import { testLevel } from '../src/track';
import { neutral } from './driver';
await RAPIER.init();
const sim=new Simulation(testLevel);sim.spawn([2,12]);
for(const body of sim.bike.bodies)body.setLinvel({x:8,y:8},true);
sim.onFlip=(count,direction)=>console.log('BONUS',count,direction);
let unwrapped=0,last=0;
for(let i=0;i<500&&!sim.crashed;i++){
  const angle=sim.bike.frame.rotation();unwrapped+=Math.atan2(Math.sin(angle-last),Math.cos(angle-last));last=angle;
  const correction=(Math.PI*2-unwrapped)*6-sim.bike.frame.angvel()*1.6;
  sim.step({...neutral,left:correction>0.2,right:correction< -0.2});
  if(i%30===0)console.log((i*STEP).toFixed(2),sim.bike.frame.translation(),'rotation',unwrapped.toFixed(2),'air',sim.airRotation.toFixed(2),'ground',sim.grounded);
  if(sim.flips>0)break;
}
console.log('RESULT',sim.flips,sim.crashed);sim.dispose();
