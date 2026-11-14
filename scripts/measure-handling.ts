// Measures the Trials drivetrain: loop-outs, forward-lean recovery, A → D pops.
// node node_modules/tsx/dist/cli.mjs scripts/probe-handling.ts
import {RAPIER,Simulation,type Controls} from '../src/physics';
import {testLevel,type Level} from '../src/track';
await RAPIER.init();
const neutral:Controls={gas:false,brake:false,left:false,right:false};
const flat=():Level=>({...testLevel,mode:'trials',spawn:[2,1.9],segments:[{points:[[-100,0],[1000,0]],smooth:true}]});
function run(name:string,input:(i:number,s:Simulation)=>Controls,steps=360){
 const s=new Simulation(flat());for(let i=0;i<360;i++)s.step(neutral);
 const y0=s.bike.frame.translation().y;let pitch=0,peak=0,frontLift=0;
 for(let i=0;i<steps&&!s.crashed;i++){s.step(input(i,s));pitch=Math.max(pitch,s.bike.frame.rotation());peak=Math.max(peak,s.bike.frame.translation().y-y0);frontLift=Math.max(frontLift,s.bike.wheels[1].translation().y-s.bike.wheels[0].translation().y);}
 console.log(name.padEnd(34),`crashed=${s.crashed} ${s.crashReason}`.padEnd(36),`maxPitch=${(pitch*180/Math.PI).toFixed(0)}°`,`frontLift=${frontLift.toFixed(2)}`,`peak=${peak.toFixed(2)}`,`hops=${s.hopCount}`,`x=${s.bike.frame.translation().x.toFixed(1)}`,`vx=${s.bike.frame.linvel().x.toFixed(1)}`);
 s.dispose();
}
run('full gas, neutral',()=>({...neutral,gas:true}));
run('full gas + D',()=>({...neutral,gas:true,right:true}));
run('full gas + A',()=>({...neutral,gas:true,left:true}));
run('precision gas',()=>({...neutral,gas:true,precision:true}));
run('gas taps 0.15s/0.25s',i=>({...neutral,gas:i%48<18}));
run('A 0.3s → D + gas (pop)',i=>({...neutral,left:i<36,right:i>=36,gas:i>=30&&i<60}),180);
run('A 0.3s → D, no gas',i=>({...neutral,left:i<36,right:i>=36}),180);
run('Space hop',i=>({...neutral,hop:i<2}),180);
// Brake on a 5 m/s roll.
{const s=new Simulation(flat());for(let i=0;i<360;i++)s.step(neutral);for(const b of s.bike.bodies)b.setLinvel({x:5,y:0},true);for(const w of s.bike.wheels)w.setAngvel(-5/s.dimensions.wheelRadius,true);
 let t=0;for(;t<240&&Math.abs(s.bike.frame.linvel().x)>.1;t++)s.step({...neutral,brake:true});console.log('brake 5 m/s → stop in',(t/120).toFixed(2),'s','pitch',(s.bike.frame.rotation()*180/Math.PI).toFixed(1),'crashed',s.crashed);s.dispose();}
// Hold on a 60° slope with brakes.
{const l:Level={...flat(),segments:[{points:[[-100,0],[0,0],[20,20*Math.tan(Math.PI/4)]],smooth:false}],spawn:[8,9.5]};
 const s=new Simulation(l);for(let i=0;i<120;i++)s.step({...neutral,brake:true,right:true});const x0=s.bike.frame.translation().x;for(let i=0;i<240;i++)s.step({...neutral,brake:true,right:true});
 console.log('45° brake hold drift',(s.bike.frame.translation().x-x0).toFixed(3),'m crashed',s.crashed);s.dispose();}
