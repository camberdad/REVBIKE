import RAPIER from '@dimforge/rapier2d-compat';
import { sampleSegment, loopPoints, type Level, type Point } from './track';
import { CourseMachines, type MachinesSnapshot } from './machines';

export { RAPIER };
export const STEP = 1/120;
const BIKE = 0x00010002, GROUND = 0x00020001;
export const BIKE_DIMENSIONS = {wheelRadius:0.44, wheelOffsets:[-0.94,0.94] as const,
  suspensionAnchorY:-0.22, fullDroopAxleY:-1.0, fullBumpAxleY:-0.34, freeAxleY:-0.88};
export const TUNING = { gravity:-22, rearTorque:26, leanTorque:72, wheelieTorque:90, airLeanTorque:48, backwardAirTorque:41, airCounterTorque:56, maxWheelSpeed:76,
  springStiffness:235, compressionDamping:20, reboundDamping:11, wheelFriction:1.9, tireRestitution:0.12,
  groundAngularDamping:1.25, airAngularDamping:0.55, releaseAngularDamping:2.8,
  releasePitchDrag:8, maxAirAngularSpeed:8.5, maxBackwardAngularSpeed:7.2, maxGroundWheelieSpeed:3.5,
  leanResponseTime:0.045, backwardLeanResponseTime:0.06, leanReleaseTime:0.025 };
// Trials uses a larger, longer rig. The archived Stunt setup remains available.
export const TRIALS_DIMENSIONS={wheelRadius:.62,wheelOffsets:[-1.28,1.04] as const,
 suspensionAnchorY:-.05,fullDroopAxleY:-.78,fullBumpAxleY:-.20,freeAxleY:-.56};
export const TRIALS_TUNING={...TUNING,gravity:-18,rearTorque:88,leanTorque:0,wheelieTorque:0,airLeanTorque:50,backwardAirTorque:48,airCounterTorque:70,
 maxWheelSpeed:25,springStiffness:380,compressionDamping:46,reboundDamping:36,wheelFriction:5.2,tireRestitution:.01,
 groundAngularDamping:1.2,airAngularDamping:1.1,releaseAngularDamping:2,releasePitchDrag:8,maxAirAngularSpeed:4.2,maxBackwardAngularSpeed:4.0,
 leanResponseTime:.08,backwardLeanResponseTime:.1,leanReleaseTime:.07};
// Trials drivetrain. Engine and brake torques are internal: whatever twists the
// rear wheel twists the chassis the other way. Full gas therefore lifts the nose
// and can loop the bike out unless the rider moves forward.
export const TRIALS_ENGINE={
 lowEndBoost:1.3,   // torque multiplier at zero wheel speed, tapering to 0 at the ceiling
 throttleResponse:.03,
 reaction:.6,        // share of engine torque reacted into the chassis (rider centred or forward)
 reactionBack:1.05,  // ...with the rider fully back over the rear axle (more anti-squat lift)
 brakeTorque:150, brakeReaction:.55,
 terrainFriction:3.6, obstacleFriction:4,
 popVelocity:5.8,    // A → D weight-snap bunny hop, scaled by preload
 spaceHopVelocity:7.6,
 popWindow:.32, popMinPreload:.08, popFullPreload:.32,
 badLandingSpeed:6.5, badLandingPitch:.5,
};
export interface RenderPose{x:number;y:number;angle:number;}
export interface Controls { gas: boolean; brake: boolean; left: boolean; right: boolean; precision?:boolean;hop?:boolean }
export interface Bike {
  rider?:RAPIER.RigidBody;riderJoint?:RAPIER.PrismaticImpulseJoint;riderVerticalJoint?:RAPIER.PrismaticImpulseJoint;
  frame: RAPIER.RigidBody; wheels: RAPIER.RigidBody[]; carriers: RAPIER.RigidBody[];
  head: RAPIER.Collider; torso: RAPIER.Collider; joints: RAPIER.ImpulseJoint[]; bodies: RAPIER.RigidBody[];
  suspensionJoints: RAPIER.PrismaticImpulseJoint[];
}
export interface SuspensionTelemetry {
  wheel:'rear'|'front'; axleDrop:number; compression:number; springCompression:number;
  travel:number; compressionRatio:number; compressionVelocity:number; tireClearance:number;
}
export interface BikeSnapshot {
  bodies: { x:number; y:number; angle:number; vx:number; vy:number; spin:number }[];
  loopPhase: Simulation['loopPhase'];
  machines?:MachinesSnapshot; clock?:number; loops?:('approach'|'inside'|'complete')[];
  hazards?:{x:number;y:number;vx:number;vy:number;angle:number;spin:number;dynamic:boolean}[];
  activated?:number[];exploded?:number[];fuses?:[number,number][];
  riderTargets?:{x:number;y:number};
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
  private takeoffPitch=0;
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
  machines:CourseMachines;
  clock=0;
  private magneticRails:{colliders:RAPIER.Collider[];index:number}[]=[];
  private hazardActivated=new Set<number>();
  private fuses=new Map<number,number>();
  campaignLoops:{definition:NonNullable<Level['loop']>;colliders:RAPIER.Collider[];phase:'approach'|'inside'|'complete'}[]=[];

