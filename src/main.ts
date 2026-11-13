import './style.css';
import { RAPIER, Simulation, STEP, type Controls, type BikeSnapshot } from './physics';
import { GameRenderer } from './render';
import { level1, testLevel, type Point } from './track';
import { BikeAudio } from './audio';

const icons:Record<string,string>={
  restart:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 5 11 7-11 7Z"/>',
  sound:'<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6m0-6-6 6"/>',
  fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 3v.01"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  flag:'<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
};
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const star='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9Z"/></svg>';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const params=new URLSearchParams(location.search);
if(params.get('embed')==='1')document.documentElement.classList.add('embed-mode');
const level=params.get('course')==='test'?testLevel:level1;
let best:number|null=null;try{const saved=localStorage.getItem(`revbike-best-${level.name}`);if(saved)best=Number(saved);}catch{}

$('app').innerHTML=`
  <header class="site-header">
    <a class="wordmark" href="./" aria-label="REVBIKE home"><span class="brand-symbol"><i></i><i></i><i></i></span>REVBIKE<span class="brand-dot">®</span></a>
    <span class="brand-tagline">PHYSICS. DIRT. REPEAT.</span>
    <div class="header-right"><span class="edition"><span class="green-dot"></span> THE STUNT SERIES <b>VOL. 01</b></span><button id="help" class="help-button">HOW TO RIDE ${icon('help')}</button></div>
  </header>
  <main>
    <div class="course-heading"><div class="eyebrow">A LITTLE THROTTLE. A LOT OF NERVE.</div><span class="course-index">EST. 2026 / BUILT FOR AIRTIME</span></div>
    <section class="game-shell" aria-label="REVBIKE dirtbike game">
      <div class="game-toolbar">
        <div class="level-info"><span class="level-number">01</span><div><div class="level-kicker">THE FIRST RIDE <span class="difficulty">ROOKIE</span></div><h1>${level.name}</h1></div></div>
        <div class="timer-wrap"><div class="timer-label">RUN TIME <span id="timer-state">READY WHEN YOU ARE</span></div><div class="timer-row"><span id="timer" class="timer">00:00<span>.00</span></span><div id="live-stars" class="live-stars">${star.repeat(3)}</div></div></div>
        <div class="toolbar-actions"><button id="embed-help" class="icon-button embed-only" aria-label="How to ride" title="How to ride">${icon('help')}</button><button id="restart" class="icon-button" aria-label="Restart level (Shift + R)" title="Restart level · Shift + R">${icon('restart')}</button><button id="pause" class="icon-button" aria-label="Pause (P)" title="Pause · P">${icon('pause')}</button><span class="toolbar-divider"></span><button id="sound" class="icon-button" aria-label="Enable sound" title="Enable sound">${icon('mute')}</button><button id="fullscreen" class="icon-button" aria-label="Enter fullscreen" title="Fullscreen">${icon('fullscreen')}</button></div>
      </div>
      <div id="stage" class="stage">
        <canvas id="game" tabindex="0" aria-label="Dirtbike course. Use W or Up to accelerate, S or Down to brake, A and D to lean. R retries the checkpoint."></canvas>
        <div class="stage-vignette"></div>
        <div class="stage-top"><span class="location-label"><span class="live-dot"></span> REDROCK COUNTY, NV</span><div class="progress-wrap"><span>START</span><div class="progress-track"><div id="progress-fill"></div>${level.checkpoints.map(p=>`<i style="left:${p[0]/level.length*100}%"></i>`).join('')}<b id="progress-bike"></b></div><span>${icon('flag')}</span></div><span class="best-label">PERSONAL BEST <b id="best">${best?formatTime(best):'— —'}</b></span></div>
        <div id="toast" class="toast" role="status"></div>
        <div id="intro" class="intro">
          <span class="intro-kicker"><span></span> YOUR NEXT BAD IDEA STARTS HERE.</span>
          <h2>MAKE SOME<br><em>AIRTIME.</em><span class="heading-arrow">↗</span></h2>
          <p>Find your balance. Send the gaps.<br>Stick the landing. Chase three stars.</p>
          <button id="start" class="primary-button">LET’S RIDE ${icon('arrow')}</button><span class="enter-hint">or press <kbd>ENTER</kbd></span>
        </div>
        <div id="riding-hint" class="riding-hint hidden"><kbd>W</kbd> THROTTLE <span>·</span> <kbd>A</kbd><kbd>D</kbd> FIND YOUR BALANCE</div>
        <div class="stage-bottom"><div class="scene-caption"><span class="crosshair">+</span> <span>NO ROAD. NO RULES.<br><b>JUST YOU & GRAVITY.</b></span></div><div class="speed-readout"><span id="speed">00</span><small>KM/H</small><i></i><span class="gear-label">DIRT<br><b>MODE</b></span></div></div>
        <div id="touch-controls" class="touch-controls"><div><button data-control="left" aria-label="Lean back">↶</button><button data-control="right" aria-label="Lean forward">↷</button></div><div><button data-control="brake" aria-label="Brake">↓</button><button data-control="gas" aria-label="Accelerate">↑</button></div></div>
        <div id="modal" class="modal-backdrop hidden"><div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><span id="modal-kicker" class="eyebrow"></span><h2 id="modal-title"></h2><div id="modal-content"></div><button id="modal-primary" class="primary-button"></button><button id="modal-secondary" class="text-button"></button></div></div>
        <div id="loading" class="loading"><span class="brand-symbol"><i></i><i></i><i></i></span><b>WARMING UP THE ENGINE</b><span id="loading-status">Building a little trouble…</span></div>
      </div>
      <div class="game-bottom-bar"><span><span class="green-dot"></span><b id="run-status">ALL SYSTEMS GO</b></span><span id="checkpoint-status">CHECKPOINT 00 / ${String(level.checkpoints.length).padStart(2,'0')}</span><span>FLIPS SHAVE TIME. <b>−0.5s / FLIP</b> ${icon('arrow')}</span></div>
    </section>
    <section class="below-game" aria-label="Controls and star targets">
      <div class="controls-guide"><div class="section-label">THE BASICS <span>↘</span></div><div class="control-item"><span class="key-pair"><kbd>W</kbd><small>↑</small></span><span>THROTTLE<small>Give it some.</small></span></div><div class="control-item"><span class="key-pair"><kbd>S</kbd><small>↓</small></span><span>BRAKE / REVERSE<small>Keep it in check.</small></span></div><div class="control-item"><span class="key-pair double"><kbd>A</kbd><kbd>D</kbd></span><span>LEAN / FLIP<small>Own the airtime.</small></span></div><div class="control-item retry-control"><kbd>R</kbd><span>RETRY<small>Back to checkpoint.</small></span></div></div>
      <div class="star-targets"><div class="section-label">BEAT THE CLOCK <span>↗</span></div>${level.stars.map((t,i)=>`<div class="star-target"><span>${star.repeat(3-i)}</span><b>&lt; ${t}s</b></div>`).join('')}</div>
    </section>
    <footer><span>GOOD RUNS ARE EARNED. GREAT RUNS ARE SENT.</span><span>REVBIKE <b>/</b> 01 — REDROCK RIDGE</span></footer>
  </main>`;

