import type { Controls, Simulation } from '../src/physics';
export const neutral:Controls={gas:false,brake:false,left:false,right:false};
// A small PD balancing controller supplies real player inputs, never moves bodies.
export function balancedThrottle(sim:Simulation,options:{gain?:number;damping?:number;slope?:number;threshold?:number}={}):Controls {
  if(options.gain===undefined&&(!sim.level.id||[13,15,16,17].includes(sim.level.id)))options={...options,gain:3};
  if(options.gain===undefined&&sim.level.id===10)options={...options,gain:4};
  if(options.damping===undefined&&sim.level.id===17)options={...options,damping:1.2};
  const p=sim.bike.frame.translation();let target=0,targetSpin=0;
  if(sim.level.id&&sim.grounded){
    const segment=sim.level.segments.find(s=>p.x>=s.points[0][0]&&p.x<=s.points.at(-1)![0]);
    const i=segment?.points.findIndex(q=>q[0]>p.x)??-1;
    if(segment&&i>0){const a=segment.points[i-1],b=segment.points[i];target=Math.max(-.4,Math.min(.7,Math.atan2(b[1]-a[1],b[0]-a[0])*(options.slope??.7)));}
    if(sim.level.id===21&&sim.level.setPieces?.some(s=>p.x>s.x+17&&p.x<s.x+88))target=.18;
  }
  let loop=sim.level.loop&&sim.loopPhase!=='complete'?sim.level.loop:sim.campaignLoops.find(l=>l.phase!=='complete'&&p.x>l.definition.x-7&&p.x<l.definition.x+7)?.definition;
  if(!loop&&sim.level.id===20){const path=sim.level.paths?.at(-1);if(path&&p.x>path[0][0]-1&&p.x<path.at(-1)![0]+2&&p.y<14)loop={x:path[0][0],y:9,radius:9};}
  const inside=sim.level.loop?sim.loopPhase==='inside':sim.campaignLoops.some(l=>l.definition===loop&&l.phase==='inside');
  if(loop&&(p.x>=loop.x||inside)&&p.x>loop.x-7&&p.x<loop.x+7&&p.y>.9){
    target=Math.atan2(p.y-loop.y,p.x-loop.x)+Math.PI/2;
    const v=sim.bike.frame.linvel(),dx=p.x-loop.x,dy=p.y-loop.y;
    targetSpin=(dx*v.y-dy*v.x)/(dx*dx+dy*dy);
  }
  const angle=sim.bike.frame.rotation(),error=Math.atan2(Math.sin(target-angle),Math.cos(target-angle));
  const correction=error*(options.gain??5)+(targetSpin*(loop?1:.25)-sim.bike.frame.angvel())*(options.damping??1.6);
  if(sim.machines.magnetic)return {...neutral,gas:true};
  let braking=false,waiting=false;
  for(const h of sim.level.hazards){
    if(h.type!=='crusher')continue;const distance=h.x-p.x,vx=Math.max(0,sim.bike.frame.linvel().x);
    if(distance<3||distance>32)continue;
    const arrival=(Math.sqrt(vx*vx+16*distance)-vx)/8;
    const safe=[-.2,0,.2].every(offset=>{const phase=(sim.clock+arrival+offset)/(h.period??4)*Math.PI*2+(h.phase??0);return h.y+(h.amplitude??3)*Math.cos(phase)-1.2>3.2;});
    if(!safe){waiting=true;braking=vx>.3;}
  }
  return {...neutral,gas:!waiting,brake:braking,left:correction>(options.threshold??.3),right:correction< -(options.threshold??.3)};
}