  readonly isTrials:boolean;
  readonly dimensions:typeof BIKE_DIMENSIONS|typeof TRIALS_DIMENSIONS;
  tuning:typeof TUNING;
  throttle=0;
  riderShift=0;
  riderCrouch=0;
  private riderTargetX=-.1;private riderTargetY=-.1;
  private hopWasDown=false;
  private hopCooldown=0;
  hopCount=0;
  /** Why the most recent crash happened, for the HUD. */
  crashReason='';
  /** Engine torque currently reaching the rear wheel, 0–1 of peak. */
  drive=0;
  private backPreload=0;private lastBackTime=-1;private rightWasDown=false;
  private previousPoses:RenderPose[]=[];
  constructor(public level: Level) {
    this.isTrials=level.mode==='trials';this.dimensions=this.isTrials?TRIALS_DIMENSIONS:BIKE_DIMENSIONS;
    this.tuning={...(this.isTrials?TRIALS_TUNING:TUNING)};
    this.world = new RAPIER.World({x:0,y:this.tuning.gravity});
    this.world.timestep = STEP;
    this.world.numSolverIterations = 10;
    for (const segment of level.segments) this.addSurface(sampleSegment(segment));
    for(const points of level.paths??[]){
      const index=level.magneticPaths?.indexOf(points)??-1;
      if(index>=0){const colliders=[this.addSurface(points.slice(0,101)),this.addSurface(points.slice(100))];colliders[1].setCollisionGroups(0);this.magneticRails.push({colliders,index});}
      else this.addSurface(points);
    }
    for(const definition of level.loops??[]){
      const points=loopPoints(definition),half=(points.length-1)/2;
      const colliders=[this.addSurface(points.slice(0,half+1)),this.addSurface(points.slice(half))];
      colliders[1].setCollisionGroups(0);this.campaignLoops.push({definition,colliders,phase:'approach'});
    }
    if (level.loop) {
      const points=loopPoints(level.loop),half=(points.length-1)/2;
      this.loopColliders=[this.addSurface(points.slice(0,half+1)),this.addSurface(points.slice(half))];
      this.loopColliders[1].setCollisionGroups(0);
    }
    level.hazards.forEach((hazard,i) => {
      const moving=['wrecking','axe','crusher','boulder'].includes(hazard.type);
      const body=this.world.createRigidBody((moving?RAPIER.RigidBodyDesc.kinematicPositionBased():RAPIER.RigidBodyDesc.fixed()).setTranslation(hazard.x,hazard.y).setCcdEnabled(true));
      this.hazardBodies.push(body);
      let desc: RAPIER.ColliderDesc;
      if (['spikes','mud','lava','laser'].includes(hazard.type)) desc=RAPIER.ColliderDesc.cuboid((hazard.width??4)/2,hazard.type==='spikes'?.45:.25);
      else if (['saw','wrecking','axe','boulder'].includes(hazard.type)) desc=RAPIER.ColliderDesc.ball((hazard.radius??1)*0.95);
      else if(hazard.type==='crusher')desc=RAPIER.ColliderDesc.cuboid((hazard.width??3)/2,1.2);
      else desc=RAPIER.ColliderDesc.cuboid(0.38,0.52);
      const collider=this.world.createCollider(desc.setSensor(hazard.type!=='boulder').setFriction(1.2).setMass(12).setCollisionGroups(hazard.type==='boulder'?0x00030003:GROUND).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
      this.hazards.set(collider.handle,i);
    });
    this.machines=new CourseMachines(this.world,level,this.terrain);
    for(const obstacle of level.obstacles??[]){
      const r=obstacle.radius??.09;
      const round=obstacle.kind==='log'||obstacle.kind==='stone';
      const collider=this.world.createCollider((round?RAPIER.ColliderDesc.ball(obstacle.height/2):RAPIER.ColliderDesc.roundCuboid(obstacle.width/2-r,obstacle.height/2-r,r))
       .setTranslation(obstacle.x,obstacle.y).setFriction(this.isTrials?TRIALS_ENGINE.obstacleFriction:3.5).setRestitution(0).setCollisionGroups(GROUND).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS));
      this.terrain.add(collider.handle);
    }
    this.spawn(level.spawn);
  }

