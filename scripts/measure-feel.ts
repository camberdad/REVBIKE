// Quick "feel" numbers: acceleration, top speed, coast-down, hop height.
import {RAPIER,Simulation,type Controls} from '../src/physics';
import {testLevel,type Level} from '../src/track';
await RAPIER.init();
const n:Controls={gas:false,brake:false,left:false,right:false};
const flat=():Level=>({...testLevel,mode:'trials',spawn:[2,1.9],segments:[{points:[[-100,0],[2000,0]],smooth:true}]});
const fresh=()=>{const s=new Simulation(flat());for(let i=0;i<360;i++)s.step(n);return s;};
{const s=fresh();let t5=-1;for(let i=0;i<600;i++){s.step({...n,gas:true,right:true});if(t5<0&&s.bike.frame.linvel().x>5)t5=i/120;}
 const top=s.bike.frame.linvel().x;if(s.crashed)console.log("crashed:",s.crashReason,"at",s.bike.frame.translation().x.toFixed(1));let i=0;for(;i<1200&&s.bike.frame.linvel().x>.5;i++)s.step(n);
 console.log(`0→5 m/s ${t5.toFixed(2)}s | top ${top.toFixed(1)} m/s (${(top*3.6).toFixed(0)} km/h) | coast to 0.5 m/s ${(i/120).toFixed(2)}s`);s.dispose();}
{const s=fresh();const y=s.bike.frame.translation().y;let p=0,air=0;for(let i=0;i<240;i++){s.step({...n,hop:i<2});p=Math.max(p,s.bike.frame.translation().y-y);if(!s.grounded)air++;}console.log(`Space hop height ${p.toFixed(2)} m, airtime ${(air/120).toFixed(2)}s`);s.dispose();}
{const s=fresh();for(let i=0;i<120;i++)s.step({...n,gas:i%60<12});console.log(`two 0.1s taps → ${s.bike.frame.linvel().x.toFixed(2)} m/s, travelled ${(s.bike.frame.translation().x-2).toFixed(2)} m in 1s`);s.dispose();}
