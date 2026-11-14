import recipes from './trials.json';
import {environments} from './campaign';
import type {Level,Point} from './track';
const hints:Record<string,[string,string]>={curbs:['Feather control','Tap W. Hold Shift + W for precision gas. A/D move your weight.'],steps:['Crate staircase','Unweight the front with A, then move forward with D as the rear climbs.'],ledge:['Vertical ledges','Approach slowly. A + a gas pulse lifts the front; D loads the front on top.'],beam:['Balance plank','Use small throttle taps and S to stop before the end.'],seesaw:['Pivot bridge','Shift your weight to balance the deck. Brake before it tips.'],climb55:['55° technical climb','Move forward with D and feed in gas. Avoid looping out.'],climb60:['60° rock face','Lean far forward. Use the available grip and precise gas.'],climb65:['65° expert face','Set your approach, move forward and feather torque. R retries instantly.'],drop:['Controlled drop','Brake at the edge. Move rearward, then align the wheels for touchdown.'],precision:['Zero-speed gaps','Stop on the small decks; use Space + a short gas burst, then shift A → D to cross.'],logs:['Log trial','Lift onto each log, then shift forward to bring the rear wheel over.'],rocks:['Rock garden','Match each small slope and control the tire contact with your body position.']};
function build(id:number,name:string,pieces:string[],par:number):Level{
 const env=environments[Math.floor((id-1)/6)],scale=1+Math.floor((id-1)/6)*.06;
 const segments:Level['segments']=[],obstacles:NonNullable<Level['obstacles']>=[],mechanisms:NonNullable<Level['mechanisms']>=[],hazards:Level['hazards']=[],props:NonNullable<Level['props']>=[];
 const ground=(points:Point[])=>segments.push({points,smooth:true});
 const block=(x:number,w:number,h:number,kind:'crate'|'concrete'|'rock'='crate')=>obstacles.push({kind,x,y:h/2,width:w,height:h,radius:.1});
 ground([[-40,0],[0,0]]);
 const setPieces=pieces.map((kind,i)=>{
  const x=10+i*30,[title,hint]=hints[kind];
  if(['beam','seesaw'].includes(kind)){
   const h=kind==='beam'?.8:.45;
   ground([[x-10,0],[x+1,0],[x+4.9,h]]);
   mechanisms.push({kind:kind==='beam'?'flex':'seesaw',x:x+9.5,y:h-.17,width:9.2});
   ground([[x+14.1,Math.max(-.3,h-.65)],[x+18,0],[x+20,0]]);
   hazards.push({type:env.id==='volcano'?'lava':'mud',x:x+9.5,y:-4,width:9});
  }else if(kind==='precision'){
   ground([[x-10,0],[x+3,0],[x+6,.55]]);ground([[x+7.4,.5],[x+10.6,.6]]);ground([[x+12.2,.5],[x+15,.5],[x+18,0],[x+20,0]]);
   hazards.push({type:env.id==='volcano'?'lava':env.id==='neon'?'laser':'mud',x:x+10,y:-3,width:14});
  }else if(kind.startsWith('climb')){
   const angle=Number(kind.slice(5)),h=angle===55?3.3:angle===60?4:4.6,w=h*1.5/Math.tan(angle*Math.PI/180);
   ground([[x-10,0],[x+3,0],[x+5,0],[x+5+w,h],[x+10+w,h],[x+10.25+w,1],[x+19,0],[x+20,0]]);
   props.push({kind:'tunnel',x:x+8,y:0,width:12,height:7});
  }else if(kind==='drop'){
   ground([[x-10,0],[x+1,0],[x+5,1.8*scale],[x+8,1.8*scale]]);
   ground([[x+9.5,0],[x+20,0]]);
  }else{
   ground([[x-10,0],[x+20,0]]);
   if(kind==='curbs'){block(x+6,2.5,.28*scale);block(x+13,2.5,.45*scale);}
   if(kind==='steps'){for(let j=0;j<3;j++)block(x+6+j*3,3,.5*scale*(j+1),env.id==='construction'?'concrete':'crate');}
   if(kind==='ledge'){block(x+6,3.4,.9*scale,env.id==='canyon'||env.id==='volcano'?'rock':'crate');block(x+14,3.4,1.1*scale,env.id==='canyon'||env.id==='volcano'?'rock':'concrete');}
   if(kind==='logs')for(let j=0;j<3;j++){const h=(.7+j*.2)*scale;obstacles.push({kind:'log',x:x+5+j*5,y:h/2,width:h,height:h});}
   if(kind==='rocks')for(let j=0;j<5;j++)block(x+3+j*3,2,.3+(j%3)*.17,'rock');
  }
  return {name:title,hint,x};
 });
 const length=pieces.length*30+10;ground([[length-10,0],[length+15,0]]);
 const merged:Level['segments']=[];
 for(const s of segments){const prev=merged.at(-1);if(prev&&prev.points.at(-1)![0]===s.points[0][0]&&prev.points.at(-1)![1]===s.points[0][1])prev.points.push(...s.points.slice(1));else merged.push(s);}

 return {mode:'trials',id,name,subtitle:`${env.name.toUpperCase()} / TECHNICAL SECTIONS`,environment:env.id,length,targetSeconds:par,stars:[par,par+30,par+60],spawn:[2,1.9],segments:merged,obstacles,mechanisms,hazards,props,setPieces,checkpoints:[[30,0],[60,0]],finish:[length,0]};
}
export const trialsCourses:Level[]=recipes.map(r=>build(r.id,r.name,r.pieces,r.par));
export const trialsLevel=(id:number)=>trialsCourses.find(l=>l.id===id)??trialsCourses[0];
export type TrialRecord={faults:number;time:number};
export function trialsMedal(record:TrialRecord,par:number){return record.faults===0?(record.time<=par?'PLATINUM':'GOLD'):record.faults<=3?'SILVER':record.faults<=8?'BRONZE':'FINISHED';}
export function trialStars(record:TrialRecord){return record.faults===0?3:record.faults<=3?2:record.faults<=8?1:0;}
export function betterTrial(candidate:TrialRecord,current:TrialRecord|null){return !current||candidate.faults<current.faults||(candidate.faults===current.faults&&candidate.time<current.time);}
export function readTrialRecord(id:number):TrialRecord|null{try{const r=JSON.parse(localStorage.getItem(`revbike-trials-${id}`)??'null');return r&&Number.isInteger(r.faults)&&r.faults>=0&&Number.isFinite(r.time)&&r.time>=0?r:null;}catch{return null;}}
