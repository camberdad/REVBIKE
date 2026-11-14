import definitions from './campaign.json';
import type {Environment,Level,Mechanism,Point,TrackProp,Hazard} from './track';
export const environments:{id:Environment;name:string;range:string;sky:number;hill:number;far:number;road:number;dirt:number;accent:number}[]=[
 {id:'countryside',name:'Countryside',range:'01–05',sky:0x74caff,hill:0x77b35a,far:0xa4ce83,road:0x735638,dirt:0xb58951,accent:0xd8ef68},
 {id:'construction',name:'Construction',range:'06–10',sky:0xf6a268,hill:0x806a78,far:0xb18886,road:0x515f69,dirt:0x8e7760,accent:0xffca45},
 {id:'canyon',name:'Canyon Mines',range:'11–15',sky:0xe6b78b,hill:0x9c543b,far:0xc58058,road:0x75523a,dirt:0xab6343,accent:0xf3ca82},
 {id:'neon',name:'Neon Factory',range:'16–20',sky:0x101829,hill:0x24354b,far:0x1a263c,road:0x546274,dirt:0x263244,accent:0x52f3ef},
 {id:'volcano',name:'Volcanic Wasteland',range:'21–25',sky:0x561c2c,hill:0x3e303c,far:0x713743,road:0x34323c,dirt:0x4a3640,accent:0xff7840},
];
export const themeFor=(level:Level)=>environments.find(e=>e.id===level.environment)??environments[2];

const hints:Record<string,[string,string]>={
 doubleloop:['Back-to-back loops','Carry speed from the first loop across the saw gap into the second.'],
 loopfinale:['Loop to mega-ramp','Exit the loop straight into the boosted vertical kicker.'],
 rolling:['Rolling dirt hills','Use W / ↑ to find your rhythm.'],kicker:['Wooden kicker','Keep the wheels level over the mud.'],downhill:['Downhill run','Build speed, then ease the pitch.'],hay:['Hay-bale hop','Hold A deliberately to lift the front tire.'],bridge:['Creek crossing','Stay centered across the wooden bridge.'],backflip:['First backflip','Hold A in the air; release before landing.'],seesaw:['Pivot bridge','Ride the plank as it tips under your weight.'],climb:['Steep dirt climb','Lean forward with D / →.'],whoops:['Rhythm whoops','Small pitch corrections keep both tires flowing.'],drop:['Platform drop','Let the suspension take the landing.'],barn:['Through the barn','Jump through the opening in the roof.'],logs:['Triple-log climb','Lift the front wheel over each rounded log.'],tractor:['Tractor mega-ramp','Build speed for the long jump.'],landing:['Steep landing','Match the slope before touchdown.'],containers:['Container staircase','Use deliberate wheelies on the rounded step ramps.'],flex:['Flexible steel ramp','The spring-mounted steel gives beneath the bike.'],wrecking:['Wrecking-ball crossing','Brake to time the swinging ball.'],crane:['Crane-platform drop','Point the wheels at the broad landing.'],lift:['Hydraulic elevator','Land on the platform; wait for it to rise.'],scaffold:['Upper scaffolding','Carry momentum between the decks.'],rollers:['Reverse pipe rollers','Hold throttle against the turning pipes.'],tnt:['TNT bridge','Contact starts the fuse. Keep moving.'],girders:['Girder gaps','Keep a steady angle across each roof.'],slide:['Steel slide','Stay low over the fast transition.'],skyscraper:['Skyscraper leap','Commit to the rooftop gap.'],halfpipe:['Rail half-pipe','Carry speed up the curved railway kicker.'],canyon:['Canyon chasm','Aim for the broad far bank.'],rockslide:['Rockslide chase','Cross the trigger; rolling rocks follow.'],rockramp:['Rock ramps','Keep the bike aligned with the slope.'],loop:['360° loop','Enter at speed and follow the curve with your lean.'],climb45:['45° rocky incline','Keep your weight forward on the climb.'],collapse:['Rickety bridge','Planks fall 0.4 seconds after tire contact.'],cavern:['Cavern drop','Prepare for the long downhill landing.'],tunnel:['Speed tunnel','Tuck into the descent and build speed.'],doubleflip:['Double-backflip gorge','The tall kicker gives room for two rotations.'],mineexit:['Mine exit','Land clean and sprint into daylight.'],forwardbelt:['Forward conveyor','The belt adds speed under the tires.'],reversebelt:['Reverse conveyor','Feed in throttle to beat the backward belt.'],lasers:['Laser pits','Use the kickers to clear the glowing pits.'],crusher:['Hydraulic press','Brake for the press, then burst through.'],grate:['Metal-grate sprint','Keep moving through the last press.'],spring:['Spring catapult','Touch the yellow pad to reach the upper deck.'],saws:['Sawblade gap','Align the landing between the spinning blades.'],sawgap:['Mid-air saw gap','Hold your line between the two loops.'],glass:['Collapsing glass','The cyan glass breaks after you touch it.'],boost:['Turbo strips','Boost builds momentum for the launch.'],quarter:['Quarter-pipe escape','Follow the vertical curve out of the roof.'],platforms:['Obsidian islands','Tap the brake to control each small gap.'],precision:['Final lava crossing','Use small A / D corrections.'],hoops:['Ring of fire','Fly through the center of the flaming hoop.'],axes:['Pendulum axes','Wait for the axe to swing clear.'],magnet:['Inverted magnetic rail','Blue rails pull the tires around onto the ceiling.'],volcanic:['Eruption run','Triggered volcanic rocks fall behind you.'],finale:['Magma mega-launch','Exit the loop and send the huge kicker.'],runway:['Final runway','Match the steep downhill and finish clean.'],
};