type State='ready'|'playing'|'crashed'|'paused'|'finished';
let state:State='ready',previousState:State='ready';
let sim:Simulation,view:GameRenderer;
let elapsed=0,bonus=0,checkpoint=-1,retries=0,crashElapsed=0,steps=0,toastTimeout=0;
let activeFlips=0,modalPrimary=()=>{},modalSecondary=()=>{};
let checkpointSave:{bike:BikeSnapshot;bonus:number;flips:number}|undefined;
const controls:Controls={gas:false,brake:false,left:false,right:false};
const audio=new BikeAudio();

function formatTime(seconds:number){
  const s=Math.max(0,seconds),min=Math.floor(s/60),whole=Math.floor(s%60),hundredths=Math.floor((s%1)*100);
  return `${String(min).padStart(2,'0')}:${String(whole).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`;
}
function clearControls(){for(const key of Object.keys(controls) as (keyof Controls)[])controls[key]=false;document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('pressed'));}
function toast(text:string){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=window.setTimeout(()=>$('toast').classList.remove('visible'),2400);}
function modal(kicker:string,title:string,content:string,primary:string,primaryFn:()=>void,secondary='BACK TO THE COURSE',secondaryFn=()=>hideModal()){
  $('modal-kicker').textContent=kicker;$('modal-title').textContent=title;$('modal-content').innerHTML=content;
  $('modal-primary').innerHTML=primary+icon('arrow');$('modal-secondary').textContent=secondary;
  modalPrimary=primaryFn;modalSecondary=secondaryFn;$('modal').classList.remove('hidden');$('modal-primary').focus();
}
function hideModal(){$('modal').classList.add('hidden');$('game').focus({preventScroll:true});}
function start(){if(!sim)return;state='playing';hideModal();$('intro').classList.add('hidden');$('riding-hint').classList.remove('hidden');$('timer-state').textContent='MAKE IT COUNT';$('run-status').textContent='RUN IN PROGRESS';$('game').focus({preventScroll:true});}
function restart(full=false){
  if(!sim)return;clearControls();hideModal();
  if(full){elapsed=0;bonus=0;checkpoint=-1;checkpointSave=undefined;retries=0;activeFlips=0;sim.flips=0;sim.resetHazards();view.reset();}
  else retries++;
  const point:Point=checkpoint>=0?[level.checkpoints[checkpoint][0]+1,level.checkpoints[checkpoint][1]+1.1]:level.spawn;
  if(!full&&checkpointSave){sim.restoreCheckpoint(checkpointSave.bike);bonus=checkpointSave.bonus;activeFlips=checkpointSave.flips;sim.flips=activeFlips;}
  else sim.spawn(point);
  state='playing';crashElapsed=0;$('intro').classList.add('hidden');$('riding-hint').classList.remove('hidden');
  $('run-status').textContent='RUN IN PROGRESS';$('timer-state').textContent='MAKE IT COUNT';updateHUD();
  toast(full?'FRESH TRACK. FRESH START.':'BACK IN THE SADDLE');
}
function pause(){
  if(state==='finished'||state==='crashed')return;
  if(state==='paused'){state=previousState;hideModal();return;}
  previousState=state;state='paused';clearControls();
  modal('TAKE A BREATHER','HOLD THAT THOUGHT.', '<p>The dirt will still be here.<br>Your timer is paused.</p>','KEEP RIDING',()=>pause(),'RESTART LEVEL',()=>restart(true));
}
function help(){
  if(!sim)return;
  if(state!=='paused'){previousState=state;state='paused';}clearControls();
  const resume=()=>{state=previousState;hideModal();};
  modal('A QUICK FIELD GUIDE','SEND IT. STICK IT.',`<div class="help-grid"><kbd>W / ↑</kbd><span>Throttle the rear wheel</span><kbd>S / ↓</kbd><span>Brake, then reverse</span><kbd>A / ←</kbd><span>Lean back / backflip</span><kbd>D / →</kbd><span>Lean forward / frontflip</span><kbd>R</kbd><span>Retry from checkpoint</span><kbd>⇧ R</kbd><span>Restart the entire run</span><kbd>P / ESC</kbd><span>Pause the timer</span></div><p class="help-note">Land a full flip on your wheels for <b>−0.5 seconds.</b> Protect your helmet. Avoid TNT, spikes, and saws. Checkpoints save your momentum; retries keep the clock running.</p>`,'GOT IT. LET’S RIDE.',resume,'BACK TO THE COURSE',resume);
}
function finish(){
  if(state!=='playing')return;state='finished';clearControls();
  const time=Math.max(0,elapsed-bonus),stars=level.stars.filter(t=>time<t).length;
  if(best===null||time<best){best=time;try{localStorage.setItem(`revbike-best-${level.name}`,String(time));}catch{}$('best').textContent=formatTime(time);}
  $('run-status').textContent='RUN COMPLETE';$('timer-state').textContent='IN THE BOOKS';
  view.burst(level.finish[0],3,0xd8ef68,65,9);
  modal('REDROCK RIDGE / RUN COMPLETE',stars===3?'ABSOLUTELY SENT.':'DUST SETTLED.',`<div class="result-stars">${[0,1,2].map(i=>`<span class="${i<stars?'earned':''}">${star}</span>`).join('')}</div><div class="result-time">${formatTime(time)}</div><div class="result-stats"><span>FLIP BONUS<b>−${bonus.toFixed(1)}s</b></span><span>CLEAN FLIPS<b>${activeFlips}</b></span><span>RETRIES<b>${retries}</b></span></div><p>${stars===3?'Three stars. One very good bad idea.':`Chase ${stars===2?'three':'more'} stars. Next target: under ${level.stars[Math.max(0,2-stars)]} seconds.`}</p>`,'RUN IT BACK',()=>restart(true),'TAKE IN THE VIEW',()=>hideModal());
}
function updateHUD(){
  const score=Math.max(0,elapsed-bonus),time=formatTime(score),parts=time.split('.');
  $('timer').innerHTML=`${parts[0]}<span>.${parts[1]}</span>`;
  const stars=level.stars.filter(t=>score<t).length;
  $('live-stars').innerHTML=[0,1,2].map(i=>`<span class="${i<stars?'earned':''}">${star}</span>`).join('');
  const next=level.stars.find(t=>score<t);
  if(state==='playing')$('timer-state').textContent=next?`${stars} STAR${stars===1?'':'S'} · ${(next-score).toFixed(1)}s LEFT`:'BRING IT HOME';
  $('checkpoint-status').textContent=`CHECKPOINT ${String(checkpoint+1).padStart(2,'0')} / ${String(level.checkpoints.length).padStart(2,'0')}`;
  const p=sim.bike.frame.translation(),progress=Math.min(100,Math.max(0,p.x/level.length*100));
  $('progress-fill').style.width=`${progress}%`;$('progress-bike').style.left=`${progress}%`;
  $('speed').textContent=String(Math.round(Math.abs(sim.bike.frame.linvel().x)*3.6)).padStart(2,'0');
}

