import recipes from './trials.json';
import {environments} from './campaign';
import {sampleSegment,type Level,type Point} from './track';

export type PieceKind='curbs'|'steps'|'ledge'|'wall'|'beam'|'seesaw'|'bridge'|'climb55'|'climb60'|'climb65'|'drop'|'precision'|'logs'|'rocks';
/** Every Trials section is 30 m long and starts and ends on flat ground at y = 0. */
export const SECTION_LENGTH=30;
const hints:Record<PieceKind,[string,string]>={
 curbs:['Feather control','Tap W for short bursts. Full gas lifts the front, so lean forward (D) or use Shift + W.'],
 steps:['Crate staircase','A + a gas pulse lifts the front onto each crate; snap D with gas to bring the rear up.'],
 ledge:['Vertical ledges','Roll in slowly. A + gas lofts the front onto the lip; D + gas pulls the rear over.'],
 wall:['Step-up wall','Front wheel onto the lip, then hold A and snap to D with gas to pop the rear up.'],
 beam:['Balance plank','A narrow plank over the pit. Small taps of gas, and S stops you dead before the end.'],
 seesaw:['Teeter-totter','Creep up and stop past the pivot so it tips. Too much gas throws you off the end.'],
 bridge:['Rickety bridge','The planks sag and sway. Smooth throttle, weight centred, no sudden bursts.'],
 climb55:['55° rocky climb','Lean forward with D and feather the gas over the bumps. Too much loops you out.'],
 climb60:['60° rock face','Lean far forward. Short gas bursts keep the rear tyre biting on the rocks.'],
 climb65:['65° expert face','Set your approach, weight forward, feather torque. Over the top, land rear-first.'],
 drop:['Sheer drop','Stop at the edge, lean back with A and roll off. Land rear wheel first.'],
 precision:['Zero-speed gaps','Stop on each pillar. Hold A, then snap to D with gas to hop the gap.'],
 logs:['Log trial','Lift onto each log, then shift forward to bring the rear wheel over.'],
 rocks:['Rock garden','Match each small slope and control the tyre contact with your body position.'],
};
const surfaceY=(points:Point[],x:number)=>{
 const p=sampleSegment({points,smooth:true});
 for(let i=1;i<p.length;i++)if(p[i][0]>=x){const t=(x-p[i-1][0])/Math.max(1e-6,p[i][0]-p[i-1][0]);return p[i-1][1]+(p[i][1]-p[i-1][1])*t;}
 return p.at(-1)![1];
};
function build(id:number,name:string,pieces:PieceKind[],par:number):Level{
 const env=environments[Math.floor((id-1)/6)],scale=1+Math.floor((id-1)/6)*.06,tall=Math.min(scale,1.06);
 const segments:Level['segments']=[],obstacles:NonNullable<Level['obstacles']>=[],mechanisms:NonNullable<Level['mechanisms']>=[],hazards:Level['hazards']=[],props:NonNullable<Level['props']>=[];
 const ground=(points:Point[])=>{segments.push({points,smooth:true});return points;};
 const rockKind=env.id==='canyon'||env.id==='volcano'?'rock':env.id==='construction'||env.id==='neon'?'concrete':'crate';
 const block=(x:number,w:number,h:number,kind:'crate'|'concrete'|'rock'='crate',bottom=0)=>obstacles.push({kind,x,y:(h+bottom)/2,width:w,height:h-bottom,radius:.1});
 const pit=(x:number,width:number,y=-4)=>hazards.push({type:env.id==='volcano'?'lava':env.id==='neon'?'laser':'mud',x,y,width});
 ground([[-40,0],[0,0]]);
 const setPieces=pieces.map((kind,i)=>{
  const x=10+i*SECTION_LENGTH,[title,hint]=hints[kind];
  if(kind==='beam'){
   // Narrow suspended plank: ride up, cross slowly, step down off the far end.
   const h=1.3;
   ground([[x-10,0],[x+1,0],[x+4.9,h]]);
   mechanisms.push({kind:'flex',x:x+9.5,y:h-.17,width:9.2});
   ground([[x+14.1,h-.55],[x+18,0],[x+20,0]]);pit(x+9.5,9);
  }else if(kind==='seesaw'){
   // Teeter-totter: rests tipped toward the rider and drops once weight passes the pivot.
   mechanisms.push({kind:'seesaw',x:x+9.5,y:.95,width:9,angle:.17});
   ground([[x-10,0],[x+2,0],[x+4.95,.3]]);ground([[x+14.05,.3],[x+17,0],[x+20,0]]);pit(x+9.5,8);
  }else if(kind==='bridge'){
   // Rickety bridge: eight hinged planks with slack hang between two posts.
   const h=1.2,start=x+4,span=11,n=8,w=1.39,theta=Math.acos(span/(n*w));
   ground([[x-10,0],[x+1,0],[start-.1,h+.12]]);
   let px=start,py=h;
   for(let j=0;j<n;j++){const a=j<n/2?-theta:theta,cx=px+Math.cos(a)*w/2,cy=py+Math.sin(a)*w/2;mechanisms.push({kind:'bridge',x:cx,y:cy,width:w,angle:a,link:j>0});px+=Math.cos(a)*w;py+=Math.sin(a)*w;}
   ground([[start+span+.1,h+.12],[x+18,0],[x+20,0]]);pit(start+span/2,span-1);
  }else if(kind==='precision'){
   // Zero-speed gaps: three short pillars over a pit. The 1.4 m gaps are wider
   // than the tyre, so rolling across drops a wheel in; wheelie + A → D pops it.
   const tops=[.6,.95,1.3],width=4.4,gap=1.1;
   ground([[x-10,0],[x-1.5,0],[x+2.4,.6]]);
   tops.forEach((top,j)=>{const left=x+2+j*(width+gap);block(left+width/2,width,top,j===1?rockKind:'concrete',-3.4);});
   const end=x+2+3*width+2*gap;
   ground([[x+4,-3],[end-2,-3]]);pit((x+2+end)/2,end-x-4,-2.8);
   ground([[end-.2,0],[x+20,0]]);
  }else if(kind.startsWith('climb')){
   const angle=Number(kind.slice(5)),h=angle===55?3.3:angle===60?4:4.6,w=(h-.3)*1.43/Math.tan(angle*Math.PI/180);
   // A short transition at the base, then a face whose steepest point matches the named angle.
   const points=ground([[x-10,0],[x+2.5,0],[x+4.6,.3],[x+4.6+w,h],[x+9.6+w,h],[x+9.6+w+(h-.5),.5],[x+19,0],[x+20,0]]);
   // Rocky bumps embedded in the face.
   if(angle===55)for(const t of [.3,.7]){const sx=x+4.6+w*t,r=.13;obstacles.push({kind:'stone',x:sx,y:surfaceY(points,sx)-.04,width:r*2,height:r*2});}
   props.push({kind:'tunnel',x:x+8,y:0,width:12,height:7});
  }else if(kind==='drop'){
   // Ride up to a ledge and roll off a sheer vertical face.
   const h=1.9;
   ground([[x-10,0],[x+1,0],[x+5.5,h],[x+10.5,h],[x+10.56,0],[x+20,0]]);
  }else if(kind==='wall'){
   ground([[x-10,0],[x+20,0]]);
   block(x+8,5,1.45*Math.min(scale,1.12),rockKind==='crate'?'concrete':rockKind);
  }else{
   ground([[x-10,0],[x+20,0]]);
   if(kind==='curbs'){block(x+5,2.5,.28*scale);block(x+10.5,2.5,.45*scale);block(x+16.5,2,.6*scale,'concrete');}
   if(kind==='steps'){for(let j=0;j<3;j++)block(x+6+j*3,3,.5*tall*(j+1),env.id==='construction'?'concrete':'crate');}
   if(kind==='ledge'){block(x+6,3.4,.9*tall,rockKind==='concrete'?'crate':rockKind);block(x+14,3.4,1.1*tall,rockKind==='crate'?'concrete':rockKind);}
   if(kind==='logs')for(let j=0;j<3;j++){const h=(.7+j*.2)*scale;obstacles.push({kind:'log',x:x+5+j*5,y:h/2,width:h,height:h});}
   if(kind==='rocks')for(let j=0;j<5;j++)block(x+3+j*3,2,.3+(j%3)*.17,'rock');
  }
  return {name:title,hint,x,kind};
 });
 const length=pieces.length*SECTION_LENGTH+10;ground([[length-10,0],[length+15,0]]);
 const merged:Level['segments']=[];
 for(const s of segments){const prev=merged.at(-1);if(prev&&prev.points.at(-1)![0]===s.points[0][0]&&prev.points.at(-1)![1]===s.points[0][1])prev.points.push(...s.points.slice(1));else merged.push(s);}
 const checkpoints=pieces.slice(1).map((_,i)=>[10+(i+1)*SECTION_LENGTH-10,0]);
 return {mode:'trials',id,name,subtitle:`${env.name.toUpperCase()} / TECHNICAL SECTIONS`,environment:env.id,length,targetSeconds:par,stars:[par,par+30,par+60],spawn:[2,1.9],segments:merged,obstacles,mechanisms,hazards,props,setPieces,checkpoints,finish:[length,0]};
}
export const trialsCourses:Level[]=recipes.map(r=>build(r.id,r.name,r.pieces as PieceKind[],r.par));
export const trialsLevel=(id:number)=>trialsCourses.find(l=>l.id===id)??trialsCourses[0];
export type TrialRecord={faults:number;time:number};
export function trialsMedal(record:TrialRecord,par:number){return record.faults===0?(record.time<=par?'PLATINUM':'GOLD'):record.faults<=3?'SILVER':record.faults<=8?'BRONZE':'FINISHED';}
export function trialStars(record:TrialRecord){return record.faults===0?3:record.faults<=3?2:record.faults<=8?1:0;}
export function betterTrial(candidate:TrialRecord,current:TrialRecord|null){return !current||candidate.faults<current.faults||(candidate.faults===current.faults&&candidate.time<current.time);}
export function readTrialRecord(id:number):TrialRecord|null{try{const r=JSON.parse(localStorage.getItem(`revbike-trials-${id}`)??'null');return r&&Number.isInteger(r.faults)&&r.faults>=0&&Number.isFinite(r.time)&&r.time>=0?r:null;}catch{return null;}}
