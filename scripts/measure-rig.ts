import { RAPIER, Simulation, TUNING, STEP } from '../src/physics';
import { testLevel } from '../src/track';
await RAPIER.init();
const neutral={gas:false,brake:false,left:false,right:false};
const selected=TUNING.springStiffness;
for(const k of process.argv.includes('--sweep')?[210,300,400,500,650]:[selected]){
  TUNING.springStiffness=k;
  const sim=new Simulation(testLevel);
  for(let i=0;i<360;i++)sim.step(neutral);
  const stand={height:sim.bike.frame.translation().y,axleDrop:sim.getSuspensionTelemetry().map(t=>t.axleDrop),compression:sim.getSuspensionTelemetry().map(t=>t.compression)};
  sim.spawn([2,5]);let peak=0,minClearance=100,maxOmega=0;
  for(let i=0;i<360;i++){
    sim.step(neutral);
    for(const t of sim.getSuspensionTelemetry()){peak=Math.max(peak,t.compression);minClearance=Math.min(minClearance,t.tireClearance);}
    maxOmega=Math.max(maxOmega,Math.abs(sim.bike.frame.angvel()));
  }
  console.log(JSON.stringify({k,stand,dropPeak:peak,minClearance,crashed:sim.crashed,settledHeight:sim.bike.frame.translation().y,maxOmega,time:360*STEP}));
  sim.dispose();
}
TUNING.springStiffness=selected;