  private addSurface(points: Point[]) {
    // A single polyline avoids internal seam collisions between adjacent ramp pieces.
    const collider=this.world.createCollider(RAPIER.ColliderDesc.polyline(new Float32Array(points.flat()))
      .setFriction(this.isTrials?TRIALS_ENGINE.terrainFriction:1.6).setContactSkin(this.isTrials?.004:0).setRestitution(0).setCollisionGroups(GROUND).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS));
    this.terrain.add(collider.handle);
    return collider;
  }

  spawn(point: Point) {
    if (this.bike) for (const body of this.bike.bodies) this.world.removeRigidBody(body);
    for (const part of this.ragdoll) this.world.removeRigidBody(part.body);
    this.ragdoll=[];
    const [x,y]=point;
    const frame=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y).setCcdEnabled(true).setAngularDamping(this.tuning.groundAngularDamping));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.76,0.17).setMass(this.isTrials?2:3.2).setCollisionGroups(BIKE).setFriction(0.3),frame);
    const head=this.world.createCollider(RAPIER.ColliderDesc.ball(0.23).setTranslation(-0.03,1.26).setSensor(true)
      .setMass(0).setCollisionGroups(BIKE).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),frame);
    // Inset rider sensors allow a tire-first landing at any impact speed or angle.
    // Only actual head/torso contact with terrain detaches the rider.
    const torso=this.world.createCollider(RAPIER.ColliderDesc.capsule(0.15,0.14).setTranslation(-0.12,0.77).setSensor(true)
      .setMass(0).setCollisionGroups(BIKE).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),frame);
    // Keep the rider's mass above the frame, giving leaning a natural weight transfer.
    if(!this.isTrials)this.world.createCollider(RAPIER.ColliderDesc.ball(0.1).setTranslation(-0.1,0.65).setSensor(true).setMass(0.65).setCollisionGroups(0),frame);
    const wheels: RAPIER.RigidBody[]=[], carriers: RAPIER.RigidBody[]=[], joints: RAPIER.ImpulseJoint[]=[];
    const suspensionJoints:RAPIER.PrismaticImpulseJoint[]=[];
    const dimensions=this.dimensions;
    for (const offset of dimensions.wheelOffsets) {
      const carrier=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x+offset,y+dimensions.freeAxleY));
      this.world.createCollider(RAPIER.ColliderDesc.ball(0.1).setSensor(true).setMass(0.12).setCollisionGroups(0),carrier);
      const wheel=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x+offset,y+dimensions.freeAxleY).setCcdEnabled(true).setAngularDamping(0.05));
      this.world.createCollider(RAPIER.ColliderDesc.ball(dimensions.wheelRadius).setMass(this.isTrials?.7:.65).setFriction(this.tuning.wheelFriction).setRestitution(this.tuning.tireRestitution).setContactSkin(this.isTrials?.006:0).setCollisionGroups(BIKE)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),wheel);
      const suspension=this.world.createImpulseJoint(RAPIER.JointData.prismatic({x:offset,y:dimensions.suspensionAnchorY},{x:0,y:0},{x:0,y:1}),frame,carrier,true) as RAPIER.PrismaticImpulseJoint;
      suspension.setLimits(dimensions.fullDroopAxleY-dimensions.suspensionAnchorY,dimensions.fullBumpAxleY-dimensions.suspensionAnchorY);
      // Lightweight carriers must not scale down the force supporting the rider.
      // Force-based motors give k in force/distance and keep static sag usable.
      suspension.configureMotorModel(RAPIER.MotorModel.ForceBased);
      suspension.configureMotorPosition(dimensions.freeAxleY-dimensions.suspensionAnchorY,this.tuning.springStiffness,this.tuning.compressionDamping);
      suspension.setContactsEnabled(false);
      const axle=this.world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0},{x:0,y:0}),carrier,wheel,true);
      axle.setContactsEnabled(false);
      joints.push(suspension,axle);suspensionJoints.push(suspension);wheels.push(wheel);carriers.push(carrier);
    }
    this.bike={frame,wheels,carriers,head,torso,joints,suspensionJoints,bodies:[frame,...carriers,...wheels]};
    if(this.isTrials){
      const carrier=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x-.1,y+.65));
      this.world.createCollider(RAPIER.ColliderDesc.ball(.1).setMass(.05).setSensor(true).setCollisionGroups(0),carrier);
      const rider=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x-.1,y+.55).setCcdEnabled(true));
      this.world.createCollider(RAPIER.ColliderDesc.ball(.18).setMass(3).setSensor(true).setCollisionGroups(0),rider);
      const joint=this.world.createImpulseJoint(RAPIER.JointData.prismatic({x:0,y:.65},{x:0,y:0},{x:1,y:0}),frame,carrier,true) as RAPIER.PrismaticImpulseJoint;
      joint.setLimits(-.95,1.6);joint.configureMotorModel(RAPIER.MotorModel.ForceBased);joint.configureMotorPosition(-.1,900,75);joint.setContactsEnabled(false);
      const vertical=this.world.createImpulseJoint(RAPIER.JointData.prismatic({x:0,y:0},{x:0,y:0},{x:0,y:1}),carrier,rider,true) as RAPIER.PrismaticImpulseJoint;
      vertical.setLimits(-.42,.12);vertical.configureMotorModel(RAPIER.MotorModel.ForceBased);vertical.configureMotorPosition(-.1,1200,85);vertical.setContactsEnabled(false);
      this.bike.rider=rider;this.bike.riderJoint=joint;this.bike.riderVerticalJoint=vertical;this.bike.bodies.push(carrier,rider);
    }
    this.previousPoses=this.currentPoses();this.throttle=0;this.riderShift=0;this.riderCrouch=0;this.grounded=false;this.hopWasDown=false;this.hopCooldown=0;this.riderTargetX=-.1;this.riderTargetY=-.1;
    this.leanInput=0;this.backPreload=0;this.lastBackTime=-1;this.rightWasDown=false;this.crashReason='';this.drive=0;
    this.crashed=false; this.airRotation=0; this.airborneTime=0; this.lastAngle=0; this.previousGrounded=true;this.pendingFlip=undefined;
    this.loopPhase=this.level.loop && x>this.level.loop.x+this.level.loop.radius?'complete':'approach';
    this.loopColliders.forEach((collider,i)=>collider.setCollisionGroups(this.loopPhase==='complete'||i===1?0:GROUND));
  }

  private currentPoses():RenderPose[]{return [this.bike.frame,...this.bike.wheels].map(b=>{const p=b.translation();return {x:p.x,y:p.y,angle:b.rotation()};});}
  getRenderPoses(alpha=1):RenderPose[]{
    const t=Math.max(0,Math.min(1,alpha));return this.currentPoses().map((p,i)=>{const old=this.previousPoses[i]??p;const delta=Math.atan2(Math.sin(p.angle-old.angle),Math.cos(p.angle-old.angle));return {x:old.x+(p.x-old.x)*t,y:old.y+(p.y-old.y)*t,angle:old.angle+delta*t};});
  }
  getSuspensionTelemetry():SuspensionTelemetry[]{
    const {frame,wheels}=this.bike,p=frame.translation(),v=frame.linvel(),omega=frame.angvel(),angle=frame.rotation();
    const c=Math.cos(angle),s=Math.sin(angle),d=this.dimensions;
    return wheels.map((wheel,i)=>{
      const wp=wheel.translation(),wv=wheel.linvel(),dx=wp.x-p.x,dy=wp.y-p.y;
      const axleY=-s*dx+c*dy;
      // Subtract rigid-frame rotation before measuring suspension velocity.
      const relativeX=wv.x-v.x+omega*dy,relativeY=wv.y-v.y-omega*dx;
      const travel=d.fullBumpAxleY-d.fullDroopAxleY,compression=axleY-d.fullDroopAxleY;
      return {wheel:i===0?'rear':'front',axleDrop:-axleY,compression,springCompression:d.freeAxleY<axleY?axleY-d.freeAxleY:0,
        travel,compressionRatio:Math.max(0,Math.min(1,compression/travel)),compressionVelocity:-s*relativeX+c*relativeY,
        tireClearance:(this.isTrials?(i===0?.72:.68):(i===0?.2725:.1275))-(axleY+Math.hypot(d.wheelRadius,0.055))};
    });
  }

  captureCheckpoint(): BikeSnapshot {
    return {riderTargets:this.isTrials?{x:this.riderTargetX,y:this.riderTargetY}:undefined,loopPhase:this.loopPhase,machines:this.machines.capture(),clock:this.clock,loops:this.campaignLoops.map(l=>l.phase),
      hazards:this.hazardBodies.map(b=>{const p=b.translation(),v=b.linvel();return {x:p.x,y:p.y,vx:v.x,vy:v.y,angle:b.rotation(),spin:b.angvel(),dynamic:b.isDynamic()};}),activated:[...this.hazardActivated],exploded:[...this.exploded],fuses:[...this.fuses],bodies:this.bike.bodies.map(body=>{
      const p=body.translation(),v=body.linvel();
      return {x:p.x,y:p.y,angle:body.rotation(),vx:v.x,vy:v.y,spin:body.angvel()};
    })};
  }

  restoreCheckpoint(snapshot:BikeSnapshot){
    this.spawn([snapshot.bodies[0].x,snapshot.bodies[0].y]);
    if(snapshot.machines)this.machines.restore(snapshot.machines);
    this.clock=snapshot.clock??this.clock;this.hazardActivated=new Set(snapshot.activated);this.exploded=new Set(snapshot.exploded);this.fuses=new Map(snapshot.fuses);
    snapshot.loops?.forEach((phase,i)=>{const loop=this.campaignLoops[i];loop.phase=phase;loop.colliders.forEach((c,j)=>c.setCollisionGroups(phase==='complete'||(j===1&&phase==='approach')?0:GROUND));});
    snapshot.hazards?.forEach((s,i)=>{const b=this.hazardBodies[i];b.setBodyType(s.dynamic?RAPIER.RigidBodyType.Dynamic:['wrecking','axe','crusher','boulder'].includes(this.level.hazards[i].type)?RAPIER.RigidBodyType.KinematicPositionBased:RAPIER.RigidBodyType.Fixed,true);b.setTranslation({x:s.x,y:s.y},true);b.setRotation(s.angle,true);b.setLinvel({x:s.vx,y:s.vy},true);b.setAngvel(s.spin,true);b.collider(0).setCollisionGroups(this.exploded.has(i)?0:this.level.hazards[i].type==='boulder'?0x00030003:GROUND);});
    snapshot.bodies.forEach((saved,i)=>{
      const body=this.bike.bodies[i];body.setTranslation({x:saved.x,y:saved.y},true);body.setRotation(saved.angle,true);
      body.setLinvel({x:saved.vx,y:saved.vy},true);body.setAngvel(saved.spin,true);
    });
    if(this.isTrials&&snapshot.riderTargets){
      this.riderTargetX=snapshot.riderTargets.x;this.riderTargetY=snapshot.riderTargets.y;
      this.bike.riderJoint!.configureMotorPosition(this.riderTargetX,900,75);
      this.bike.riderVerticalJoint!.configureMotorPosition(this.riderTargetY,1200,85);
    }
    this.previousPoses=this.currentPoses();
    this.lastAngle=snapshot.bodies[0].angle;this.loopPhase=snapshot.loopPhase;
    this.loopColliders.forEach((collider,i)=>collider.setCollisionGroups(snapshot.loopPhase==='complete'||(i===1 && snapshot.loopPhase==='approach')?0:GROUND));
  }

  step(input: Controls) {
    this.previousPoses=this.currentPoses();
    this.clock+=STEP;
    this.updateHazards();
    for(const loop of this.campaignLoops){
      const p=this.bike.frame.translation(),d=loop.definition;
      if(loop.phase==='approach'&&p.y>d.y&&p.x>d.x-1){loop.phase='inside';loop.colliders[1].setCollisionGroups(GROUND);}
      if(loop.phase==='inside'&&p.x>d.x-1.3&&p.x<d.x+1&&p.y<d.y-d.radius+1.8&&this.bike.frame.linvel().x>0){loop.phase='complete';loop.colliders.forEach(c=>c.setCollisionGroups(0));}
    }
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
      this.hopCooldown=Math.max(0,this.hopCooldown-STEP);
      if(input.hop&&!this.hopWasDown&&this.grounded&&this.hopCooldown===0)this.bunnyHop(TRIALS_ENGINE.spaceHopVelocity,input.gas?1.6:0,false);
      this.hopWasDown=!!input.hop;
      if(this.isTrials){
        // Weight-snap bunny hop: load the rear with A, then snap forward with D
        // while the engine is pulling. The rear end kicks up more than the front.
        const right=!!input.right,E=TRIALS_ENGINE;
        if(this.grounded&&input.left&&!right){this.backPreload=Math.min(E.popFullPreload,this.backPreload+STEP);this.lastBackTime=this.clock;}
        else if(this.clock-this.lastBackTime>E.popWindow)this.backPreload=0;
        if(right&&!this.rightWasDown&&this.grounded&&this.hopCooldown===0&&this.backPreload>=E.popMinPreload&&(input.gas||this.throttle>.3)){
          const load=Math.min(1,this.backPreload/E.popFullPreload);
          this.bunnyHop(E.popVelocity*(.7+.3*load),1.1,true);this.backPreload=0;
        }
        this.rightWasDown=right;
      }
      this.machines.step(this.bike);
      for(const rail of this.magneticRails){const done=this.machines.magnetDone.has(rail.index),progress=this.machines.magnetProgress[rail.index]??0;rail.colliders[0].setCollisionGroups(done?0:GROUND);rail.colliders[1].setCollisionGroups(!done&&progress>75?GROUND:0);}
      const d=this.dimensions;
      for(const [i,wheel] of this.getSuspensionTelemetry().entries()){
        this.bike.suspensionJoints[i].configureMotorPosition(d.freeAxleY-d.suspensionAnchorY,this.tuning.springStiffness,
          wheel.compressionVelocity>0?this.tuning.compressionDamping:this.tuning.reboundDamping);
      }
      if(this.isTrials){
        const E=TRIALS_ENGINE,rear=wheels[0];
        const demand=input.gas?(input.precision?.38:1):0;
        this.throttle+=(demand-this.throttle)*(1-Math.exp(-STEP/E.throttleResponse));
        // Instant low-end torque that fades out toward the wheel-speed ceiling.
        const ceiling=this.tuning.maxWheelSpeed*(input.precision?.4:1),f=Math.max(0,-rear.angvel()/ceiling);
        const curve=f>=1?0:E.lowEndBoost*(1-f*f);
        this.drive=this.throttle*curve/E.lowEndBoost;
        const torque=this.tuning.rearTorque*this.throttle*curve;
        // The internal reaction pitches the chassis nose-up: wheelies, loop-outs.
        const back=Math.max(0,Math.min(1,-(this.riderTargetX+.1)/.8)),reaction=E.reaction+(E.reactionBack-E.reaction)*back;
        if(torque>0){rear.applyTorqueImpulse(-torque*STEP,true);frame.applyTorqueImpulse(torque*reaction*STEP,true);}
        if(!input.gas){const engineBrake=-rear.angvel()*.6*STEP;rear.applyTorqueImpulse(engineBrake,true);frame.applyTorqueImpulse(-engineBrake*E.reaction,true);}
        // Snappy brakes lock the wheels; the caliper reaction dives the chassis.
        if(input.brake)for(const wheel of wheels){
          const w=wheel.angvel(),impulse=Math.max(-E.brakeTorque*STEP,Math.min(E.brakeTorque*STEP,-w*.17));
          wheel.applyTorqueImpulse(impulse,true);frame.applyTorqueImpulse(-impulse*E.brakeReaction,true);
        }
        const shift=Number(input.right)-Number(input.left),incline=Math.max(0,Math.min(1,(frame.rotation()-.15)/.55));
        // Forward snaps are quicker than settling back, so D can catch a wheelie.
        const xResponse=shift>0?.09:shift<0?.11:.16;
        this.riderTargetX+=((this.grounded?(shift>0?.45+incline*1.05:shift<0?-.9:-.1):this.riderTargetX)-this.riderTargetX)*(1-Math.exp(-STEP/xResponse));
        this.riderTargetY+=((this.grounded?(shift>0?-.2-incline*.2:shift<0?.1:-.1):this.riderTargetY)-this.riderTargetY)*(1-Math.exp(-STEP/.18));
        this.bike.riderJoint!.configureMotorPosition(this.riderTargetX,900,75);
        this.bike.riderVerticalJoint!.configureMotorPosition(this.riderTargetY,1200,85);
        const rp=this.bike.rider!.translation(),fp=frame.translation(),angle=frame.rotation();
        this.riderCrouch=-Math.sin(angle)*(rp.x-fp.x)+Math.cos(angle)*(rp.y-fp.y)-.65;
        this.riderShift=Math.cos(angle)*(rp.x-fp.x)+Math.sin(angle)*(rp.y-fp.y)+.1;
        this.bike.head.setTranslationWrtParent({x:-.03+this.riderShift*.85,y:1.26+this.riderCrouch*.9});
        this.bike.torso.setTranslationWrtParent({x:-.12+this.riderShift*.65,y:.77+this.riderCrouch*.6});
      }else{
      if (input.gas && wheels[0].angvel()>-this.tuning.maxWheelSpeed) wheels[0].applyTorqueImpulse(-this.tuning.rearTorque*STEP,true);
      if (input.brake) {
        for (const wheel of wheels) {
          const speed=wheel.angvel();
          const torque=speed < -1 ? 28 : speed < 20 ? 6 : 0;
          wheel.applyTorqueImpulse(torque*STEP,true);
        }
      }
      }
      const lean=Number(input.left)-Number(input.right),airborne=!this.grounded&&this.airborneTime>0.04;
      this.leanInput+=(lean-this.leanInput)*(1-Math.exp(-STEP/(lean>0?this.tuning.backwardLeanResponseTime:lean<0?this.tuning.leanResponseTime:this.tuning.leanReleaseTime)));
      frame.setAngularDamping(lean?(airborne?this.tuning.airAngularDamping:this.tuning.groundAngularDamping):this.tuning.releaseAngularDamping);
      const omega=frame.angvel();
      let torque=this.leanInput*(airborne?(this.leanInput*omega<0?this.tuning.airCounterTorque:this.leanInput>0?this.tuning.backwardAirTorque:this.tuning.airLeanTorque):this.leanInput>0?this.tuning.wheelieTorque:this.tuning.leanTorque);
      // Frame damping alone cannot stop the angular momentum of the whole rig.
      // A light chassis brake also slows the orbiting axles, never wheel spin.
      if(!lean&&!this.machines.magnetic)torque-=omega*this.tuning.releasePitchDrag;
      if(this.machines.magnetic)torque=0;
      const limit=omega>0?(airborne?this.tuning.maxBackwardAngularSpeed:this.tuning.maxGroundWheelieSpeed):this.tuning.maxAirAngularSpeed;
      if((airborne||lean>0)&&torque*omega>0)torque*=Math.max(0,Math.min(1,(limit-Math.abs(omega))/1.5));
      if(airborne&&Math.abs(omega)>limit)torque-=Math.sign(omega)*(Math.abs(omega)-limit)*8;
      if(!this.isTrials||airborne)frame.applyTorqueImpulse(torque*STEP,true);
      const speed=frame.linvel();
      const speedLimit=this.isTrials?15.5:29;
      if(Math.abs(speed.x)>speedLimit)frame.applyImpulse({x:-Math.sign(speed.x)*(Math.abs(speed.x)-speedLimit)*14*STEP,y:0},true);
    }
    this.world.step(this.events);
    let crashRequested=false;
    this.events.drainCollisionEvents((a,b,started) => {
      if (!started || this.crashed) return;
      const rider=[this.bike.head.handle,this.bike.torso.handle];
      if (!this.machines.magnetic&&((rider.includes(a) && this.terrain.has(b)) || (rider.includes(b) && this.terrain.has(a)))){crashRequested=true;this.crashReason||='RIDER HIT THE GROUND';}
      const hazardIndex=this.hazards.get(a) ?? this.hazards.get(b);
      if (hazardIndex!==undefined && !this.exploded.has(hazardIndex)) {
        const other=this.hazards.has(a)?b:a,parent=this.world.getCollider(other)?.parent();
        if(!parent||!this.bike.bodies.some(body=>body.handle===parent.handle))return;
        const h=this.level.hazards[hazardIndex];
        if(h.type==='tnt'&&h.delay){if(!this.fuses.has(hazardIndex))this.fuses.set(hazardIndex,h.delay);return;}
        this.crashReason||=h.type==='lava'?'INTO THE LAVA':h.type==='mud'?'INTO THE PIT':h.type==='laser'?'LASER':'HAZARD';
        if (this.level.hazards[hazardIndex].type==='tnt') {
          this.exploded.add(hazardIndex); this.onExplosion?.(hazardIndex);
        }
        crashRequested=true;
      }
    });
    if (crashRequested) this.crash();
    const normals:({x:number;y:number}|null)[]=this.bike.wheels.map(wheel=>{
      let normal:{x:number;y:number}|null=null;
      wheel.collider(0) && this.world.contactPairsWith(wheel.collider(0),(other)=>{
        if(this.terrain.has(other.handle)) this.world.contactPair(wheel.collider(0),other,(manifold)=>{
          if (manifold.numSolverContacts()>0){const n=manifold.normal();normal=n.y<0?{x:-n.x,y:-n.y}:{x:n.x,y:n.y};}
        });
      });
      return normal;
    });
    this.grounded=normals.some(Boolean);
    // Trials landings: a hard, nose-first touchdown on the front wheel is a fault.
    // Rear-first (or matched-to-slope) landings are absorbed by the suspension.
    if(this.isTrials&&!this.crashed&&!this.previousGrounded&&this.airborneTime>.2&&normals[1]&&!normals[0]){
      const n=normals[1],a=this.bike.frame.rotation(),ux=-Math.sin(a),uy=Math.cos(a),v=this.bike.frame.linvel();
      const pitch=Math.atan2(n.x*uy-n.y*ux,n.x*ux+n.y*uy),impact=-(v.x*n.x+v.y*n.y);
      if(pitch<-TRIALS_ENGINE.badLandingPitch&&impact>TRIALS_ENGINE.badLandingSpeed){this.crashReason='NOSE-FIRST LANDING';this.crash();}
    }
    const angle=this.bike.frame.rotation();
    const delta=Math.atan2(Math.sin(angle-this.lastAngle),Math.cos(angle-this.lastAngle));
    this.lastAngle=angle;
    if (!this.grounded && !this.crashed) {
      if(this.previousGrounded)this.takeoffPitch=Math.atan2(Math.sin(angle),Math.cos(angle));
      this.airRotation+=delta; this.airborneTime+=STEP;
    }
    if (this.grounded && !this.previousGrounded) {
      // Account for a steep takeoff and sloped landing when counting completed
      // upright revolutions. An inverted ceiling departure receives no correction.
      const landingPitch=Math.atan2(Math.sin(angle),Math.cos(angle));
      const rotation=this.airRotation+(Math.abs(this.takeoffPitch)<2.2?this.takeoffPitch-landingPitch:0);
      const count=Math.floor((Math.abs(rotation)+0.05)/(Math.PI*2));
      if (!this.crashed && this.airborneTime>0.2 && count>0)
        this.pendingFlip={count,direction:this.airRotation>0?'BACKFLIP':'FRONTFLIP',age:0};
      this.airRotation=0; this.airborneTime=0;
    }
    if (this.grounded && this.previousGrounded) {this.airRotation=0;this.airborneTime=0;}
    this.previousGrounded=this.grounded;
    if(this.pendingFlip){
      this.pendingFlip.age+=STEP;
      if(this.crashed || this.pendingFlip.age>0.5)this.pendingFlip=undefined;
      // A clean tire contact starts the grace window. Suspension rebound may
      // lift both tires again; it must not discard a safely landed stunt.
      else if(this.pendingFlip.age>=0.18){
        const {count,direction}=this.pendingFlip;this.flips+=count;this.onFlip?.(count,direction);this.pendingFlip=undefined;
      }
    }
    if (this.bike.frame.translation().y < -12) this.crash();
  }

  /** Grounded hop. A weight-snap pop lifts the rear more than the front. */
  private bunnyHop(up:number,forward:number,rearBias:boolean){
    const {wheels,carriers}=this.bike,rear=new Set([wheels[0].handle,carriers[0].handle]),front=new Set([wheels[1].handle,carriers[1].handle]);
    for(const body of this.bike.bodies){
      const k=!rearBias?1:rear.has(body.handle)?1.45:front.has(body.handle)?.75:1;
      body.applyImpulse({x:body.mass()*forward,y:body.mass()*up*k},true);
    }
    this.hopCooldown=.55;this.hopCount++;
  }

  crash() {
    if(this.crashed) return;
    this.crashed=true;
    if(!this.crashReason)this.crashReason=this.bike.frame.translation().y<-12?'FELL OFF THE COURSE':'RIDER DOWN';
    const {frame,head}=this.bike;
    head.setCollisionGroups(0);
    this.bike.torso.setCollisionGroups(0);
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

  private updateHazards(){
    const p=this.bike.frame.translation();
    this.level.hazards.forEach((h,i)=>{
      const body=this.hazardBodies[i],phase=this.clock/(h.period??4)*Math.PI*2+(h.phase??0);
      if(h.type==='wrecking'||h.type==='axe'){
        const anchor=h.anchorY??h.y+6,length=anchor-h.y,angle=Math.sin(phase)*.95;
        body.setNextKinematicTranslation({x:h.x+Math.sin(angle)*(h.amplitude??length),y:anchor-Math.cos(angle)*length});body.setNextKinematicRotation(-angle);
      }
      if(h.type==='crusher')body.setNextKinematicTranslation({x:h.x,y:h.y+(h.amplitude??3)*Math.cos(phase)});
      if(h.type==='boulder'&&!this.hazardActivated.has(i)&&p.x>=(h.triggerX??h.x+10)){
        this.hazardActivated.add(i);body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);body.setLinvel({x:14,y:-3},true);body.setAngvel(-7,true);
      }
    });
    for(const [i,left]of this.fuses){
      if(left>STEP){this.fuses.set(i,left-STEP);continue;}
      this.fuses.delete(i);this.exploded.add(i);this.hazardBodies[i].collider(0).setCollisionGroups(0);this.onExplosion?.(i);
      const h=this.level.hazards[i];if(Math.hypot(p.x-h.x,p.y-h.y)<3.4)this.crash();
    }
  }

  resetHazards() {
    this.exploded.clear();
    this.fuses.clear();this.hazardActivated.clear();this.clock=0;
    this.level.hazards.forEach((h,i)=>{const body=this.hazardBodies[i];body.setBodyType(['wrecking','axe','crusher','boulder'].includes(h.type)?RAPIER.RigidBodyType.KinematicPositionBased:RAPIER.RigidBodyType.Fixed,true);body.setTranslation({x:h.x,y:h.y},true);body.setLinvel({x:0,y:0},true);body.setAngvel(0,true);body.collider(0).setCollisionGroups(h.type==='boulder'?0x00030003:GROUND);});
    this.machines.reset();for(const rail of this.magneticRails)rail.colliders.forEach((c,i)=>c.setCollisionGroups(i?0:GROUND));
    for(const loop of this.campaignLoops){loop.phase='approach';loop.colliders.forEach((c,i)=>c.setCollisionGroups(i?0:GROUND));}
  }
  restartRound() {
    this.flips=0;
    this.hopCount=0;
    this.resetHazards();
    this.spawn(this.level.spawn);
    this.grounded=false;
  }
  dispose() {this.events.free();this.world.free();}
}

