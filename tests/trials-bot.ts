// A rule-based Trials rider for regression tests. It only presses the same
// W / S / A / D keys a player has and never moves bodies directly. Like a
// practised player, it uses the technique that suits the current section.
import {RAPIER,type Controls,type Simulation} from '../src/physics';
import type {PieceKind} from '../src/trials';
import {neutral} from './driver';

const RAY_GROUPS=0x00010002;
/** Height of the riding surface at x (terrain, obstacles, decks), ignoring sensors and the bike. */
export function surfaceAt(sim:Simulation,x:number,from=30){
 const ray=new RAPIER.Ray({x,y:from},{x:0,y:-1});
 const hit=sim.world.castRay(ray,80,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,RAY_GROUPS);
 return hit?from-hit.timeOfImpact:-20;
}
const slopeAt=(sim:Simulation,x:number)=>Math.atan2(surfaceAt(sim,x+.4)-surfaceAt(sim,x-.4),.8);

export interface BotState{phase:'ride'|'lift'|'pop'|'drive'|'load'|'wheelie'|'snap'|'gapLift';timer:number;edge:number;top:number;}
export const newBot=():BotState=>({phase:'ride',timer:0,edge:0,top:0});
const set=(bot:BotState,phase:BotState['phase'])=>{if(bot.phase!==phase){bot.phase=phase;bot.timer=0;}};

