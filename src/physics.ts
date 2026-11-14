import RAPIER from '@dimforge/rapier2d-compat';
import { sampleSegment, loopPoints, type Level, type Point } from './track';

export { RAPIER };
export const STEP = 1/120;
const BIKE = 0x00010002, GROUND = 0x00020001;
export const BIKE_DIMENSIONS = {wheelRadius:0.44, wheelOffsets:[-0.94,0.94] as const,
  suspensionAnchorY:-0.22, fullDroopAxleY:-1.0, fullBumpAxleY:-0.34, freeAxleY:-0.88};
export const TUNING = { gravity:-22, rearTorque:26, leanTorque:42, airLeanTorque:36, airCounterTorque:42, maxWheelSpeed:76,
  springStiffness:210, compressionDamping:28, reboundDamping:18, wheelFriction:1.9,
  groundAngularDamping:1.25, airAngularDamping:0.45, maxAirAngularSpeed:7.5, leanResponseTime:0.075 };
export interface Controls { gas: boolean; brake: boolean; left: boolean; right: boolean }
export interface Bike {
  frame: RAPIER.RigidBody; wheels: RAPIER.RigidBody[]; carriers: RAPIER.RigidBody[];
  head: RAPIER.Collider; joints: RAPIER.ImpulseJoint[]; bodies: RAPIER.RigidBody[];
  suspensionJoints: RAPIER.PrismaticImpulseJoint[];
}
export interface SuspensionTelemetry {
  wheel:'rear'|'front'; axleDrop:number; compression:number; springCompression:number;
  travel:number; compressionRatio:number; compressionVelocity:number; tireClearance:number;
}
export interface BikeSnapshot {
  bodies: { x:number; y:number; angle:number; vx:number; vy:number; spin:number }[];
  loopPhase: Simulation['loopPhase'];
}
export class Simulation {
  world: RAPIER.World;
  events = new RAPIER.EventQueue(true);
  terrain = new Set<number>();
  hazards = new Map<number, number>();
  hazardBodies: RAPIER.RigidBody[] = [];
  exploded = new Set<number>();
  bike!: Bike;
  crashed = false;
  grounded = false;
  private previousGrounded = true;
  private lastAngle = 0;
  airRotation = 0;
  airborneTime = 0;
  flips = 0;
  onCrash?: () => void;
  onFlip?: (count: number, direction:'BACKFLIP'|'FRONTFLIP') => void;
  onExplosion?: (index: number) => void;
  ragdoll: { body: RAPIER.RigidBody; kind: 'head'|'torso'|'limb'; length: number }[] = [];
  loopPhase: 'approach'|'inside'|'complete'='approach';
  private loopColliders: RAPIER.Collider[]=[];
  private pendingFlip?: {count:number;direction:'BACKFLIP'|'FRONTFLIP';age:number};
  private leanInput=0;

  constructor(public level: Level) {
    this.world = new RAPIER.World({x:0,y:TUNING.gravity});
    this.world.timestep = STEP;
    this.world.numSolverIterations = 10;
    for (const segment of level.segments) this.addSurface(sampleSegment(segment));
    if (level.loop) {
      const points=loopPoints(level.loop);
      this.loopColliders=[this.addSurface(points.slice(0,81)),this.addSurface(points.slice(80))];
      this.loopColliders[1].setCollisionGroups(0);
    }
    level.hazards.forEach((hazard,i) => {
      const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(hazard.x,hazard.y));
      this.hazardBodies.push(body);
      let desc: RAPIER.ColliderDesc;
      if (hazard.type === 'spikes') desc=RAPIER.ColliderDesc.cuboid((hazard.width??4)/2,0.45);
      else if (hazard.type === 'saw') desc=RAPIER.ColliderDesc.ball((hazard.radius??1)*0.95);
      else desc=RAPIER.ColliderDesc.cuboid(0.38,0.52);
      const collider=this.world.createCollider(desc.setSensor(true).setCollisionGroups(GROUND).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
      this.hazards.set(collider.handle,i);
    });
    this.spawn(level.spawn);
  }

