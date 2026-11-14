import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings, FrameLimiter, FRAME_RATES, bloodParticleCount } from '../src/settings';

test('saved preferences accept valid selections and recover from invalid browser storage',()=>{
  assert.deepEqual(normalizeSettings(null),DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({frameRate:-1,quality:'ultra',blood:99,screenShake:'yes'}),DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({frameRate:30,quality:'low',blood:'high',screenShake:false}),{frameRate:30,quality:'low',blood:'high',screenShake:false});
});
for(const rate of FRAME_RATES)test(`${rate||'auto'} FPS setting gates draws at a 144 Hz callback rate`,()=>{
  const limiter=new FrameLimiter(rate);let frames=0,totalRenderTime=0;
  for(let i=0;i<=1440;i++){
    const dt=limiter.tick(i*1000/144);
    if(dt!==null){frames++;totalRenderTime+=dt;}
  }
  assert.ok(Math.abs(frames-(rate===0?1441:rate*10+1))<=1,`received ${frames} draws`);
  assert.ok(Math.abs(totalRenderTime-10)<0.04,'render delta accounts for the time between drawn frames');
});
test('changing frame cap takes effect immediately and cannot exceed the display refresh rate',()=>{
  const limiter=new FrameLimiter(30);assert.ok(limiter.tick(0)!==null);assert.equal(limiter.tick(10),null);
  limiter.setFrameRate(144);assert.ok(limiter.tick(10)!==null);
  let frames=0;for(let i=1;i<=60;i++)if(limiter.tick(10+i*1000/60)!==null)frames++;
  assert.equal(frames,60);
});
test('blood off emits no particles and each amount visibly increases the crash spray',()=>{
  assert.equal(bloodParticleCount('off'),0);
  assert.ok(bloodParticleCount('low')>0);
  assert.ok(bloodParticleCount('medium')>bloodParticleCount('low'));
  assert.ok(bloodParticleCount('high')>bloodParticleCount('medium'));
});