export function trialsBot(sim:Simulation,bot:BotState,kind:PieceKind):Controls{
 const frame=sim.bike.frame,p=frame.translation(),v=frame.linvel(),angle=frame.rotation(),w=frame.angvel();
 const rear=sim.bike.wheels[0].translation(),front=sim.bike.wheels[1].translation(),r=sim.dimensions.wheelRadius;
 bot.timer+=1/120;
 if(kind.startsWith('climb')){
  // Momentum and weight forward on the face; level the bike in the air.
  const local=slopeAt(sim,p.x),onFace=local>.3||slopeAt(sim,front.x+.5)>.3,approach=surfaceAt(sim,front.x+3)-surfaceAt(sim,front.x)>1.3;
  if(onFace||approach||!sim.grounded&&v.y>0){
   // Ease off when the nose rises past the face, so the engine does not loop it.
   const chord=Math.atan2(surfaceAt(sim,front.x)-surfaceAt(sim,rear.x),front.x-rear.x),c=-angle*4-w*2,wheelie=angle-Math.max(0,chord)>.45;
   return {...neutral,gas:sim.grounded&&!wheelie&&(onFace||v.x<8),right:sim.grounded||c<-.2,left:!sim.grounded&&c>.2};
  }
 }
 // Standing wheelie up a tall face: hold ~40° with A + feathered gas until the
 // front tyre is over the lip, load the rear (A), then snap D with gas.
 if(bot.phase==='wheelie'){
  if(front.x>bot.edge&&front.y>bot.top+.5)set(bot,'snap');
  else if(bot.timer<4)return {...neutral,left:angle<.7,right:angle>1,gas:angle<.7};
  else set(bot,'ride');
 }
 if(bot.phase==='snap'){if(bot.timer>.15){set(bot,'pop');return {...neutral,right:true,gas:true};}return {...neutral,left:true,gas:true};}
 // Gap: small manual so the front floats over, then pop the rear as it reaches the edge.
 if(bot.phase==='gapLift'){
  if(rear.x>bot.edge-.5){set(bot,'pop');return {...neutral,right:true,gas:true};}
  if(bot.timer<.15)return {...neutral,left:true};
  if(bot.timer<3)return {...neutral,left:angle<.3,right:angle>.6,gas:angle<.3&&v.x<4.2};
  set(bot,'ride');
 }
 const groundSlope=slopeAt(sim,(rear.x+front.x)/2),under=surfaceAt(sim,front.x);
 if(!sim.grounded){
  // Air: match the surface below, nose slightly up so the rear lands first.
  // Landing slope: sample ahead, ignoring vertical faces (a cliff is not a landing surface).
  const slopes=[.4,.9,1.4,1.9].map(d=>slopeAt(sim,p.x+v.x*.15+d)).filter(a=>Math.abs(a)<1.15);
  const landing=slopes.length?slopes.reduce((a,b)=>a+b)/slopes.length:0;
  const target=Math.max(-1,Math.min(1,landing))+.2,c=(target-angle)*4-w*1.4;
  return {...neutral,left:c>.25,right:c<-.25};
 }
 const levelErr=angle-groundSlope;
 if(bot.phase==='pop'){if(bot.timer>.4)set(bot,'drive');return {...neutral,right:true,gas:true};}
 if(bot.phase==='drive'){if(bot.timer>.5||kind==='precision')set(bot,'ride');else return {...neutral,right:levelErr>-.1,left:levelErr<-.3,gas:v.x<2.5||levelErr<-.2};}
 // Rolling off an edge: keep the front up and let the rear lead.
 if(front.y<rear.y-.6)return {...neutral,left:true,brake:v.x>3.2&&levelErr>-.15};
 // Scan ahead of the front tyre for a near-vertical step or a drop.
 let step=0,stepX=Infinity,dropX=Infinity;
 for(let d=.1;d<=4;d+=.1){
  const h=surfaceAt(sim,front.x+d)-under;
  if(h>.32&&stepX===Infinity&&(d<=3.2||kind==='wall')&&surfaceAt(sim,front.x+d)-surfaceAt(sim,front.x+d-.1)>.25)stepX=d;
  if(stepX<Infinity&&d<stepX+1.2)step=Math.max(step,h);
  if(h<-.9&&dropX===Infinity&&d<=3.2)dropX=d;
 }
 if(kind==='precision'&&dropX<Infinity&&dropX<stepX){
  if(dropX<2.1&&v.x<2){bot.edge=front.x+dropX;set(bot,'gapLift');return {...neutral,left:true,gas:true};}
  if(dropX<2.1)return {...neutral,brake:true};
  return {...neutral,gas:v.x<1.4,brake:v.x>1.7};
 }
 if(kind==='wall'&&stepX<Infinity&&stepX<dropX&&step>.8){
  // Tall face: stop 2–3 m out, then standing wheelie.
  if(stepX>3.3)return {...neutral,gas:v.x<1.2,brake:v.x>1.6};
  if(Math.abs(v.x)>.3)return {...neutral,brake:true};
  bot.edge=front.x+stepX;bot.top=under+step;set(bot,'wheelie');return {...neutral,left:true,gas:true};
 }
 if(stepX<Infinity&&stepX<dropX){
  // Step-up: crawl in, A + gas lofts the front onto the lip, then A → D pop.
  const frontOnTop=front.y-r>under+step-.25||surfaceAt(sim,front.x)>under+.25;
  if(bot.phase==='lift'&&frontOnTop&&bot.timer>.15){set(bot,'pop');return {...neutral,right:true,gas:true};}
  if(stepX<1.5+Math.min(1.2,step)*.5&&Math.abs(v.x)<2.4){
   set(bot,'lift');const tooHigh=levelErr>Math.min(1.1,.45+step*.45);
   return {...neutral,left:!tooHigh,gas:!tooHigh,right:tooHigh};
  }
  return {...neutral,gas:v.x<(stepX<3?1.3:2),brake:v.x>(stepX<3?1.9:3),right:levelErr>.15};
 }
 // Rear tyre still climbing a lip the front already cleared.
 if(surfaceAt(sim,rear.x+r*.8)-surfaceAt(sim,rear.x)>.3)return {...neutral,right:true,gas:true};
 if(dropX<Infinity){
  // Big drop: arrive with a little speed and wheelie off so the rear lands first.
  // Manual: hold the front ~20° up with A and feathered gas, rolling slowly.
  if(dropX<3)return {...neutral,left:levelErr<.35,right:levelErr>.6,gas:levelErr<.3,brake:v.x>3.6&&levelErr>.2};
  return {...neutral,gas:v.x<1.8,brake:v.x>2.4,right:levelErr>.15};
 }
 set(bot,'ride');
 if(levelErr<-.22)return {...neutral,left:true,gas:levelErr<-.4};
 const uphill=groundSlope>.12||surfaceAt(sim,front.x+1.5)-under>.3;
 const cruise=kind==='drop'?2.2:2.6;
 return {...neutral,gas:v.x<cruise,brake:v.x>cruise+1&&levelErr>-.1,right:levelErr>.12||uphill&&levelErr>-.05,left:levelErr<-.15&&!uphill};
}

/** The section the bike is currently riding. */
export function pieceAt(sim:Simulation,x:number):PieceKind{
 return ([...(sim.level.setPieces??[])].reverse().find(s=>x>=s.x-10)?.kind??'curbs') as PieceKind;
}
/** Ride from x0 until x1 (or crash / timeout). Returns the outcome. */
export function rideSection(sim:Simulation,x0:number,x1:number,seconds=40){
 // Scene queries become valid after the first world step.
 sim.restartRound();sim.step(neutral);sim.spawn([x0,surfaceAt(sim,x0)+1.9]);
 for(let i=0;i<60;i++)sim.step(neutral);
 const bot=newBot();let i=0;
 for(;i<120*seconds&&!sim.crashed&&sim.bike.frame.translation().x<x1;i++)sim.step(trialsBot(sim,bot,pieceAt(sim,sim.bike.frame.translation().x)));
 return {cleared:!sim.crashed&&sim.bike.frame.translation().x>=x1,crashed:sim.crashed,reason:sim.crashReason,x:sim.bike.frame.translation().x,seconds:i/120};
}
