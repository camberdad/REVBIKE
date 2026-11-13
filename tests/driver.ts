import type { Controls, Simulation } from '../src/physics';
export const neutral:Controls={gas:false,brake:false,left:false,right:false};
// A small PD balancing controller supplies real player inputs, never moves bodies.
export function balancedThrottle(sim:Simulation):Controls {
  const p=sim.bike.frame.translation();let target=0,targetSpin=0;
  if(sim.level.loop && (p.x>=sim.level.loop.x || sim.loopPhase==='inside') && p.x>sim.level.loop.x-7 && p.x<sim.level.loop.x+7 && sim.loopPhase!=='complete' && p.y>0.9){
    const loop=sim.level.loop;target=Math.atan2(p.y-loop.y,p.x-loop.x)+Math.PI/2;
    const v=sim.bike.frame.linvel(),dx=p.x-loop.x,dy=p.y-loop.y;
    targetSpin=(dx*v.y-dy*v.x)/(dx*dx+dy*dy);
  }
  const angle=sim.bike.frame.rotation(),error=Math.atan2(Math.sin(target-angle),Math.cos(target-angle));
  const correction=error*5+(targetSpin*0.25-sim.bike.frame.angvel())*1.6;
  return {...neutral,gas:true,left:correction>0.3,right:correction< -0.3};
}