  private addSurface(points: Point[]) {
    // A single polyline avoids internal seam collisions between adjacent ramp pieces.
    const collider=this.world.createCollider(RAPIER.ColliderDesc.polyline(new Float32Array(points.flat()))
      .setFriction(1.6).setRestitution(0).setCollisionGroups(GROUND).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS));
    this.terrain.add(collider.handle);
    return collider;
  }

  spawn(point: Point) {
    if (this.bike) for (const body of this.bike.bodies) this.world.removeRigidBody(body);
    for (const part of this.ragdoll) this.world.removeRigidBody(part.body);
    this.ragdoll=[];
    const [x,y]=point;
    const frame=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y).setCcdEnabled(true).setAngularDamping(TUNING.groundAngularDamping));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.76,0.17).setMass(3.2).setCollisionGroups(BIKE).setFriction(0.3),frame);
    const head=this.world.createCollider(RAPIER.ColliderDesc.ball(0.27).setTranslation(-0.03,1.26).setSensor(true)
      .setMass(0).setCollisionGroups(BIKE).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),frame);
    // Keep the rider's mass above the frame, giving leaning a natural weight transfer.
    this.world.createCollider(RAPIER.ColliderDesc.ball(0.1).setTranslation(-0.1,0.65).setSensor(true).setMass(0.65).setCollisionGroups(0),frame);
    const wheels: RAPIER.RigidBody[]=[], carriers: RAPIER.RigidBody[]=[], joints: RAPIER.ImpulseJoint[]=[];
    const suspensionJoints:RAPIER.PrismaticImpulseJoint[]=[];
    const dimensions=BIKE_DIMENSIONS;
    for (const offset of dimensions.wheelOffsets) {
      const carrier=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x+offset,y+dimensions.freeAxleY));
      this.world.createCollider(RAPIER.ColliderDesc.ball(0.1).setSensor(true).setMass(0.12).setCollisionGroups(0),carrier);
      const wheel=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x+offset,y+dimensions.freeAxleY).setCcdEnabled(true).setAngularDamping(0.05));
      this.world.createCollider(RAPIER.ColliderDesc.ball(dimensions.wheelRadius).setMass(0.65).setFriction(TUNING.wheelFriction).setRestitution(0).setCollisionGroups(BIKE)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),wheel);
      const suspension=this.world.createImpulseJoint(RAPIER.JointData.prismatic({x:offset,y:dimensions.suspensionAnchorY},{x:0,y:0},{x:0,y:1}),frame,carrier,true) as RAPIER.PrismaticImpulseJoint;
      suspension.setLimits(dimensions.fullDroopAxleY-dimensions.suspensionAnchorY,dimensions.fullBumpAxleY-dimensions.suspensionAnchorY);
      // Lightweight carriers must not scale down the force supporting the rider.
      // Force-based motors give k in force/distance and keep static sag usable.
      suspension.configureMotorModel(RAPIER.MotorModel.ForceBased);
      suspension.configureMotorPosition(dimensions.freeAxleY-dimensions.suspensionAnchorY,TUNING.springStiffness,TUNING.compressionDamping);
      suspension.setContactsEnabled(false);
      const axle=this.world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0},{x:0,y:0}),carrier,wheel,true);
      axle.setContactsEnabled(false);
      joints.push(suspension,axle);suspensionJoints.push(suspension);wheels.push(wheel);carriers.push(carrier);
    }
    this.bike={frame,wheels,carriers,head,joints,suspensionJoints,bodies:[frame,...carriers,...wheels]};
    this.leanInput=0;
    this.crashed=false; this.airRotation=0; this.airborneTime=0; this.lastAngle=0; this.previousGrounded=true;this.pendingFlip=undefined;
    this.loopPhase=this.level.loop && x>this.level.loop.x+this.level.loop.radius?'complete':'approach';
    this.loopColliders.forEach((collider,i)=>collider.setCollisionGroups(this.loopPhase==='complete'||i===1?0:GROUND));
  }

  getSuspensionTelemetry():SuspensionTelemetry[]{
    const {frame,wheels}=this.bike,p=frame.translation(),v=frame.linvel(),omega=frame.angvel(),angle=frame.rotation();
    const c=Math.cos(angle),s=Math.sin(angle),d=BIKE_DIMENSIONS;
    return wheels.map((wheel,i)=>{
      const wp=wheel.translation(),wv=wheel.linvel(),dx=wp.x-p.x,dy=wp.y-p.y;
      const axleY=-s*dx+c*dy;
      // Subtract rigid-frame rotation before measuring suspension velocity.
      const relativeX=wv.x-v.x+omega*dy,relativeY=wv.y-v.y-omega*dx;
      const travel=d.fullBumpAxleY-d.fullDroopAxleY,compression=axleY-d.fullDroopAxleY;
      return {wheel:i===0?'rear':'front',axleDrop:-axleY,compression,springCompression:d.freeAxleY<axleY?axleY-d.freeAxleY:0,
        travel,compressionRatio:Math.max(0,Math.min(1,compression/travel)),compressionVelocity:-s*relativeX+c*relativeY,
        tireClearance:(i===0?0.2725:0.1275)-(axleY+Math.hypot(d.wheelRadius,0.055))};
    });
  }

  captureCheckpoint(): BikeSnapshot {
    return {loopPhase:this.loopPhase,bodies:this.bike.bodies.map(body=>{
      const p=body.translation(),v=body.linvel();
      return {x:p.x,y:p.y,angle:body.rotation(),vx:v.x,vy:v.y,spin:body.angvel()};
    })};
  }

  restoreCheckpoint(snapshot:BikeSnapshot){
    this.spawn([snapshot.bodies[0].x,snapshot.bodies[0].y]);
    snapshot.bodies.forEach((saved,i)=>{
      const body=this.bike.bodies[i];body.setTranslation({x:saved.x,y:saved.y},true);body.setRotation(saved.angle,true);
      body.setLinvel({x:saved.vx,y:saved.vy},true);body.setAngvel(saved.spin,true);
    });
    this.lastAngle=snapshot.bodies[0].angle;this.loopPhase=snapshot.loopPhase;
    this.loopColliders.forEach((collider,i)=>collider.setCollisionGroups(snapshot.loopPhase==='complete'||(i===1 && snapshot.loopPhase==='approach')?0:GROUND));
  }

  step(input: Controls) {
    if(this.level.loop && this.loopPhase!=='complete'){
      const p=this.bike.frame.translation(),loop=this.level.loop;
      // The two track lanes cross at the base. Gate the crossing in 2D so the
      // incoming helmet passes beneath the exit lane instead of hitting it.
      if(this.loopPhase==='approach' && p.y>loop.y && p.x>loop.x-1){
        this.loopPhase='inside';this.loopColliders[1].setCollisionGroups(GROUND);
      }
      if(this.loopPhase==='inside' && p.x>loop.x-1.3 && p.x<loop.x+1 && p.y<1.6 && this.bike.frame.linvel().x>0){
        this.loopPhase='complete';this.loopColliders.forEach(c=>c.setCollisionGroups(0));
      }
    }
    if (!this.crashed) {
      const {frame,wheels}=this.bike;
      const d=BIKE_DIMENSIONS;
      for(const [i,wheel] of this.getSuspensionTelemetry().entries()){
        this.bike.suspensionJoints[i].configureMotorPosition(d.freeAxleY-d.suspensionAnchorY,TUNING.springStiffness,
          wheel.compressionVelocity>0?TUNING.compressionDamping:TUNING.reboundDamping);
      }
      if (input.gas && wheels[0].angvel()>-TUNING.maxWheelSpeed) wheels[0].applyTorqueImpulse(-TUNING.rearTorque*STEP,true);
      if (input.brake) {
        for (const wheel of wheels) {
          const speed=wheel.angvel();
          const torque=speed < -1 ? 28 : speed < 20 ? 6 : 0;
          wheel.applyTorqueImpulse(torque*STEP,true);
        }
      }
      const lean=Number(input.left)-Number(input.right),airborne=!this.grounded&&this.airborneTime>0.04;
      this.leanInput+=(lean-this.leanInput)*(1-Math.exp(-STEP/TUNING.leanResponseTime));
      frame.setAngularDamping(airborne?TUNING.airAngularDamping:TUNING.groundAngularDamping);
      const omega=frame.angvel();
      let torque=this.leanInput*(airborne?(this.leanInput*omega<0?TUNING.airCounterTorque:TUNING.airLeanTorque):TUNING.leanTorque);
      if(airborne&&torque*omega>0)torque*=Math.max(0,Math.min(1,(TUNING.maxAirAngularSpeed-Math.abs(omega))/1.5));
      if(airborne&&Math.abs(omega)>TUNING.maxAirAngularSpeed)torque-=Math.sign(omega)*(Math.abs(omega)-TUNING.maxAirAngularSpeed)*8;
      frame.applyTorqueImpulse(torque*STEP,true);
      const speed=frame.linvel();
      if (Math.abs(speed.x)>29) frame.applyImpulse({x:-Math.sign(speed.x)*(Math.abs(speed.x)-29)*14*STEP,y:0},true);
    }
    this.world.step(this.events);
    let crashRequested=false;
    this.events.drainCollisionEvents((a,b,started) => {
      if (!started || this.crashed) return;
      const head=this.bike.head.handle;
      if ((a===head && this.terrain.has(b)) || (b===head && this.terrain.has(a))) crashRequested=true;
      const hazardIndex=this.hazards.get(a) ?? this.hazards.get(b);
      if (hazardIndex!==undefined && !this.exploded.has(hazardIndex)) {
        if (this.level.hazards[hazardIndex].type==='tnt') {
          this.exploded.add(hazardIndex); this.onExplosion?.(hazardIndex);
        }
        crashRequested=true;
      }
    });
    if (crashRequested) this.crash();
    this.grounded=this.bike.wheels.some(wheel=>{
      let touching=false;
      wheel.collider(0) && this.world.contactPairsWith(wheel.collider(0),(other)=>{
        if(this.terrain.has(other.handle)) this.world.contactPair(wheel.collider(0),other,(manifold)=>{
          if (manifold.numSolverContacts()>0) touching=true;
        });
      });
      return touching;
    });
    const angle=this.bike.frame.rotation();
    const delta=Math.atan2(Math.sin(angle-this.lastAngle),Math.cos(angle-this.lastAngle));
    this.lastAngle=angle;
    if (!this.grounded && !this.crashed) { this.airRotation+=delta; this.airborneTime+=STEP; }
    if (this.grounded && !this.previousGrounded) {
      const count=Math.floor((Math.abs(this.airRotation)+0.001)/(Math.PI*2));
      if (!this.crashed && this.airborneTime>0.2 && count>0)
        this.pendingFlip={count,direction:this.airRotation>0?'BACKFLIP':'FRONTFLIP',age:0};
      this.airRotation=0; this.airborneTime=0;
    }
    if (this.grounded && this.previousGrounded) {this.airRotation=0;this.airborneTime=0;}
    this.previousGrounded=this.grounded;
    if(this.pendingFlip){
      this.pendingFlip.age+=STEP;
      if(this.crashed || this.pendingFlip.age>0.5)this.pendingFlip=undefined;
      else if(this.grounded && this.pendingFlip.age>=0.1){
        const {count,direction}=this.pendingFlip;this.flips+=count;this.onFlip?.(count,direction);this.pendingFlip=undefined;
      }
    }
    if (this.bike.frame.translation().y < -12) this.crash();
  }

  crash() {
    if(this.crashed) return;
    this.crashed=true;
    const {frame,head}=this.bike;
    head.setCollisionGroups(0);
    const p=frame.translation(), angle=frame.rotation(), v=frame.linvel();
    const local=(x:number,y:number)=>({x:p.x+x*Math.cos(angle)-y*Math.sin(angle),y:p.y+x*Math.sin(angle)+y*Math.cos(angle)});
    const parts=[{x:-0.03,y:1.26,length:0.48,kind:'head' as const},{x:-0.12,y:0.77,length:0.65,kind:'torso' as const},
      {x:-0.48,y:0.25,length:0.65,kind:'limb' as const},{x:0.15,y:0.13,length:0.65,kind:'limb' as const},
      {x:0.3,y:0.82,length:0.62,kind:'limb' as const},{x:0.65,y:0.53,length:0.6,kind:'limb' as const}];
    for(const part of parts){
      const pos=local(part.x,part.y);
      const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y).setRotation(angle)
        .setLinvel(v.x+1,v.y+3).setAngvel(3).setCcdEnabled(true));
      this.world.createCollider((part.kind==='head'?RAPIER.ColliderDesc.ball(0.25):RAPIER.ColliderDesc.capsule(part.length/2-0.1,0.1))
        .setMass(0.3).setCollisionGroups(BIKE).setFriction(0.6),body);
      this.ragdoll.push({body,kind:part.kind,length:part.length});
    }
    for(const [a,b,anchor] of [[0,1,[0,-0.22]],[1,2,[-0.18,-0.25]],[2,3,[0,-0.27]],[1,4,[0.15,0.2]],[4,5,[0,-0.25]]] as [number,number,number[]][]){
      this.world.createImpulseJoint(RAPIER.JointData.revolute({x:anchor[0],y:anchor[1]},{x:0,y:0.22}),this.ragdoll[a].body,this.ragdoll[b].body,true).setContactsEnabled(false);
    }
    frame.applyImpulse({x:-1,y:3},true);
    this.onCrash?.();
  }

  resetHazards() {
    this.exploded.clear();
  }
  restartRound() {
    this.flips=0;
    this.resetHazards();
    this.spawn(this.level.spawn);
    this.grounded=false;
  }
  dispose() {this.events.free();this.world.free();}
}
