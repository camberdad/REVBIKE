import * as T from 'three';
import type {Level,TrackProp} from './track';
import {sampleSegment} from './track';
import {themeFor} from './campaign';
const mat=(color:number,glow=false)=>glow?new T.MeshBasicMaterial({color}):new T.MeshStandardMaterial({color,roughness:.85});
const wood=mat(0x8c5937),dark=mat(0x283638),steel=mat(0x73818b),yellow=mat(0xf4bf3c),red=mat(0xa24438),white=mat(0xe4e8ce);
function box(parent:T.Object3D,w:number,h:number,d:number,m:T.Material,x=0,y=0,z=0){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function rod(parent:T.Object3D,a:number[],b:number[],r:number,m:T.Material){const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);const mesh=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),8),m);mesh.position.copy(p.add(q).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());parent.add(mesh);return mesh;}
function disk(parent:T.Object3D,r:number,m:T.Material,x:number,y:number,z:number){const mesh=new T.Mesh(new T.CylinderGeometry(r,r,.8,16),m);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
function prop(scene:T.Object3D,p:TrackProp){
 const g=new T.Group();g.position.set(p.x,p.y,-2.6);scene.add(g);const w=p.width??8,h=p.height??5;
 switch(p.kind){
  case 'barn':{
   box(g,w*.18,h,.4,red,-w*.43,h/2,-1);box(g,w*.18,h,.4,red,w*.43,h/2,-1);
   box(g,w,h*.23,.3,red,0,h*.16,-1.2);
   rod(g,[-w/2,h,0],[0,h+3,0],.17,wood);rod(g,[w/2,h,0],[0,h+3,0],.17,wood);
   for(const x of [-w/2,w/2])rod(g,[x,0,0],[x,h,0],.16,white);break;
  }
  case 'hay':box(g,w,h,2.8,mat(0xcbae51),0,0,-.2);for(const x of [-w*.3,w*.3])box(g,.1,h+.05,2.85,wood,x,0,-.15);break;
  case 'log':disk(g,h/2,wood,0,0,1.4);disk(g,h*.38,mat(0xc79761),0,0,1.85);break;
  case 'puddle':box(g,w,.12,3,mat(0x556f8b),0,0,0);break;
  case 'container':box(g,w,h,3,mat(0xb96e3c),0,0,0);for(let x=-w/2;x<=w/2;x+=.6)box(g,.07,h,.12,yellow,x,0,1.55);break;
  case 'tractor':box(g,4.2,1.8,2,mat(0x6b974f),0,1,0);box(g,1.7,2.5,2,mat(0x7ca75d),-1,2.5,0);box(g,1.1,1,.1,mat(0x97cada),-1,2.8,1.1);for(const x of [-2,2]){disk(g,x<0?1.5:1,dark,x,0,1.3);disk(g,.5,yellow,x,0,1.8);}rod(g,[1,1,0],[1,3.5,0],.12,dark);break;
  case 'hoop':{const r=w/2,ring=new T.Mesh(new T.TorusGeometry(r,.16,7,56),mat(0xff9a35,true));ring.position.z=2.8;g.add(ring);for(let j=0;j<32;j++){const a=j/32*Math.PI*2,f=new T.Mesh(new T.ConeGeometry(.18,.7,5),mat(j%2?0xffc63d:0xff5732,true));f.position.set(Math.cos(a)*(r+.25),Math.sin(a)*(r+.25),2.7);f.rotation.z=a-Math.PI/2;g.add(f);}break;}
  case 'magnet':case 'roof':box(g,w,.25,2,p.kind==='magnet'?mat(0x55f5f1,true):steel,0,0,0);break;
  case 'woodRamp':for(let j=0;j<8;j++)box(g,.18,h*(j+1)/8,2.2,wood,-w/2+j*w/8,-h/2+h*(j+1)/16,0);break;
  case 'tunnel':for(const x of [-w/2,w/2]){rod(g,[x,0,0],[x,h,0],.22,wood);rod(g,[x,h,0],[x+3,h+1,0],.14,wood);}box(g,w,.5,2,wood,0,h,0);break;
  case 'tower':box(g,w,h,7,mat(0x6d6770),0,-h/2,0);for(let x=-w/2+1;x<w/2;x+=3)for(let y=-h+1;y<0;y+=3)box(g,1.5,1.3,.1,mat(0xf3ba71,true),x,y,3.6);break;
  default:for(const x of [-w/2,w/2])rod(g,[x,0,0],[x,h,0],.15,p.kind==='bridge'||p.kind==='platform'?wood:steel);rod(g,[-w/2,0,0],[w/2,h,0],.1,steel);rod(g,[w/2,0,0],[-w/2,h,0],.1,steel);box(g,w,.18,2,p.kind==='platform'?wood:steel,0,h,0);
   if(p.kind==='crane'){rod(g,[0,h,0],[0,h+5,0],.13,yellow);box(g,w*1.5,.3,.4,yellow,2,h+5,0);}
 }
}
export function buildCampaignScenery(scene:T.Scene,near:T.Group,far:T.Group,level:Level){
 const theme=themeFor(level);scene.background=new T.Color(theme.sky);scene.add(near,far);
 const count=Math.ceil(level.length/18)+8;
 for(let i=-5;i<count;i++){
  for(const [parent,z,color,offset]of [[far,-42,theme.far,5],[near,-25,theme.hill,0]] as const){
   if(level.environment==='construction'||level.environment==='neon')continue;
   const x=i*21+offset,h=level.environment==='countryside'?2+(Math.sin(i*4)+1)*1.3:6+(Math.sin(i*4)+1)*4,shape=new T.Shape();shape.moveTo(x-17,-12);shape.lineTo(x-17,-3);
   if(level.environment==='countryside')shape.bezierCurveTo(x-14,h+2,x+12,h+2,x+18,-3);
   else{shape.lineTo(x-8,h*.7);shape.lineTo(x-4,h);shape.lineTo(x+4,h*.9);shape.lineTo(x+18,-3);}
   shape.lineTo(x+18,-12);shape.closePath();const m=new T.Mesh(new T.ShapeGeometry(shape),mat(color,true));m.position.z=z;parent.add(m);
  }
  if(level.environment==='construction'||level.environment==='neon'){
   const h=level.environment==='construction'?3+(Math.sin(i*13)+1)*2.5:7+(Math.sin(i*13)+1)*5;box(far,8,h,1,mat(theme.hill,true),i*15,h/2-6,-35);
   if(level.environment==='construction'){rod(far,[i*15,0,-34],[i*15,h+1,-34],.08,steel);rod(far,[i*15-5,h+1,-34],[i*15+11,h+1,-34],.08,steel);}
   else for(let j=0;j<3;j++)box(far,.09,h*.7,1,mat(j%2?0xfb51cb:0x50eeee,true),i*15+j*2-2,h/2,-33);
  }
 }
 const groundAt=(x:number)=>{const segment=level.segments.find(s=>x>=s.points[0][0]&&x<=s.points.at(-1)![0]);if(!segment)return 0;return sampleSegment(segment).reduce((a,b)=>Math.abs(a[0]-x)<Math.abs(b[0]-x)?a:b)[1];};
 if(level.environment==='countryside'){
  for(let x=-10;x<level.length;x+=6){const y=groundAt(x);box(scene,.14,1.5,.14,wood,x,y+.5,-3.1);box(scene,6,.09,.1,wood,x+3,y+.7,-3.1);box(scene,6,.09,.1,wood,x+3,y+1.2,-3.1);}
  for(let x=72;x<level.length;x+=145)prop(near,{kind:'barn',x,y:-1,width:13,height:7});
 }
 if(level.environment==='canyon')for(let x=15;x<level.length;x+=42)prop(scene,{kind:'tunnel',x,y:groundAt(x)-.2,width:12,height:8});
 if(level.environment==='neon')for(let x=-15;x<level.length;x+=12){const y=groundAt(x);box(scene,8,.09,.1,mat((x/12)%2?0x4cf4e6:0xf64ccb,true),x,y-.4,1.1);box(scene,.2,18,.2,steel,x,y+7,-8);}
 if(level.environment==='volcano'){
  box(scene,level.length+80,.35,12,mat(0xff6428,true),level.length/2,-5,-3);
  for(let x=-12;x<level.length;x+=16){const y=3+Math.sin(x)*6;const rock=new T.Mesh(new T.DodecahedronGeometry(.1,0),mat(0xf99553,true));rock.position.set(x,y,-12);scene.add(rock);}
 }
 for(const p of level.props??[])prop(scene,p);
 const sun=new T.Mesh(new T.CircleGeometry(2.5,36),mat(level.environment==='countryside'?0xffed9e:level.environment==='volcano'?0xef694c:0xffd3a1,true));sun.position.set(20,15,-45);far.add(sun);
}
