import RAPIER from '@dimforge/rapier2d-compat';
import type {Level,Mechanism} from './track';
import type {Bike} from './physics';
const GROUP=0x00020001,DT=1/120;
export interface MachineState{spec:Mechanism;body:RAPIER.RigidBody;collider:RAPIER.Collider;timer:number;activated:boolean;broken:boolean;cooldown:number;}
export interface MachinesSnapshot{items:{timer:number;activated:boolean;broken:boolean;cooldown:number;x:number;y:number;angle:number;vx:number;vy:number;spin:number}[];magnetProgress:number[];magnetDone:number[];}
export class CourseMachines{
 readonly items:MachineState[]=[];
 magnetic=false;
 magnetProgress:number[]=[];
 magnetDone=new Set<number>();
 constructor(private world:RAPIER.World,private level:Level,private terrain:Set<number>){
  for(const spec of level.mechanisms??[]){
   const rotating=spec.kind==='seesaw'||spec.kind==='flex';
   const desc=rotating?RAPIER.RigidBodyDesc.dynamic():RAPIER.RigidBodyDesc.kinematicPositionBased();
   const body=world.createRigidBody(desc.setTranslation(spec.x,spec.y).setRotation(spec.angle??0).setAngularDamping(2).setCcdEnabled(true));
   const shape=spec.kind==='roller'?RAPIER.ColliderDesc.ball(spec.width/2):RAPIER.ColliderDesc.roundCuboid(spec.width/2-.08,.09,.08);
   const collider=world.createCollider(shape.setMass(spec.kind==='seesaw'?3:1.8).setFriction(spec.kind==='roller'?2.4:1.5).setCollisionGroups(GROUP),body);
   if(spec.kind==='boost')collider.setSensor(true);else terrain.add(collider.handle);
   if(rotating){
    const anchor=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(spec.x,spec.y));
    const joint=world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0},{x:0,y:0}),anchor,body,true) as RAPIER.RevoluteImpulseJoint;
    joint.setLimits(spec.kind==='seesaw'?-.18:spec.width<5?-.025:-.12,spec.kind==='seesaw'?.18:spec.width<5?.025:.12);joint.setContactsEnabled(false);
   }
   this.items.push({spec,body,collider,timer:0,activated:false,broken:false,cooldown:0});
  }
 }
 private touching(item:MachineState,bike:Bike){
  if(item.spec.kind==='boost')return bike.wheels.some(w=>{const p=w.translation(),a=item.spec.angle??0,c=Math.cos(a),s=Math.sin(a),dx=p.x-item.spec.x,dy=p.y-item.spec.y;return Math.abs(dx*c+dy*s)<item.spec.width/2&&Math.abs(-dx*s+dy*c-.6)<1;});
  return bike.wheels.some(w=>{let hit=false;this.world.contactPair(w.collider(0),item.collider,m=>{if(m.numSolverContacts()>0)hit=true;});return hit;});
 }
 step(bike:Bike){
  for(const item of this.items){
   const {spec,body,collider}=item;item.cooldown=Math.max(0,item.cooldown-DT);
   const hit=!item.broken&&this.touching(item,bike);
   if(hit&&!item.activated&&(spec.kind!=='lift'||Math.abs(bike.frame.translation().x-spec.x)<spec.width/2-2.4)){item.activated=true;item.timer=0;}
   if(item.activated)item.timer+=DT;
   if(spec.kind==='seesaw'||spec.kind==='flex')body.applyTorqueImpulse((-(body.rotation()-(spec.angle??0))*(spec.kind==='seesaw'?6:spec.width<5?75:25)-body.angvel()*3)*DT,true);
   if(spec.kind==='roller')body.setNextKinematicRotation(body.rotation()+(spec.speed??4)*DT);
   if(spec.kind==='lift'&&item.activated){
    const rise=spec.rise??7,speed=spec.speed??3;
    const t=item.timer,up=rise/speed;
    const height=t<up?t*speed:t<up+4?rise:Math.max(0,rise-(t-up-4)*speed);
    body.setNextKinematicTranslation({x:spec.x,y:spec.y+height});
    if(hit&&item.activated&&height<rise-.15){const vx=bike.frame.linvel().x;for(const part of bike.bodies)part.applyImpulse({x:-vx*part.mass()*(1-Math.exp(-DT*30)),y:0},true);}
    if(t>up*2+4){item.activated=false;item.timer=0;}
   }
   if(spec.kind==='collapse'&&item.activated&&!item.broken&&item.timer>=(spec.delay??.4)){
    item.broken=true;this.terrain.delete(collider.handle);body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
    collider.setCollisionGroups(0);body.setLinvel({x:0,y:-1},true);
   }
   if(hit&&(spec.kind==='conveyor'||spec.kind==='boost')){
    const velocity=bike.frame.linvel(),a=spec.angle??0,tx=Math.cos(a),ty=Math.sin(a),target=spec.kind==='boost'?(spec.speed??32):spec.speed??8;
    const change=spec.kind==='boost'?(target-velocity.x*tx-velocity.y*ty)*DT*8:(spec.speed??8)*DT*.9;
    if(spec.kind==='conveyor'||change>0)for(const part of bike.bodies)part.applyImpulse({x:part.mass()*change*tx,y:part.mass()*change*ty},true);
   }
   if(hit&&spec.kind==='spring'&&item.cooldown===0){
    const up=spec.rise??18,vy=bike.frame.linvel().y;
    for(const part of bike.bodies)part.applyImpulse({x:part.mass()*3,y:part.mass()*Math.max(0,up-vy)},true);
    item.cooldown=1;
   }
  }
  this.stepMagnets(bike);
 }
 private stepMagnets(bike:Bike){
  this.magnetic=false;
  (this.level.magneticPaths??[]).forEach((path,index)=>{
   if(this.magnetDone.has(index))return;
   const p=bike.frame.translation(),old=this.magnetProgress[index]??0;
   if(old===0&&Math.hypot(p.x-path[0][0],p.y-path[0][1])>3)return;
   let closest=old,distance=Infinity;
   for(let j=Math.max(0,old-3);j<Math.min(path.length,old+35);j++){
    const d=Math.hypot(p.x-path[j][0],p.y-path[j][1]);if(d<distance){distance=d;closest=j;}
   }
   if(distance>5){if(old>0)this.magnetDone.add(index);return;}
   this.magnetic=true;this.magnetProgress[index]=Math.max(old,closest);
   if(closest>path.length-5){this.magnetDone.add(index);return;}
   const a=path[Math.max(0,closest-1)],b=path[Math.min(path.length-1,closest+1)],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const tx=(b[0]-a[0])/length,ty=(b[1]-a[1])/length,nx=-ty,ny=tx,q=path[closest];
   const error=(p.x-q[0])*nx+(p.y-q[1])*ny-1.12,v=bike.frame.linvel();
   const force=Math.max(-100,Math.min(100,-error*85-(v.x*nx+v.y*ny)*9));
   for(const body of bike.bodies)body.applyImpulse({x:nx*force*body.mass()*DT,y:(ny*force+22)*body.mass()*DT},true);
   const angle=Math.atan2(ty,tx),delta=Math.atan2(Math.sin(angle-bike.frame.rotation()),Math.cos(angle-bike.frame.rotation()));
   const j=Math.min(path.length-2,Math.max(1,closest)),before=path[j-1],after=path[j+1];
   const h1=Math.atan2(path[j][1]-before[1],path[j][0]-before[0]),h2=Math.atan2(after[1]-path[j][1],after[0]-path[j][0]);
   const curvature=Math.atan2(Math.sin(h2-h1),Math.cos(h2-h1))/Math.max(.01,Math.hypot(after[0]-before[0],after[1]-before[1])*.5);
   const along=v.x*tx+v.y*ty,targetSpin=along*curvature;
   bike.frame.applyTorqueImpulse((delta*160+(targetSpin-bike.frame.angvel())*35)*DT,true);
   if(along<14)for(const body of bike.bodies)body.applyImpulse({x:tx*(14-along)*body.mass()*DT*3,y:ty*(14-along)*body.mass()*DT*3},true);
  });
 }
 reset(){
  this.magnetic=false;this.magnetProgress=[];this.magnetDone.clear();
  for(const item of this.items){
   item.timer=0;item.activated=false;item.broken=false;item.cooldown=0;
   const {spec,body,collider}=item;
   body.setBodyType(spec.kind==='seesaw'||spec.kind==='flex'?RAPIER.RigidBodyType.Dynamic:RAPIER.RigidBodyType.KinematicPositionBased,true);
   body.setTranslation({x:spec.x,y:spec.y},true);body.setRotation(spec.angle??0,true);body.setLinvel({x:0,y:0},true);body.setAngvel(0,true);
   collider.setCollisionGroups(GROUP);if(spec.kind!=='boost')this.terrain.add(collider.handle);
  }
 }
 capture():MachinesSnapshot{
  return {items:this.items.map(m=>{const p=m.body.translation(),v=m.body.linvel();return {timer:m.timer,activated:m.activated,broken:m.broken,cooldown:m.cooldown,x:p.x,y:p.y,angle:m.body.rotation(),vx:v.x,vy:v.y,spin:m.body.angvel()};}),magnetProgress:[...this.magnetProgress],magnetDone:[...this.magnetDone]};
 }
 restore(snapshot:MachinesSnapshot){
  this.reset();this.magnetProgress=[...snapshot.magnetProgress];this.magnetDone=new Set(snapshot.magnetDone);
  snapshot.items.forEach((saved,i)=>{const m=this.items[i];if(!m)return;Object.assign(m,{timer:saved.timer,activated:saved.activated,broken:saved.broken,cooldown:saved.cooldown});
   if(saved.broken){m.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);m.collider.setCollisionGroups(0);this.terrain.delete(m.collider.handle);}
   m.body.setTranslation({x:saved.x,y:saved.y},true);m.body.setRotation(saved.angle,true);m.body.setLinvel({x:saved.vx,y:saved.vy},true);m.body.setAngvel(saved.spin,true);
  });
 }
}
