export const GARAGE_KEY='revbike-garage-v1';
export const bikes=[
 {id:'trail',name:'Trail 250',tag:'BALANCED',required:0,torque:88,grip:4.2,speed:18,description:'Your starting trials bike. Strong grip, enlarged tires, long rear swingarm.'},
 {id:'crawler',name:'Rock Crawler',tag:'HIGH GRIP',required:1,torque:86,grip:4.8,speed:16,description:'Deep tread, a bash plate and extra traction for technical sections.'},
 {id:'section',name:'Section R',tag:'RESPONSIVE',required:5,torque:92,grip:4.2,speed:19,description:'A compact trials body with a sharper low-speed engine response.'},
] as const;
export type Appearance={bike:typeof bikes[number]['id'];paint:string;jersey:string;helmet:string;number:number};
export const DEFAULT_APPEARANCE:Appearance={bike:'trail',paint:'#f77b35',jersey:'#3d7467',helmet:'#f4f4e7',number:7};
export const paintColors=['#f77b35','#57c8dd','#a8cf54','#e25962','#f3f0df'];
export function normalizeAppearance(value:unknown,completed:number):Appearance{
 const r=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const color=(v:unknown,fallback:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:fallback;
 const bike=bikes.find(b=>b.id===r.bike&&b.required<=completed)?.id??'trail';
 return {bike,paint:color(r.paint,DEFAULT_APPEARANCE.paint),jersey:color(r.jersey,DEFAULT_APPEARANCE.jersey),helmet:color(r.helmet,DEFAULT_APPEARANCE.helmet),number:typeof r.number==='number'&&Number.isInteger(r.number)&&r.number>=1&&r.number<=99?r.number:7};
}