function build(id:number,name:string,kinds:string[],target:number):Level{
 const environment=environments[Math.floor((id-1)/5)].id;
 const segments:Level['segments']=[],hazards:Hazard[]=[],mechanisms:Mechanism[]=[],props:TrackProp[]=[],loops:NonNullable<Level['loop']>[]=[],paths:Point[][]=[],magneticPaths:Point[][]=[];
 const span=kinds.length===4?171:228;
 const add=(p:Point[])=>segments.push({points:p,smooth:true});
 const mech=(kind:Mechanism['kind'],x:number,y:number,width:number,extra:Partial<Mechanism>={})=>mechanisms.push({kind,x,y,width,...extra});
 const prop=(kind:string,x:number,y=0,width=8,height=5)=>props.push({kind,x,y,width,height});
 const gap=(x:number,y=-4,width=12)=>hazards.push({type:environment==='volcano'?'lava':environment==='neon'?'laser':'mud',x,y,width});
 add([[-30,0],[0,0]]);
 const setPieces=kinds.map((kind,i)=>{
  const x=20+i*span,[title,hint]=hints[kind];
  // Rounded approach and recovery rollers keep the entire run active.
  add([[x-20,0],[x-10,0],[x,0]]);
  const rampGap=(height=4,gapWidth=12,drop=0)=>{
   add([[x,0],[x+16,.25],[x+30,height*.35],[x+36,height]]);
   gap(x+36+gapWidth/2,-4,gapWidth);
   if(height>=5.5)mech('boost',x+9,-.13,18,{speed:32});
   add([[x+36+gapWidth,Math.max(-1,height-(height>=7?7:4))+drop],[x+57+gapWidth,.6],[x+76+gapWidth,0],[x+span-20,0]]);
  };
  switch(kind){
   case 'rolling':add([[x,0],[x+18,1],[x+36,.1],[x+55,1.7],[x+75,0],[x+94,1.2],[x+118,0],[x+span-20,0]]);break;
   case 'kicker':rampGap(2.7,8);prop('woodRamp',x+28,1.5,17,3);prop('puddle',x+40,-1,9,1);break;
   case 'hay':add([[x,0],[x+20,0],[x+24,1.2],[x+30,1.2],[x+34,2.3],[x+43,2.3],[x+49,0],[x+80,0],[x+98,2],[x+115,0],[x+span-20,0]]);for(const [dx,y]of [[27,.6],[38,1.2],[104,.8]])prop('hay',x+dx,y,5,2);break;
   case 'bridge':case 'tnt':case 'glass':case 'collapse':{
    add([[x,0],[x+24,0],[x+32,1],[x+40,1]]);add([[x+62,1],[x+75,0],[x+span-20,0]]);gap(x+51,-4,22);
    const breaking=kind==='collapse'||kind==='glass';
    for(let j=0;j<6;j++)mech(breaking?'collapse':'flex',x+41.8+j*3.7,0.88,3.8,{delay:breaking?.4:undefined});
    prop(kind==='glass'?'glass':'bridge',x+51,-1,22,3);
    if(kind==='tnt')for(let j=0;j<3;j++)hazards.push({type:'tnt',x:x+44+j*7,y:1.6,delay:.65});break;
   }
   case 'seesaw':{
    add([[x,0],[x+32,0],[x+40,.8]]);mech('seesaw',x+48,.7,16);add([[x+56,.8],[x+70,0],[x+96,1.7],[x+118,0],[x+span-20,0]]);gap(x+48,-4,16);break;
   }
   case 'climb':case 'climb45':add([[x,0],[x+24,0],[x+37,kind==='climb45'?11:8],[x+47,11],[x+70,7],[x+98,1],[x+span-20,0]]);break;
   case 'whoops':{const p:Point[]=[[x,0]];for(let j=0;j<10;j++)p.push([x+10+j*10,j%2?0:2.4]);p.push([x+span-20,0]);add(p);break;}
   case 'drop':case 'crane':case 'cavern':add([[x,0],[x+20,1],[x+36,7],[x+52,7]]);add([[x+58,2],[x+80,.3],[x+span-20,0]]);prop(kind==='crane'?'crane':'platform',x+45,3,18,7);break;
   case 'barn':rampGap(4.5,13);prop('barn',x+44,1,22,10);break;
   case 'logs':{const p:Point[]=[[x,0],[x+20,0]];for(let j=0;j<3;j++){const dx=28+j*14;p.push([x+dx-4,0],[x+dx,1+j*.2],[x+dx+4,0]);prop('log',x+dx,.4,3,1.6);}p.push([x+80,0],[x+span-20,0]);add(p);break;}
   case 'containers':add([[x,0],[x+14,0],[x+20,2.1],[x+32,2.1],[x+39,4.1],[x+52,4.1],[x+59,6.1],[x+78,6.1],[x+102,0],[x+span-20,0]]);for(let j=0;j<3;j++)prop('container',x+26+j*20,1+j*2,15,2);break;
   case 'flex':add([[x,0],[x+24,0],[x+35,3],[x+43,3]]);mech('flex',x+50,2.8,15,{angle:-.08});add([[x+58,1.5],[x+82,0],[x+span-20,0]]);break;
   case 'wrecking':case 'axes':add([[x,0],[x+span-20,0]]);hazards.push({type:kind==='axes'?'axe':'wrecking',x:x+57,y:2.3,radius:kind==='axes'?1:1.3,anchorY:8.5,amplitude:3.8,period:3.8,phase:i*.8});prop('crane',x+57,1,17,11);break;
   case 'lift':add([[x,0],[x+26,0],[x+35,.15]]);mech('lift',x+40,0,11,{rise:7,speed:3});add([[x+45,7],[x+56,7],[x+79,2],[x+106,0],[x+span-20,0]]);prop('scaffold',x+48,0,25,7);break;
   case 'rollers':add([[x,0],[x+24,0]]);for(let j=0;j<9;j++)mech('roller',x+25+j*1.9,-.85,1.9,{speed:1.7});add([[x+43,0],[x+60,0],[x+80,2.5],[x+100,0],[x+span-20,0]]);break;
   case 'girders':case 'scaffold':add([[x,0],[x+16,3],[x+31,5],[x+43,5]]);add([[x+50,2],[x+71,4],[x+92,0],[x+span-20,0]]);gap(x+47,-4,7);prop('scaffold',x+48,-1,65,5);break;
   case 'slide':case 'downhill':case 'tunnel':add([[x,0],[x+18,4],[x+34,7],[x+45,6],[x+70,1],[x+91,0],[x+112,2],[x+span-20,0]]);if(kind==='tunnel')prop('tunnel',x+55,0,70,11);break;
   case 'canyon':case 'halfpipe':rampGap(5.8,15);prop('rails',x+29,2,23,6);break;
   case 'rockslide':case 'volcanic':add([[x,0],[x+18,4],[x+30,6],[x+60,1],[x+80,0],[x+100,2],[x+span-20,0]]);for(let j=0;j<3;j++)hazards.push({type:'boulder',x:x+18-j*4,y:11+j*3,radius:.9+j*.15,triggerX:x+35+j*8});break;
   case 'doubleloop':{
    add([[x,0],[x+18,0],[x+32,0],[x+40,0],[x+45,2.2]]);
    add([[x+52,0],[x+60,0],[x+64,0],[x+90,0],[x+span-20,0]]);
    loops.push({x:x+32,y:5.5,radius:5.5},{x:x+64,y:5.5,radius:5.5});mech('boost',x+57,-.13,10,{speed:32});
    gap(x+48.5,-4,7);hazards.push({type:'saw',x:x+48.5,y:-1.3,radius:1});break;
   }
   case 'loopfinale':{
    add([[x,0],[x+30,0],[x+40,0],[x+56,.25],[x+70,3.85],[x+76,11]]);
    loops.push({x:x+30,y:5.5,radius:5.5});
    mech('boost',x+48,-.13,16,{speed:32});mech('boost',x+73,6.5,8,{angle:.95,speed:35});
    add([[x+94,0],[x+116,1],[x+145,0],[x+span-20,0]]);
    gap(x+85,-4,18);hazards.push({type:'saw',x:x+85,y:-1,radius:1.6});prop('hoop',x+86,13,5,5);break;
   }
   case 'loop':{const lx=x+70,r=5.5;add([[x,0],[x+20,0],[lx-1,0],[lx+20,0],[x+span-20,0]]);loops.push({x:lx,y:r,radius:r});break;}
   case 'forwardbelt':case 'reversebelt':add([[x,0],[x+27,0]]);mech('conveyor',x+46,-.13,38,{speed:kind==='forwardbelt'?9:-7});add([[x+65,0],[x+85,2.5],[x+106,0],[x+span-20,0]]);break;
   case 'crusher':case 'grate':add([[x,0],[x+span-20,0]]);for(let j=0;j<2;j++)hazards.push({type:'crusher',x:x+46+j*17,y:5,width:3,amplitude:3.2,period:3.7,phase:j*1.9});break;
   case 'spring':add([[x,0],[x+32,0]]);mech('spring',x+36,0,8,{rise:22});add([[x+54,6],[x+76,6],[x+104,2],[x+span-20,0]]);prop('scaffold',x+51,0,25,7);break;
   case 'boost':add([[x,0],[x+25,0],[x+65,0]]);mech('boost',x+45,-.1,40,{speed:16});add([[x+65,0],[x+84,3],[x+104,0],[x+span-20,0]]);break;
   case 'magnet':{
    add([[x,0],[x+30,0]]);
    const rail:Point[]=[];const r=5.5,cx=x+30,cy=5.5;
    for(let j=0;j<=100;j++){const a=-Math.PI/2+j/100*Math.PI;rail.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}
    for(let j=1;j<=80;j++)rail.push([cx-j*.32,11]);
    // The ceiling passes back over the approach, then curves down and exits forward.
    const ex=cx-25.6;
    for(let j=1;j<=100;j++){const a=Math.PI/2+j/100*Math.PI;rail.push([ex+Math.cos(a)*r,cy+Math.sin(a)*r]);}
    magneticPaths.push(rail);paths.push(rail);add([[x+30,0],[x+65,0],[x+90,2],[x+span-20,0]]);prop('magnet',x+18,11,36,1);break;
   }
   case 'platforms':case 'precision':{
    add([[x,0],[x+16,0],[x+22,.8]]);for(let j=0;j<6;j++){const start=x+25+j*10;add([[start,0],[start+3,.4],[start+7,.6]]);gap(start+8.5,-3.5,3);}add([[x+87,0],[x+span-20,0]]);break;
   }
   case 'hoops':rampGap(6,18);prop('hoop',x+45,7.3,4.6,4.6);break;
   case 'saws':case 'sawgap':case 'lasers':rampGap(4.5,12);if(kind!=='lasers')hazards.push({type:'saw',x:x+43,y:1.1,radius:1.2});break;
   case 'quarter':{add([[x,0],[x+27,0]]);add([[x+37,0],[x+80,0],[x+span-20,0]]);mech('boost',x+12,-.13,24,{speed:32});const curve:Point[]=[];for(let j=0;j<=80;j++){const a=-Math.PI/2+j/80*Math.PI/2*.85;curve.push([x+27+Math.cos(a)*9,9+Math.sin(a)*9]);}paths.push(curve);prop('roof',x+42,13,45,2);break;}
   case 'backflip':rampGap(5.5,14);break;
   case 'tractor':rampGap(7.5,12,-1);prop('tractor',x+47,-.2,10,4);prop('woodRamp',x+27,2,20,5);break;
   case 'doubleflip':case 'finale':rampGap(11,18,-4);mech('boost',x+33,6.5,8,{angle:.95,speed:35});if(kind==='finale'){hazards.push({type:'saw',x:x+51,y:1,radius:1.7});prop('hoop',x+48,12,5,5);}break;
   case 'skyscraper':rampGap(8,15,-1);prop('tower',x+24,-3,28,24);prop('tower',x+79,-3,30,24);break;
   case 'landing':case 'runway':case 'mineexit':case 'rockramp':rampGap(kind==='runway'?7:4,10);if(kind==='mineexit')prop('tunnel',x+90,0,28,9);break;
   default:throw new Error(`Missing set-piece ${kind}`);
  }
  return {name:title,hint,x};
 });
 const length=20+kinds.length*span;
 add([[length-20,0],[length+18,0]]);
 // Join contiguous curves before sampling so there are no internal collider seams.
 const merged:Level['segments']=[];
 for(const segment of segments){const previous=merged.at(-1);if(previous&&previous.points.at(-1)![0]===segment.points[0][0]&&previous.points.at(-1)![1]===segment.points[0][1])previous.points.push(...segment.points.slice(1));else merged.push({points:[...segment.points],smooth:true});}
 const checkpoints=[1,2].map(n=>[20+n*span,0]);
 return {id,name,environment,subtitle:`${environments[Math.floor((id-1)/5)].name.toUpperCase()} / ${name.toUpperCase()}`,length,stars:[target,target+9,target+20],targetSeconds:target,spawn:[2,1.55],segments:merged,hazards,checkpoints,finish:[length,0],mechanisms,props,loops,paths,magneticPaths,setPieces};
}
export const campaign:Level[]=definitions.map(({id,name,pieces,targetSeconds})=>build(id,name,pieces,targetSeconds));
export function campaignLevel(id:number){return campaign.find(level=>level.id===id)??campaign[0];}
export function starsFor(level:Level,time:number){return level.stars.filter(target=>time<target).length;}
