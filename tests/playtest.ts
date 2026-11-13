import { RAPIER, Simulation, STEP } from '../src/physics';
import { level1 } from '../src/track';
import { balancedThrottle } from './driver';
await RAPIER.init();
const sim=new Simulation(level1);
const cp=Number(process.argv[2]);
if(Number.isInteger(cp) && level1.checkpoints[cp])sim.spawn([level1.checkpoints[cp][0]+1,level1.checkpoints[cp][1]+1.1]);
let lastLog=0;
for(let i=0;i<120*50;i++){
  const p=sim.bike.frame.translation();
  const angle=sim.bike.frame.rotation();
  sim.step(balancedThrottle(sim));
  if(i-lastLog>=120){lastLog=i;console.log((i*STEP).toFixed(1),p.x.toFixed(1),p.y.toFixed(1),'angle',angle.toFixed(1),'ground',sim.grounded,'loop',sim.loopPhase);}
  if(sim.crashed){console.log('CRASH',p);break;}
  if(p.x>=195){console.log('FINISH',i*STEP);break;}
}
sim.dispose();