$('start').onclick=start;$('restart').onclick=()=>restart(true);$('pause').onclick=pause;$('help').onclick=help;
$('embed-help').onclick=help;
$('modal-primary').onclick=()=>modalPrimary();$('modal-secondary').onclick=()=>modalSecondary();
$('sound').onclick=()=>{audio.setEnabled(!audio.enabled);$('sound').innerHTML=icon(audio.enabled?'sound':'mute');$('sound').setAttribute('aria-label',audio.enabled?'Mute sound':'Enable sound');$('sound').title=audio.enabled?'Mute sound':'Enable sound';};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.game-shell')!.requestFullscreen();}catch{toast('FULLSCREEN IS UNAVAILABLE IN THIS BROWSER');}};
const keymap:Record<string,keyof Controls>={w:'gas',arrowup:'gas',s:'brake',arrowdown:'brake',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if(keymap[key]||['r','p','escape','enter',' '].includes(key))e.preventDefault();
  if(e.repeat && ['r','p','escape','enter'].includes(key))return;
  if(key==='r'){restart(e.shiftKey);return;}
  if(key==='p'||key==='escape'){pause();return;}
  if(key==='enter'||key===' '){if(state==='ready')start();else if(state==='crashed')restart();else if(state==='paused')modalPrimary();else if(state==='finished')restart(true);return;}
  if(keymap[key]){if(state==='ready')start();if(state==='playing')controls[keymap[key]]=true;}
});
window.addEventListener('keyup',e=>{const key=e.key.toLowerCase();if(keymap[key])controls[keymap[key]]=false;});
window.addEventListener('blur',()=>{clearControls();if(state==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-control]')){
  const control=button.dataset.control as keyof Controls;
  button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(state==='ready')start();if(state==='playing'){controls[control]=true;button.classList.add('pressed');}};
  const release=()=>{controls[control]=false;button.classList.remove('pressed');};
  button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
}
// Keep keyboard focus inside dialogs; R remains available for instant retries.
document.addEventListener('keydown',e=>{
  if(e.key==='Tab'&&!$('modal').classList.contains('hidden')){
    const first=$('modal-primary'),last=$('modal-secondary');
    if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});

async function boot(){
  try{
    await RAPIER.init();sim=new Simulation(level);view=new GameRenderer($<HTMLCanvasElement>('game'),level);await view.modelReady;
    sim.onFlip=(count,direction)=>{bonus+=count*0.5;activeFlips+=count;toast(`${count>1?`${count}× `:''}${direction} LANDED / −${(count*0.5).toFixed(1)}s`);};
    sim.onExplosion=index=>{const h=level.hazards[index];view.burst(h.x,h.y,0xfa693e,55,10);audio.explosion();};
    sim.onCrash=()=>{
      if(state!=='playing')return;state='crashed';crashElapsed=0;clearControls();audio.explosion();
      const p=sim.bike.frame.translation();view.burst(p.x,p.y+0.6);$('run-status').textContent='RIDER DOWN';$('timer-state').textContent='PRESS R TO RETRY';
      toast('RIDER DOWN / PRESS R TO RETRY');
    };
    // Settle the suspension before presenting the opening scene.
    for(let i=0;i<100;i++)sim.step(controls);
    $('loading').classList.add('hidden');updateHUD();
    let last=performance.now(),accumulator=0,hudClock=0;
    const loop=(now:number)=>{
      const dt=Math.min((now-last)/1000,0.05);last=now;
      if(state==='playing'||state==='crashed'){
        accumulator+=dt;
        while(accumulator>=STEP){
          const running=state==='playing';sim.step(controls);steps++;elapsed+=STEP;
          if(running){
            const p=sim.bike.frame.translation();
            level.checkpoints.forEach(([x,y],i)=>{if(i>checkpoint && p.x>x && p.x<x+4 && p.y>y-0.5 && p.y<y+5 && !sim.crashed){checkpoint=i;checkpointSave={bike:sim.captureCheckpoint(),bonus,flips:activeFlips};view.checkpoint(i);toast(`CHECKPOINT ${String(i+1).padStart(2,'0')} / LOCKED IN`);}});
            if(p.x>=level.finish[0] && p.y>level.finish[1]-1 && !sim.crashed)finish();
          }
          accumulator-=STEP;
          if((state as State)==='finished')break;
        }
      }else accumulator=0;
      if(state==='crashed'){
        crashElapsed+=dt;
        if(crashElapsed>1.1&&$('modal').classList.contains('hidden'))
          modal('GRAVITY WINS THIS ROUND.','SHAKE OFF THE DUST.',`<p>${checkpoint>=0?`Checkpoint ${String(checkpoint+1).padStart(2,'0')} has your back.`:'Every great run starts with a little dirt.'}<br>Hit <kbd>R</kbd> and give it another shot.</p>`,'BACK ON THE BIKE',()=>restart(),'RESTART LEVEL',()=>restart(true));
      }
      hudClock+=dt;if(hudClock>0.05){updateHUD();hudClock=0;}
      audio.update(sim.bike.wheels[0].angvel(),controls.gas,state==='playing');
      view.render(sim,dt,state==='playing'||state==='crashed');requestAnimationFrame(loop);
    };requestAnimationFrame(loop);
    // Read-only diagnostics make fixed-step physics and browser failures inspectable.
    Object.defineProperty(window,'revbike',{value:{get state(){return state;},get diagnostics(){return {position:{...sim.bike.frame.translation()},velocity:{...sim.bike.frame.linvel()},angle:sim.bike.frame.rotation(),grounded:sim.grounded,crashed:sim.crashed,steps,elapsed,bonus,checkpoint,flips:activeFlips,rigidBodies:sim.world.bodies.len(),renderer:view.renderer.info.render};}},writable:false});
  }catch(error){console.error(error);$('loading-status').textContent='The engine couldn’t start. Reload to try again. WebGL is required.';$('loading-status').classList.add('load-error');}
}
void boot();
