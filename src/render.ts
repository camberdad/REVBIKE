import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BIKE_DIMENSIONS,TRIALS_DIMENSIONS, type Simulation } from './physics';
import { sampleSegment, loopPoints, type Level, type Point } from './track';
import { DEFAULT_SETTINGS, bloodParticleCount, type GameSettings } from './settings';
import {themeFor} from './campaign';
import {DEFAULT_APPEARANCE,type Appearance} from './garage';
import {buildCampaignScenery} from './scenery';

const colors={ink:0x28342f, road:0x485047, dirt:0xa78b78, edge:0xdfd0ad, lime:0xd8ef68, orange:0xfa693e, metal:0x9ba8a1};
const material=(color:number,roughness=0.8)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0.05});
const mats={ink:material(colors.ink),road:material(colors.road),dirt:material(colors.dirt),edge:material(colors.edge),
  lime:material(colors.lime),orange:material(colors.orange),metal:material(colors.metal,0.35),white:material(0xf3f1dd),
  tire:material(0x222b28),rider:material(0x304d4e),saw:material(0x8c9c9b,0.3)};

function mesh(geometry:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0) {
  const obj=new THREE.Mesh(geometry,mat);obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;
}
function box(parent:THREE.Object3D,w:number,h:number,d:number,mat:THREE.Material,x=0,y=0,z=0) {
  return mesh(new THREE.BoxGeometry(w,h,d),mat,parent,x,y,z);
}
function ball(parent:THREE.Object3D,r:number,mat:THREE.Material,x=0,y=0,z=0) {
  return mesh(new THREE.SphereGeometry(r,14,10),mat,parent,x,y,z);
}
function rod(parent:THREE.Object3D,a:number[],b:number[],r:number,mat:THREE.Material) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
  const obj=mesh(new THREE.CylinderGeometry(r,r,direction.length(),8),mat,parent);
  obj.position.copy(start.add(end).multiplyScalar(0.5));obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return obj;
}
function label(text:string,bg:string,fg:string,width=512,height=128) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);ctx.fillStyle=fg;
  ctx.font=`900 ${height*0.53}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,height*0.54);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
}

export class GameRenderer {
  scene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-16,16,9,-9,0.1,180);
  renderer:THREE.WebGLRenderer;
  bike=new THREE.Group();
  rider=new THREE.Group();
  wheels=[new THREE.Group(),new THREE.Group()];
  suspension:THREE.Mesh[]=[];
  private rearSwingarms:THREE.Mesh[]=[];
  private rearSpring!:THREE.Mesh;
  private forkSleeves:THREE.Mesh[]=[];
  hazardMeshes:THREE.Group[]=[];
  machineMeshes:THREE.Group[]=[];
  private hazardCables=new Map<number,THREE.Mesh>();
  checkpointFlags:THREE.Group[]=[];
  scenery=new THREE.Group();
  farScenery=new THREE.Group();
  ragdollMeshes:THREE.Object3D[]=[];
  light=new THREE.DirectionalLight(0xfff4d9,3.2);
  target=new THREE.Vector3(7,3,0);
  private dust: {mesh:THREE.Mesh;velocity:THREE.Vector3;life:number;max:number;blood?:boolean}[]=[];
  private settings:GameSettings={...DEFAULT_SETTINGS};
  private width=0;private height=0;
  private shake=0;private dustClock=0;
  private resizeObserver:ResizeObserver;
  private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  modelReady: Promise<void>;
  modelLoaded=false;
  private dimensions:typeof BIKE_DIMENSIONS|typeof TRIALS_DIMENSIONS;
  private paint=material(0xf77b35);private jersey=material(0x3d7467);private helmetPaint=material(0xf4f4e7);
  private numberPlate?:THREE.Mesh;
  private bikeExtras:{mesh:THREE.Object3D;bike:string}[]=[];
  private trialsBody?:{torso:THREE.Mesh;hip:THREE.Mesh;head:THREE.Group;arms:THREE.Mesh[];legs:THREE.Mesh[]};

  constructor(public canvas:HTMLCanvasElement,public level:Level,public appearance:Appearance={...DEFAULT_APPEARANCE}) {
    this.dimensions=level.mode==='trials'?TRIALS_DIMENSIONS:BIKE_DIMENSIONS;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene.add(new THREE.HemisphereLight(0xf5f6de,0x847b6d,2.1));
    this.light.position.set(-6,18,15);this.light.castShadow=true;this.light.shadow.mapSize.set(2048,2048);
    Object.assign(this.light.shadow.camera,{left:-24,right:24,top:22,bottom:-16,near:1,far:65});
    this.light.shadow.bias=-0.0003;this.light.shadow.normalBias=0.04;
    this.scene.add(this.light,this.light.target);
    if(level.id){const theme=themeFor(level);mats.road.color.setHex(theme.road);mats.dirt.color.setHex(theme.dirt);mats.edge.color.setHex(theme.accent);}
    this.buildScenery();this.buildTerrain();this.buildObstacles();this.buildBike();this.buildHazards();this.buildMachines();this.buildMarkers();
    this.applyAppearance(appearance);this.modelReady=this.loadBikeModel();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement!);this.resize();
  }

  private async loadBikeModel(){
    try{
      const {scene}=await new GLTFLoader().loadAsync('./models/revbike.glb?rig=2');
      const chassis=scene.getObjectByName('chassis'),rear=scene.getObjectByName('rearWheel'),front=scene.getObjectByName('frontWheel');
      if(!chassis||!rear||!front)throw new Error('The bike asset is missing an animated part.');
      // The procedural bike remains a complete fallback if an asset request fails.
      for(const child of this.bike.children)if(child!==this.rider)child.visible=false;
      this.wheels.forEach(group=>{for(const child of group.children)child.visible=false;});
      this.bike.add(chassis);this.wheels[0].add(rear);this.wheels[1].add(front);
      for(const part of [chassis,rear,front])part.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.castShadow=true;obj.receiveShadow=true;}});
      // Dirt conversion: raised plastics, race plate, and chunky off-road tread.
      const frontFender=box(chassis,0.96,0.085,0.48,this.paint,this.dimensions.wheelOffsets[1],this.level.mode==='trials'?.72:.17,0);frontFender.rotation.z=-0.12;
      const rearFender=box(chassis,1,0.075,0.46,this.paint,this.dimensions.wheelOffsets[0]+.12,this.level.mode==='trials'?.76:.31,0);rearFender.rotation.z=0.08;
      const plate=mesh(new THREE.PlaneGeometry(0.48,0.36),label(String(this.appearance.number).padStart(2,'0'),'#f3f1dd','#28342f',256,192),chassis,0.16,0.3,0.25);plate.rotation.z=-0.16;this.numberPlate=plate;
      for(const [index,asset] of [rear,front].entries()){
        const ratio=this.dimensions.wheelRadius/.44;asset.scale.set(ratio,ratio,1);const wheel=this.wheels[index];
        for(let i=0;i<24;i++){
          const a=i/24*Math.PI*2;
          for(const z of [-0.095,0.095]){
            const treadRadius=this.dimensions.wheelRadius-0.075/2;
            const tread=box(wheel,0.105,0.075,0.15,mats.tire,Math.cos(a)*treadRadius,Math.sin(a)*treadRadius,z);
            tread.rotation.z=a-Math.PI/2;
          }
        }
      }
      const guard=box(chassis,1.05,.16,.53,mats.metal,-.1,-.42,.02);this.bikeExtras.push({mesh:guard,bike:'crawler'});
      const pro=box(chassis,.65,.25,.48,this.paint,.2,.4,.02);pro.rotation.z=-.2;this.bikeExtras.push({mesh:pro,bike:'section'});
      this.applyAppearance(this.appearance);
      this.modelLoaded=true;this.canvas.dataset.model='cgbike1-dirt-conversion';
    }catch(error){console.warn('Bike model could not load; using procedural dirtbike.',error);}
  }

  private buildTerrain() {
    for(const segment of this.level.segments){
      const points=sampleSegment(segment),shape=new THREE.Shape();
      shape.moveTo(points[0][0],-35);for(const [x,y] of points)shape.lineTo(x,y-0.18);
      shape.lineTo(points.at(-1)![0],-35);shape.closePath();
      const terrain=mesh(new THREE.ExtrudeGeometry(shape,{depth:1.8,bevelEnabled:false}),mats.dirt,this.scene,0,0,-0.9);
      terrain.receiveShadow=true;
      this.ribbon(points,0.22,mats.road,1.95);
      // A warm exposed lip and front-face strata make the physical surface readable.
      const lip=points.map(([x,y])=>new THREE.Vector3(x,y-0.29,1.01));
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip),points.length*2,0.075,5,false),mats.edge,this.scene);
      const strata=points.map(([x,y])=>new THREE.Vector3(x,y-1.2,0.93));
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strata),points.length,0.05,4,false),material(0x927866),this.scene);
      const min=points[0][0],max=points.at(-1)![0];
      for(let x=Math.ceil(min/1.8)*1.8;x<max;x+=1.8){
        const p=points.reduce((a,b)=>Math.abs(b[0]-x)<Math.abs(a[0]-x)?b:a);
        if(x>0 && x<max-1) {
          const stone=mesh(new THREE.DodecahedronGeometry(0.12+(Math.sin(x*7)+1)*0.07),material(this.level.environment==='neon'||this.level.environment==='construction'?0x647580:0x897665),this.scene,x,p[1]-0.7-(Math.sin(x*4)+1)*1.5,1.01);
          stone.scale.set(1.8,0.6,0.4);
        }
      }
    }
    for(const loop of [...(this.level.loop?[this.level.loop]:[]),...(this.level.loops??[])]){
      const points=loopPoints(loop);this.ribbon(points,0.24,mats.road,1.7);
      const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y-0.02,0.96)),true);
      mesh(new THREE.TubeGeometry(curve,160,0.07,6,true),mats.edge,this.scene);
      const {x,y,radius:r}=loop;
      for(const dx of [-r*0.68,r*0.68]){
        rod(this.scene,[x+dx,-0.4,-0.75],[x+dx,y+r*0.66,-0.75],0.1,mats.metal);
        rod(this.scene,[x+dx,-0.4,-0.75],[x,y+r,-0.75],0.07,mats.metal);
      }
      this.sign('LOOP / 02',x,y+r+1.2,4.2,0.8);
    }
    for(const points of this.level.paths??[]){
      this.ribbon(points,.2,mats.metal,1.6);
      const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,.85)));
      mesh(new THREE.TubeGeometry(curve,points.length*2,.07,5,false),new THREE.MeshBasicMaterial({color:0x52f3ef}),this.scene);
    }
  }

  private ribbon(points:Point[],thickness:number,mat:THREE.Material,depth:number){
    const shape=new THREE.Shape();shape.moveTo(...points[0]);
    for(const [x,y]of points.slice(1))shape.lineTo(x,y);
    for(let i=points.length-1;i>=0;i--){
      const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
      const angle=Math.atan2(next[1]-prev[1],next[0]-prev[0]);
      shape.lineTo(points[i][0]+Math.sin(angle)*thickness,points[i][1]-Math.cos(angle)*thickness);
    }
    shape.closePath();mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),mat,this.scene,0,0,-depth/2);
  }

  private buildBike(){
    this.scene.add(this.bike,...this.wheels);this.bike.add(this.rider);
    const frameNodes=[[-0.35,0.25],[0.45,0.2],[-0.1,-0.32],[-0.35,0.25]];
    for(let i=0;i<frameNodes.length-1;i++)rod(this.bike,[...frameNodes[i],0.15],[...frameNodes[i+1],0.15],0.075,mats.orange);
    rod(this.bike,[-0.35,0.25,0.15],[-0.1,-0.32,0.15],0.065,mats.orange);
    rod(this.bike,[-0.1,-0.32,0.15],[0.45,0.2,0.15],0.065,mats.orange);
    const engine=box(this.bike,0.48,0.36,0.4,mats.metal,-0.06,-0.14,0);
    engine.rotation.z=-0.2;
    for(let i=0;i<4;i++)box(this.bike,0.4,0.028,0.46,mats.ink,-0.06,-0.24+i*0.08,0.05);
    box(this.bike,0.85,0.13,0.48,mats.ink,-0.31,0.32,0);
    const tank=box(this.bike,0.5,0.29,0.46,mats.orange,0.31,0.25,0);tank.rotation.z=-0.15;
    const rearFender=box(this.bike,0.8,0.09,0.48,mats.orange,-0.8,0.19,0);rearFender.rotation.z=0.08;
    const frontFender=box(this.bike,0.73,0.08,0.46,mats.orange,0.98,0.18,0);frontFender.rotation.z=-0.12;
    rod(this.bike,[0.64,0.1,0],[0.53,0.71,0],0.052,mats.metal);
    rod(this.bike,[0.53,0.71,-0.3],[0.53,0.71,0.3],0.045,mats.ink);
    box(this.bike,0.27,0.25,0.12,mats.white,0.7,0.48,0.27).rotation.z=-0.22;
    for(let i=0;i<2;i++)this.suspension.push(rod(this.scene,[0,0,0],[0,1,0],0.055,mats.metal));
    for(const z of [-0.2,0.24]){
      this.rearSwingarms.push(rod(this.scene,[0,0,z],[0,1,z],0.065,mats.ink));
      this.forkSleeves.push(rod(this.scene,[0,0,z],[0,1,z],0.075,mats.metal));
    }
    class Coil extends THREE.Curve<THREE.Vector3>{constructor(){super();}getPoint(t:number){const a=t*Math.PI*2*9;return new THREE.Vector3(Math.cos(a)*0.085,t-0.5,Math.sin(a)*0.085);}}
    this.rearSpring=mesh(new THREE.TubeGeometry(new Coil(),110,0.024,5,false),mats.orange,this.scene);
    for(const wheel of this.wheels){
      const tire=mesh(new THREE.CylinderGeometry(this.dimensions.wheelRadius,this.dimensions.wheelRadius,0.3,24),mats.tire,wheel);tire.rotation.x=Math.PI/2;
      for(const z of [-0.16,0.16]){
        const rimRadius=this.dimensions.wheelRadius*.77;
        mesh(new THREE.TorusGeometry(rimRadius,0.035,6,24),mats.metal,wheel,0,0,z);
        for(let i=0;i<10;i++){
          const a=i/10*Math.PI*2;rod(wheel,[0,0,z],[Math.cos(a)*(rimRadius-.02),Math.sin(a)*(rimRadius-.02),z],0.012,mats.metal);
        }
      }
      for(let i=0;i<20;i++){
        const a=i/20*Math.PI*2,treadRadius=this.dimensions.wheelRadius-0.07/2;const tread=box(wheel,0.11,0.07,0.34,mats.tire,Math.cos(a)*treadRadius,Math.sin(a)*treadRadius);tread.rotation.z=a-Math.PI/2;
      }
      const hub=mesh(new THREE.CylinderGeometry(0.09,0.09,0.4,12),mats.orange,wheel);hub.rotation.x=Math.PI/2;
    }
    // A compact, articulated riding silhouette. The matching physical head sensor sits at the helmet.
    this.buildRider(this.rider);
    if(this.level.mode!=='trials')this.rider.traverse(obj=>{if(obj instanceof THREE.Mesh){if(obj.material===mats.rider)obj.material=this.jersey;else if(obj.material===mats.orange)obj.material=this.paint;else if(obj.material===mats.white)obj.material=this.helmetPaint;}});
  }

  private buildRider(parent:THREE.Group){
    if(this.level.mode==='trials'){
      const unit=(r:number,m:THREE.Material)=>rod(parent,[0,0,0],[0,1,0],r,m);
      const head=new THREE.Group();parent.add(head);const helmet=ball(head,.29,this.helmetPaint,0,0,.04);helmet.scale.set(1.05,1,.95);
      box(head,.25,.16,.5,mats.ink,.22,0,.05);box(head,.4,.04,.54,this.paint,.25,.17,.04);
      this.trialsBody={torso:unit(.16,this.jersey),hip:ball(parent,.18,mats.ink),head,arms:[],legs:[]};
      for(const z of [-.21,.23]){for(let j=0;j<2;j++){const arm=unit(.07,j?mats.ink:this.jersey);arm.position.z=z;this.trialsBody.arms.push(arm);const leg=unit(.09,j?mats.ink:this.jersey);leg.position.z=z;this.trialsBody.legs.push(leg);}box(parent,.3,.13,.15,mats.ink,-.08,-.25,z);}
      return;
    }
    rod(parent,[-0.28,0.38,0.04],[-0.2,0.94,0.04],0.18,mats.rider);
    box(parent,0.33,0.25,0.35,mats.orange,-0.21,0.86,0.05).rotation.z=0.18;
    for(const z of [-0.21,0.23]){
      rod(parent,[-0.25,0.44,z],[0.13,0.08,z],0.1,mats.ink);
      rod(parent,[0.13,0.08,z],[-0.17,-0.23,z],0.085,mats.rider);
      box(parent,0.32,0.14,0.16,mats.ink,-0.08,-0.25,z);
      rod(parent,[-0.19,0.95,z],[0.18,0.67,z],0.075,mats.orange);
      rod(parent,[0.18,0.67,z],[0.53,0.71,z],0.068,mats.rider);
      ball(parent,0.085,mats.ink,0.53,0.71,z);
    }
    const helmet=ball(parent,0.29,mats.white,-0.03,1.26,0.04);helmet.scale.set(1.05,1,0.95);
    const stripe=box(parent,0.41,0.1,0.56,mats.orange,-0.05,1.38,0.05);stripe.rotation.z=0.12;
    box(parent,0.23,0.16,0.5,mats.ink,0.19,1.27,0.05).rotation.z=-0.12;
    box(parent,0.42,0.045,0.54,mats.white,0.2,1.44,0.04).rotation.z=-0.12;
  }

  private updateTrialsRider(shift:number,crouch=0){
    const body=this.trialsBody;if(!body)return;
    const connect=(obj:THREE.Mesh,a:number[],b:number[])=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);obj.position.copy(start.add(end).multiplyScalar(.5));obj.scale.y=d.length();obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());};
    connect(body.torso,[-.25+shift*.55,.42+crouch*.3,.04],[-.2+shift*.8,.94+crouch*.7,.04]);body.hip.position.set(-.25+shift*.55,.42+crouch*.3,.04);body.head.position.set(-.03+shift*.85,1.26+crouch*.9,0);
    for(let side=0;side<2;side++){const z=side? .23:-.21,knee=[.13+shift*.22,.08,z],elbow=[.18+shift*.45,.67,z];connect(body.legs[side*2],[-.25+shift*.55,.44+crouch*.3,z],knee);connect(body.legs[side*2+1],knee,[-.17,-.23,z]);connect(body.arms[side*2],[-.19+shift*.8,.95+crouch*.7,z],elbow);connect(body.arms[side*2+1],elbow,[.53,.71,z]);}
  }
  applyAppearance(appearance:Appearance){
    this.appearance={...appearance};this.paint.color.set(appearance.paint);this.jersey.color.set(appearance.jersey);this.helmetPaint.color.set(appearance.helmet);
    for(const extra of this.bikeExtras)extra.mesh.visible=extra.bike===appearance.bike;
    if(this.numberPlate){const old=this.numberPlate.material as THREE.MeshBasicMaterial;old.map?.dispose();old.dispose();this.numberPlate.material=label(String(appearance.number).padStart(2,'0'),'#f3f1dd','#28342f',256,192);}
    this.canvas.dataset.bike=appearance.bike;this.canvas.dataset.riderNumber=String(appearance.number);
  }
  private buildObstacles(){
    for(const o of this.level.obstacles??[]){
      const group=new THREE.Group();group.position.set(o.x,o.y,0);this.scene.add(group);
      if(o.kind==='log'){
        const log=mesh(new THREE.CylinderGeometry(o.height/2,o.height/2,1.9,32),material(0x896043),group);log.rotation.x=Math.PI/2;
        const cut=mesh(new THREE.CircleGeometry(o.height*.43,32),material(0xc49661),group,0,0,.96);
        for(const r of [.18,.3])mesh(new THREE.TorusGeometry(o.height*r,.015,4,24),material(0x95683d),group,0,0,.98);
      }else{
        const mat=material(o.kind==='crate'?0xa8794c:o.kind==='rock'?0x8f8174:0x9ba5a1);
        box(group,o.width,o.height,1.9,mat);
        if(o.kind==='crate'){for(const d of [-1,1])rod(group,[-o.width/2,d*o.height/2,.98],[o.width/2,-d*o.height/2,.98],.04,mats.ink);}
        const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(o.width,o.height,1.93)),new THREE.LineBasicMaterial({color:0xe0d5ba}));group.add(edges);
      }
    }
  }
  private buildScenery(){
    if(this.level.id){buildCampaignScenery(this.scene,this.scenery,this.farScenery,this.level);return;}
    this.scene.add(this.scenery,this.farScenery);
    const random=(n:number)=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);};
    const mountain=(x:number,y:number,w:number,h:number,color:number,z:number,parent:THREE.Object3D)=>{
      const shape=new THREE.Shape();shape.moveTo(x-w/2,-12);shape.lineTo(x-w/2,y);
      shape.lineTo(x-w*0.18,y+h*0.76);shape.lineTo(x-w*0.1,y+h);shape.lineTo(x+w*0.18,y+h*0.95);
      shape.lineTo(x+w*0.26,y+h*0.7);shape.lineTo(x+w/2,y);shape.lineTo(x+w/2,-12);shape.closePath();
      const obj=mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color}),parent,0,0,z);obj.castShadow=false;
    };
    for(let i=-5;i<15;i++)mountain(i*19,-3,26+random(i)*10,9+random(i+3)*7,0xc4ceba,-45,this.farScenery);
    for(let i=-5;i<20;i++)mountain(i*15,-4,18+random(i+5)*7,7+random(i+9)*6,0xc6b8a1,-28,this.scenery);
    for(let i=-5;i<30;i++)mountain(i*11,-6,15+random(i+15)*5,6+random(i+19)*5,0xb6a994,-18,this.scenery);
    const sun=mesh(new THREE.CircleGeometry(2.05,48),new THREE.MeshBasicMaterial({color:0xf5edbd,transparent:true,opacity:0.9}),this.farScenery,18,12,-44);sun.castShadow=false;
    for(let i=-2;i<15;i++){
      const cloud=new THREE.Group();cloud.position.set(i*19+random(i)*7,11+random(i+4)*6,-35);
      for(let j=0;j<3;j++){const puff=ball(cloud,1.1+j*0.1,new THREE.MeshBasicMaterial({color:0xeff0d9,transparent:true,opacity:0.75}),j*1.1,Math.sin(j)*0.3);puff.scale.set(1.5,0.35,0.1);puff.castShadow=false;}
      this.farScenery.add(cloud);
    }
    for(let x=-8;x<210;x+=5.3){
      const segment=this.level.segments.find(s=>x>=s.points[0][0]&&x<=s.points.at(-1)![0]);
      if(!segment)continue;
      const points=sampleSegment(segment),p=points.reduce((a,b)=>Math.abs(b[0]-x)<Math.abs(a[0]-x)?b:a);
      const h=0.8+random(x)*1.3,z=-2.5-random(x+1)*2;
      if(random(x+2)>0.33){
        const cactus=new THREE.Group();cactus.position.set(x,p[1]-0.15,z);this.scene.add(cactus);
        const mat=material(0x738674);rod(cactus,[0,0,0],[0,h,0],0.1,mat);ball(cactus,0.1,mat,0,h,0);
        rod(cactus,[0,h*0.4,0],[0.4,h*0.4,0],0.08,mat);rod(cactus,[0.4,h*0.4,0],[0.4,h*0.76,0],0.08,mat);
        rod(cactus,[0,h*0.62,0],[-0.33,h*0.62,0],0.07,mat);rod(cactus,[-0.33,h*0.62,0],[-0.33,h*0.9,0],0.07,mat);
      }else{
        const rock=mesh(new THREE.DodecahedronGeometry(0.6+random(x)*0.8),material(0xa69781),this.scene,x,p[1]-0.05,z);rock.scale.set(1.4,0.65,0.8);
      }
    }
    // Wind farm silhouettes echo the industrial stunt course.
    for(const x of [12,60,114,173]){
      const group=new THREE.Group();group.position.set(x,1,-13);this.scene.add(group);
      rod(group,[0,-4,0],[0,6,0],0.06,material(0x9ca991));
      for(let i=0;i<3;i++){const a=i*2*Math.PI/3;rod(group,[0,6,0],[Math.sin(a)*2.8,6+Math.cos(a)*2.8,0],0.055,material(0x9ca991));}
    }
  }

  private buildHazards(){
    this.level.hazards.forEach((h,index)=>{
      const group=new THREE.Group();group.position.set(h.x,h.y,0);this.scene.add(group);this.hazardMeshes.push(group);
      if(h.type==='tnt'){
        mesh(new THREE.CylinderGeometry(0.38,0.38,1.04,14),mats.orange,group);
        for(const y of [-0.39,0.39])mesh(new THREE.TorusGeometry(0.38,0.035,5,14),mats.ink,group,0,y,0).rotation.x=Math.PI/2;
        mesh(new THREE.PlaneGeometry(0.55,0.34),label('TNT','#f1e9cf','#343c32',256,128),group,0,0,0.39);
        rod(group,[0,0.52,0],[0.15,0.75,0],0.022,mats.ink);
      }else if(['mud','lava','laser'].includes(h.type)){
        box(group,h.width??8,.3,2.2,new THREE.MeshBasicMaterial({color:h.type==='lava'?0xff622b:h.type==='laser'?0xfb43c6:0x536e81}));
        if(h.type==='laser')for(let j=0;j<4;j++)box(group,h.width??8,.05,.1,new THREE.MeshBasicMaterial({color:0xffa9ed}),0,.15+j*.2,.3);
      }else if(h.type==='crusher'){
        box(group,h.width??3,2.4,2,mats.metal);box(group,h.width??3,.2,2.1,mats.lime,0,-1.2);
        rod(this.scene,[h.x,12,-.5],[h.x,h.y,-.5],.18,mats.metal);
        for(let j=0;j<4;j++)box(group,.3,2.4,2.15,mats.ink,-1.1+j*.7,0).rotation.z=-.3;
      }else if(['boulder','wrecking','axe'].includes(h.type)){
        const r=h.radius??1;
        if(h.type==='boulder')mesh(new THREE.DodecahedronGeometry(r,1),material(0x63504a),group);
        else{
          ball(group,r,h.type==='axe'?mats.saw:mats.ink);
          if(h.type==='axe'){box(group,r*2.4,.35,.25,mats.saw,0,0,.2);box(group,.18,2,.25,mats.metal,0,1);}
          const cable=rod(this.scene,[h.x,h.anchorY??h.y+6,0],[h.x,h.y,0],.06,mats.metal);this.hazardCables.set(index,cable);
        }
      }else if(h.type==='spikes'){
        const w=h.width??4;box(group,w,0.22,1.5,mats.ink,0,-0.34);
        for(let x=-w/2+0.2;x<w/2;x+=0.5){
          const cone=mesh(new THREE.ConeGeometry(0.23,0.85,4),mats.metal,group,x,0,0.25);cone.rotation.y=Math.PI/4;
          const cone2=cone.clone();cone2.position.z=-0.4;group.add(cone2);
        }
      }else{
        const r=h.radius??1;
        rod(this.scene,[h.x,h.y-3,-0.6],[h.x,h.y,-0.6],0.11,mats.metal);
        const disk=mesh(new THREE.CylinderGeometry(r*0.8,r*0.8,0.18,32),mats.saw,group);disk.rotation.x=Math.PI/2;
        for(let i=0;i<16;i++){
          const a=i/16*Math.PI*2;
          const tooth=mesh(new THREE.ConeGeometry(r*0.16,r*0.39,3),mats.saw,group,Math.cos(a)*r*0.85,Math.sin(a)*r*0.85,0);
          tooth.rotation.z=a-Math.PI/2+0.4;tooth.rotation.y=Math.PI/2;
        }
        mesh(new THREE.TorusGeometry(r*0.54,0.035,5,24),mats.ink,group,0,0,0.11);
        ball(group,r*0.15,mats.orange,0,0,0.17);
      }
    });
  }

  private buildMachines(){
    for(const m of this.level.mechanisms??[]){
      const group=new THREE.Group();group.position.set(m.x,m.y,0);this.scene.add(group);this.machineMeshes.push(group);
      const neon=this.level.environment==='neon',deck=m.kind==='spring'?material(0xeed552):m.kind==='boost'?material(0x59e6d5):m.kind==='collapse'&&neon?new THREE.MeshStandardMaterial({color:0x75e8eb,transparent:true,opacity:.65}):m.kind==='seesaw'||m.kind==='collapse'?material(0x9a6840):mats.metal;
      if(m.kind==='roller'){
        const roller=mesh(new THREE.CylinderGeometry(m.width/2,m.width/2,1.8,24),mats.metal,group);roller.rotation.x=Math.PI/2;
        for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])box(group,.1,m.width,.08,mats.orange,0,0,1).rotation.z=a;
      }else{
        box(group,m.width,.32,1.9,deck);
        for(let x=-m.width/2+.5;x<m.width/2;x+=1.2)box(group,.08,.34,2,mats.ink,x,0);
        if(m.kind==='conveyor'||m.kind==='boost')for(let x=-m.width/2+1;x<m.width/2;x+=2.5){const arrow=mesh(new THREE.ConeGeometry(.25,.55,3),mats.lime,group,x,.22,1);arrow.rotation.z=(m.speed??1)>0?-Math.PI/2:Math.PI/2;}
        if(m.kind==='seesaw'||m.kind==='flex'){const support=mesh(new THREE.ConeGeometry(.6,1.5,4),mats.metal,this.scene,m.x,m.y-.85,-.3);support.rotation.y=Math.PI/4;}
        if(m.kind==='lift'){rod(this.scene,[m.x,m.y-2,-.8],[m.x,m.y+(m.rise??7),-.8],.17,mats.metal);box(this.scene,1.8,.5,2,mats.ink,m.x,m.y-1.8,-.3);}
        if(m.kind==='spring')for(let j=0;j<5;j++)mesh(new THREE.TorusGeometry(.4,.05,6,12),mats.metal,this.scene,m.x,m.y-.25-j*.15,-.2).rotation.x=Math.PI/2;
      }
    }
  }

  private sign(text:string,x:number,y:number,width:number,height:number,bg='#d8ef68',fg='#28342f'){
    const group=new THREE.Group();group.position.set(x,y,-1.2);this.scene.add(group);
    mesh(new THREE.PlaneGeometry(width,height),label(text,bg,fg),group,0,0,0.1);
    box(group,width+0.1,height+0.1,0.12,mats.ink);
    return group;
  }

  private buildMarkers(){
    if(!this.level.id){
    this.sign('SEND IT.',9,3.7,3.2,0.9);
    for(const x of [7.8,10.2])rod(this.scene,[x,0,-1.3],[x,3.25,-1.3],0.06,mats.ink);
    this.sign('01 / FIRST FLIGHT',21,6.9,4.6,0.7,'#f0ead5','#485047');
    this.sign('MIND THE GAP →',49,7.2,4.4,0.7,'#f0ead5','#485047');
    }else for(const [i,piece]of this.level.setPieces!.entries())this.sign(`${i+1} / ${piece.name.toUpperCase()}`,piece.x+7,4.5,Math.min(6.5,piece.name.length*.26),.65);
    for(const [index,[x,y]]of this.level.checkpoints.entries()){
      const group=new THREE.Group();group.position.set(x,y,-0.65);this.scene.add(group);
      rod(group,[0,-0.2,0],[0,2.7,0],0.045,mats.ink);
      const shape=new THREE.Shape();shape.moveTo(0,2.7);shape.lineTo(1.2,2.35);shape.lineTo(0,2.0);shape.closePath();
      mesh(new THREE.ShapeGeometry(shape),material(0xc5c5ac),group,0,0,0.03);
      this.checkpointFlags.push(group);
      this.sign(`CP ${String(index+1).padStart(2,'0')}`,x,y-0.58,1.1,0.35,'#485047','#f0ead5');
    }
    const [x,y]=this.level.finish;
    for(const dx of [-0.9,0.9]){
      rod(this.scene,[x+dx,y,-0.95],[x+dx,y+5,-0.95],0.07,mats.ink);
      for(let i=0;i<8;i++)box(this.scene,0.15,0.3,0.15,i%2?mats.white:mats.ink,x+dx,y+1+i*0.3,-0.95);
    }
    this.sign('FINISH',x,y+4.5,3.8,0.9);
  }

  checkpoint(index:number){
    const flag=this.checkpointFlags[index]?.children[1] as THREE.Mesh;
    if(flag)flag.material=mats.lime;
    const p=this.level.checkpoints[index];if(p)this.burst(p[0],p[1]+2,colors.lime,14,3);
  }

  reset(position?:{x:number;y:number}){
    this.clearParticles();this.shake=0;
    for(const group of this.hazardMeshes)group.visible=true;
    for(const group of this.checkpointFlags)(group.children[1] as THREE.Mesh).material=material(0xc5c5ac);
    this.rider.visible=true;
    this.target.set(position?position.x+5:7,position?Math.max(3,position.y+1.7):3,0);
  }

  applySettings(settings:GameSettings){
    this.settings={...settings};
    this.canvas.dataset.bloodAmount=settings.blood;
    this.canvas.dataset.frameRate=String(settings.frameRate);
    const pixelRatio={low:1,medium:1.5,high:2}[settings.quality];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,pixelRatio));
    this.renderer.shadowMap.enabled=settings.quality!=='low';
    const shadowSize=settings.quality==='high'?2048:1024;
    if(this.light.shadow.mapSize.x!==shadowSize){
      this.light.shadow.mapSize.set(shadowSize,shadowSize);
      this.light.shadow.map?.dispose();this.light.shadow.map=null;
    }
    if(!settings.screenShake)this.shake=0;
    if(settings.blood==='off')this.clearParticles(true);
    this.resize();
  }

  private clearParticles(bloodOnly=false){
    for(let i=this.dust.length-1;i>=0;i--){
      const p=this.dust[i];if(bloodOnly&&!p.blood)continue;
      this.scene.remove(p.mesh);p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();this.dust.splice(i,1);
    }
    this.canvas.dataset.bloodParticles='0';
  }

  bloodBurst(x:number,y:number){
    const count=bloodParticleCount(this.settings.blood);
    for(let i=0;i<count;i++){
      const life=0.55+Math.random()*0.6;
      const obj=mesh(new THREE.SphereGeometry(0.035+Math.random()*0.045,5,4),new THREE.MeshBasicMaterial({color:i%3===0?0x7e202b:0xbb3440,transparent:true}),this.scene,x,y,0.6+Math.random()*0.2);
      obj.scale.set(0.7,1.4,0.7);
      this.dust.push({mesh:obj,velocity:new THREE.Vector3((Math.random()-0.5)*7,2+Math.random()*5,0),life,max:life,blood:true});
    }
    this.canvas.dataset.bloodParticles=String(count);
  }

  burst(x:number,y:number,color=colors.orange,count=36,speed=7){
    if(!this.reduced&&this.settings.screenShake)this.shake=0.24;
    for(let i=0;i<count;i++){
      const obj=mesh(new THREE.IcosahedronGeometry(0.06+Math.random()*0.1,0),new THREE.MeshBasicMaterial({color:i%3===0?colors.lime:color,transparent:true}),this.scene,x,y,0.3+Math.random());
      const a=Math.random()*Math.PI*2,life=0.45+Math.random()*0.6;
      this.dust.push({mesh:obj,velocity:new THREE.Vector3(Math.cos(a)*speed*Math.random(),Math.sin(a)*speed*Math.random()+1,0),life,max:life});
    }
  }

  private syncRagdoll(sim:Simulation){
    if(!sim.crashed){
      for(const obj of this.ragdollMeshes){this.scene.remove(obj);const m=obj as THREE.Mesh;m.geometry.dispose();}
      this.ragdollMeshes=[];this.rider.visible=true;return;
    }
    this.rider.visible=false;
    if(!this.ragdollMeshes.length)for(const part of sim.ragdoll){
      const obj=part.kind==='head'?ball(this.scene,0.28,mats.white):mesh(new THREE.CapsuleGeometry(part.kind==='torso'?0.17:0.09,part.length-0.2,4,8),part.kind==='torso'?mats.orange:mats.rider,this.scene);
      this.ragdollMeshes.push(obj);
    }
    sim.ragdoll.forEach((part,i)=>{
      const p=part.body.translation(),obj=this.ragdollMeshes[i];obj.position.set(p.x,p.y,0.3);obj.rotation.z=part.body.rotation();
    });
  }

  resize(){
    const rect=this.canvas.parentElement!.getBoundingClientRect();this.width=rect.width;this.height=rect.height;
    this.renderer.setSize(this.width,this.height,false);
    const aspect=this.width/this.height,viewHeight=aspect<1.1?30:34;
    this.camera.left=-viewHeight*aspect/2;this.camera.right=viewHeight*aspect/2;this.camera.top=viewHeight/2;this.camera.bottom=-viewHeight/2;this.camera.updateProjectionMatrix();
  }

  render(sim:Simulation,dt:number,playing:boolean,alpha=1){
    const {frame,wheels}=sim.bike,poses=sim.getRenderPoses(alpha),p=poses[0],angle=p.angle;
    this.bike.position.set(p.x,p.y,0);this.bike.rotation.z=angle;
    const transform=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).applyAxisAngle(new THREE.Vector3(0,0,1),angle).add(new THREE.Vector3(p.x,p.y,0));
    const connect=(obj:THREE.Mesh,start:THREE.Vector3,end:THREE.Vector3)=>{
      const direction=end.clone().sub(start);obj.position.copy(start.clone().add(end).multiplyScalar(0.5));
      obj.scale.y=direction.length();obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    };
    wheels.forEach((wheel,i)=>{
      const wp=poses[i+1];this.wheels[i].position.set(wp.x,wp.y,0);this.wheels[i].rotation.z=wp.angle;
      const axle=new THREE.Vector3(wp.x,wp.y,0.24);
      if(i===0){
        const pivot=transform(-0.18,-0.2,0.24),upper=transform(-0.43,0.29,0.28);
        const lower=pivot.clone().lerp(axle,0.6);lower.z=0.28;
        connect(this.suspension[0],upper,lower);connect(this.rearSpring,upper,lower);
        this.rearSwingarms.forEach((arm,j)=>{const z=j===0?-0.2:0.24;const start=pivot.clone();start.z=z;const end=axle.clone();end.z=z;connect(arm,start,end);});
      }else{
        const top=transform(0.53,0.68,0.24);
        connect(this.suspension[1],top,axle);
        this.forkSleeves.forEach((sleeve,j)=>{
          const start=top.clone(),end=top.clone().add(axle.clone().sub(top).normalize().multiplyScalar(0.55));
          start.z=end.z=j===0?-0.2:0.24;connect(sleeve,start,end);
        });
      }
    });
    this.updateTrialsRider(sim.riderShift,sim.riderCrouch);
    this.syncRagdoll(sim);
    this.hazardMeshes.forEach((group,i)=>{
      const body=sim.hazardBodies[i],p=body.translation();group.position.set(p.x,p.y,0);
      if(['wrecking','axe','boulder'].includes(sim.level.hazards[i].type))group.rotation.z=body.rotation();
      if(sim.level.hazards[i].type==='saw')group.rotation.z-=dt*5;
      if(sim.exploded.has(i))group.visible=false;
      const cable=this.hazardCables.get(i);if(cable){const h=this.level.hazards[i],top=new THREE.Vector3(h.x,h.anchorY??h.y+6,0),end=new THREE.Vector3(p.x,p.y,0),d=end.clone().sub(top);cable.position.copy(top.add(end).multiplyScalar(.5));cable.scale.y=d.length()/(h.anchorY! -h.y);cable.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());}
    });
    this.machineMeshes.forEach((group,i)=>{const machine=sim.machines.items[i],p=machine.body.translation();group.position.set(p.x,p.y,0);group.rotation.z=machine.body.rotation();group.visible=p.y>-15;});
    if(playing && !sim.crashed && sim.grounded && Math.abs(frame.linvel().x)>3){
      this.dustClock+=dt;
      if(this.dustClock>0.045){this.dustClock=0;const wp=wheels[0].translation();
        const obj=mesh(new THREE.SphereGeometry(0.09,5,4),new THREE.MeshBasicMaterial({color:0xd3bd95,transparent:true,opacity:0.55}),this.scene,wp.x-0.35,wp.y-0.35,0.7);
        this.dust.push({mesh:obj,velocity:new THREE.Vector3(-1,0.8,0),life:0.5,max:0.5});
      }
    }
    for(let i=this.dust.length-1;i>=0;i--){
      const particle=this.dust[i];particle.life-=dt;particle.velocity.y-=dt*6;particle.mesh.position.addScaledVector(particle.velocity,dt);particle.mesh.rotation.z+=dt*3;
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,particle.life/particle.max);particle.mesh.scale.multiplyScalar(1+dt*0.9);
      if(particle.life<=0){this.scene.remove(particle.mesh);particle.mesh.geometry.dispose();(particle.mesh.material as THREE.Material).dispose();this.dust.splice(i,1);}
    }
    const velocity=frame.linvel();
    const lookahead=playing?Math.max(-4,Math.min(7.5,2.8+velocity.x*0.18)):5;
    const verticalLead=playing?Math.max(-0.8,Math.min(1.5,velocity.y*0.1)):0;
    const desired=new THREE.Vector3(p.x+lookahead,Math.max(3,p.y+1.7+verticalLead),0);
    this.target.lerp(desired,1-Math.exp(-dt*4.5));
    const shake=this.shake>0?this.shake:0;this.shake=Math.max(0,this.shake-dt);
    this.camera.position.set(this.target.x+(Math.random()-0.5)*shake,this.target.y+3.6+(Math.random()-0.5)*shake,32);
    this.camera.lookAt(this.target);
    this.scenery.position.x=this.target.x*0.28;this.farScenery.position.x=this.target.x*0.53;
    this.light.position.set(p.x-8,p.y+18,15);this.light.target.position.set(p.x,p.y,0);
    this.renderer.render(this.scene,this.camera);
  }
}
