// Rides every section of all 30 Trials courses with the scripted test rider and
// prints a pass/fail grid. Informational: a failure can be the rider, not the course.
// node node_modules/tsx/dist/cli.mjs scripts/sweep-trials.ts [ids e.g. 1,4,30]
import {RAPIER,Simulation} from '../src/physics';
import {trialsCourses} from '../src/trials';
import {rideSection} from '../tests/trials-bot';
await RAPIER.init();
const ids=(process.argv[2]??'').split(',').filter(Boolean).map(Number);
for(const l of trialsCourses.filter(l=>!ids.length||ids.includes(l.id!))){
 const s=new Simulation(l);
 const out=l.setPieces!.map(p=>{const r=rideSection(s,p.x-8,p.x+20.5);return `${p.name.slice(0,16).padEnd(16)} ${r.cleared?'ok  ':r.crashed?'CRSH':'STUK'} ${r.cleared?r.seconds.toFixed(1)+'s':(r.x-p.x).toFixed(1)+' '+r.reason}`;});
 console.log(String(l.id).padStart(2),out.join(' | '));s.dispose();
}
