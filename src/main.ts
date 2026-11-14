import './style.css';
import { RAPIER, Simulation, STEP, type Controls } from './physics';
import { GameRenderer } from './render';
import { level1, testLevel } from './track';
import {trialsCourses,trialsLevel,readTrialRecord,trialsMedal,trialStars,betterTrial,type TrialRecord} from './trials';
import {bikes,DEFAULT_APPEARANCE,GARAGE_KEY,normalizeAppearance,type Appearance} from './garage';
import {readBest} from './progress';
import {campaign,campaignLevel,environments,starsFor,themeFor} from './campaign';
import { BikeAudio } from './audio';
import { DEFAULT_SETTINGS, SETTINGS_KEY, normalizeSettings, FrameLimiter, type GameSettings } from './settings';

const icons:Record<string,string>={
  restart:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 5 11 7-11 7Z"/>',
  sound:'<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6m0-6-6 6"/>',
  fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 3v.01"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  flag:'<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',
};
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const star='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9Z"/></svg>';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const params=new URLSearchParams(location.search);
let debugEnabled=['1','log'].includes(params.get('debug')??'');
const logRig=params.get('debug')==='log';
if(params.get('embed')==='1')document.documentElement.classList.add('embed-mode');
const mode=params.has('course')||params.get('mode')==='stunt'?'stunt':'trials';
const catalog=mode==='trials'?trialsCourses:campaign;
const level=params.get('course')==='test'?testLevel:params.get('course')==='classic'?level1:mode==='trials'?trialsLevel(Number(params.get('level')??1)):campaignLevel(Number(params.get('level')??1));
const isTrials=level.mode==='trials';
document.documentElement.classList.toggle('trials-mode',isTrials);
let completed=trialsCourses.filter(l=>readTrialRecord(l.id!)!==null).length;
let appearance:Appearance={...DEFAULT_APPEARANCE};try{appearance=normalizeAppearance(JSON.parse(localStorage.getItem(GARAGE_KEY)??'null'),completed);}catch{}
let trialRecord=isTrials?readTrialRecord(level.id!):null;

const theme=themeFor(level);
document.documentElement.dataset.environment=theme.id;
const logo='<span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span>REVBIKE<span class="brand-dot" aria-hidden="true">®</span>';
let settings:GameSettings={...DEFAULT_SETTINGS};
try{settings=normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)??'null'));}catch{}
const frameLimiter=new FrameLimiter(settings.frameRate);
let best=isTrials?trialRecord?.time??null:readBest(level);

$('app').innerHTML=`
  <main>
    <div class="course-heading"><a class="wordmark" href="./" aria-label="REVBIKE home">${logo}</a><div class="eyebrow">A LITTLE THROTTLE. A LOT OF NERVE.</div></div>
    <section class="game-shell" aria-label="REVBIKE dirtbike game">
      <span class="version-tag" title="REVBIKE v${__APP_VERSION__} · ${__APP_REVISION__}" aria-label="Game version ${__APP_VERSION__}">v${__APP_VERSION__}</span>
      <div class="game-toolbar">
        <div class="level-info"><span class="level-number">${String(level.id??1).padStart(2,'0')}</span><div><div class="level-kicker">${theme.name.toUpperCase()} <span class="difficulty">${level.id?`LEVEL ${level.id}`:'TEST'}</span></div><h1>${level.name}</h1></div></div>
        <div class="timer-wrap"><div class="fault-wrap"><span>FAULTS</span><b id="faults">00</b></div><div class="timer-label">${isTrials?'ELAPSED TIME':'RUN TIME'} <span id="timer-state">READY WHEN YOU ARE</span></div><div class="timer-row"><span id="timer" class="timer">00:00<span>.00</span></span><div id="live-stars" class="live-stars">${star.repeat(3)}</div></div></div>
        <div class="toolbar-actions"><button id="restart" class="icon-button" aria-label="Restart track (T / Backspace)" title="Restart track · T / Backspace">${icon('restart')}</button><button id="pause" class="icon-button" aria-label="Pause (P)" title="Pause · P">${icon('pause')}</button><button id="menu" class="icon-button" aria-label="Open settings and guide" title="Settings & guide">${icon('settings')}</button><button id="toolbar-levels" class="icon-button" aria-label="Level select" title="Level select">${icon('flag')}</button><span class="toolbar-divider"></span><button id="sound" class="icon-button" aria-label="Enable sound" title="Enable sound">${icon('mute')}</button><button id="fullscreen" class="icon-button" aria-label="Enter fullscreen" title="Fullscreen">${icon('fullscreen')}</button></div>
      </div>
      <div id="stage" class="stage">
        <canvas id="game" tabindex="0" aria-label="Dirtbike course. Use W or Up to accelerate, S or Down to brake, A and D to lean. Space bunny-hops. R retries the checkpoint. T or Backspace restarts the track."></canvas>
        <div class="stage-vignette"></div>
        <div class="stage-top"><span class="location-label"><span class="live-dot"></span> ${theme.name.toUpperCase()} / ${String(level.id??1).padStart(2,'0')}</span><div class="progress-wrap"><span>START</span><div class="progress-track"><div id="progress-fill"></div>${level.checkpoints.map(p=>`<i style="left:${p[0]/level.length*100}%"></i>`).join('')}<b id="progress-bike"></b></div><span>${icon('flag')}</span></div><span class="best-label">PERSONAL BEST <b id="best">${best===null?'— —':`${isTrials?`${trialRecord!.faults}F · `:''}${formatTime(best)}`}</b></span></div>
        <div id="toast" class="toast" role="status"></div>
        <aside id="rig-debug" class="rig-debug hidden" aria-label="Suspension and angular velocity diagnostics">
          <div class="rig-debug-heading">REVBIKE / RIG DEBUG <span>F3 TO HIDE</span></div>
          <div class="rig-debug-state" id="debug-contact"></div>
          <div class="rig-debug-row"><b>REAR COMPRESSION</b><span id="debug-rear"></span></div><div class="rig-debug-bar"><i id="debug-rear-bar"></i></div>
          <div class="rig-debug-row"><b>FRONT COMPRESSION</b><span id="debug-front"></span></div><div class="rig-debug-bar"><i id="debug-front-bar"></i></div>
          <div class="rig-debug-row"><b>AXLE DROP R / F</b><span id="debug-drop"></span></div>
          <div class="rig-debug-row"><b>TIRE GAP R / F</b><span id="debug-clearance"></span></div>
          <div class="rig-debug-row"><b>ANGULAR VELOCITY</b><span id="debug-angular"></span></div>
          <small>Compression measured from full droop. Distances in world meters. P pauses the readout.</small>
        </aside>
        <div id="intro" class="intro">
          <span class="intro-kicker"><span></span> YOUR NEXT BAD IDEA STARTS HERE.</span>
          <h2 class="intro-logo" aria-label="REVBIKE"><span class="wordmark">${logo}</span></h2>
          <p>${isTrials?'Balance. Feather the gas. Control the climb.<br>Finish with zero faults.':'Find your balance. Send the gaps.<br>Stick the landing. Chase three stars.'}</p>
          <div class="mode-switch" aria-label="Game modes"><a class="${isTrials?'selected':''}" href="./?mode=trials">TRIALS DIRTBIKE</a><a class="${!isTrials?'selected':''}" href="./?mode=stunt">STUNT</a></div><div class="home-menu"><button id="start" class="primary-button">${isTrials?'RIDE TRIALS':'LET’S RIDE'} ${icon('arrow')}</button><button id="home-levels" class="menu-button">${icon('flag')} LEVEL SELECT</button><button id="home-garage" class="menu-button">${icon('settings')} GARAGE & RIDER</button><button id="home-settings" class="menu-button">${icon('settings')} SETTINGS</button><button id="home-how" class="menu-button">${icon('help')} HOW TO RIDE</button></div><span class="enter-hint">PRESS ENTER TO RIDE</span>
        </div>
        <div id="riding-hint" class="riding-hint hidden"><kbd>W</kbd> GAS <span>·</span> <kbd>S</kbd> BRAKE <span>·</span> <kbd>A</kbd><kbd>D</kbd> WEIGHT <span>·</span> <kbd>A</kbd>→<kbd>D</kbd>+<kbd>W</kbd> HOP</div>
        <div class="stage-bottom"><div class="scene-caption"><span class="crosshair">+</span> <span>NO ROAD. NO RULES.<br><b>JUST YOU & GRAVITY.</b></span></div><div class="speed-readout"><span id="speed">00</span><small>KM/H</small><i></i><span class="gear-label">DIRT<br><b>MODE</b></span></div></div>
        <div id="touch-controls" class="touch-controls"><div><button data-control="left" aria-label="Lean back">↶</button><button data-control="right" aria-label="Lean forward">↷</button></div><button class="touch-hop" data-control="hop" aria-label="Bunny hop">HOP</button><div><button data-control="brake" aria-label="Brake">↓</button><button data-control="gas" aria-label="Accelerate">↑</button></div></div>
        <div id="modal" class="modal-backdrop hidden"><div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><span id="modal-kicker" class="eyebrow"></span><h2 id="modal-title"></h2><div id="modal-content"></div><button id="modal-primary" class="primary-button"></button><button id="modal-secondary" class="text-button"></button></div></div>
        <div id="loading" class="loading"><span class="brand-symbol"><i></i><i></i><i></i></span><b>WARMING UP THE ENGINE</b><span id="loading-status">Building a little trouble…</span></div>
      </div>
      <div class="game-bottom-bar"><span><span class="green-dot"></span><b id="run-status">ALL SYSTEMS GO</b></span><span id="checkpoint-status">CHECKPOINT 00 / ${String(level.checkpoints.length).padStart(2,'0')}</span><span>${isTrials?'CONTROL OVER SPEED. <b>ZERO FAULTS.</b>':'FLIPS SHAVE TIME. <b>−0.5s / FLIP</b>'} ${icon('arrow')}</span></div>
      <div id="garage-overlay" class="garage-overlay hidden"><div class="garage-card" role="dialog" aria-modal="true" aria-labelledby="garage-title"><div class="level-select-heading"><div><span class="eyebrow" id="garage-progress"></span><h2 id="garage-title">MAKE IT YOUR RIDE.</h2></div><button id="garage-back" class="menu-back">← BACK</button></div><div id="bike-choices" class="bike-choices"></div><div class="rider-customization"><label>BIKE COLOR<input id="paint-color" type="color"></label><label>RIDER JERSEY<input id="jersey-color" type="color"></label><label>HELMET<input id="helmet-color" type="color"></label><label>RIDER NUMBER<input id="rider-number" type="number" min="1" max="99"></label></div><p class="garage-note" id="garage-saved">Preferences save automatically. Complete Trials tracks to unlock new bikes.</p></div></div>
      <div id="level-overlay" class="level-overlay hidden"><div class="level-select-card" role="dialog" aria-modal="true" aria-labelledby="level-select-title"><div class="level-select-heading"><div><span class="eyebrow">${catalog.length} ${isTrials?'TRIALS TRACKS':'STUNT COURSES'} / ALL AVAILABLE</span><h2 id="level-select-title">PICK YOUR NEXT BAD IDEA.</h2></div><button id="levels-back" class="menu-back">← BACK</button></div><div id="environment-tabs" class="environment-tabs" role="tablist" aria-label="Level environments"></div><div id="level-grid" class="level-grid" role="tabpanel" aria-label="Courses"></div><div class="level-select-foot"><span>${isTrials?'FAULTS FIRST · 2 CHECKPOINTS · R RETRY · T RESTART':'2 CHECKPOINTS · GOLD / SILVER / BRONZE'}</span><span id="campaign-progress"></span></div></div></div>
      <div id="setpiece-hint" class="setpiece-hint hidden"><b id="setpiece-name"></b><span id="setpiece-instruction"></span></div>
      <div id="menu-overlay" class="menu-overlay hidden"><div class="menu-card" role="dialog" aria-modal="true" aria-label="Ride guide and settings"><div class="menu-card-heading"><span class="eyebrow">REVBIKE / PIT STOP</span><button id="menu-back" class="menu-back">← BACK</button></div><div class="bottom-tabs-row"><div class="bottom-tabs" role="tablist" aria-label="Game guide and preferences"><button id="tab-how" role="tab" aria-selected="true" aria-controls="panel-how">${icon('help')} HOW TO RIDE</button><button id="tab-settings" role="tab" aria-selected="false" aria-controls="panel-settings" tabindex="-1">${icon('settings')} GAMEPLAY SETTINGS</button></div><button id="resume-panel" class="resume-panel hidden">RESUME RIDE ${icon('play')}</button></div>
      <section id="panel-how" class="bottom-panel" role="tabpanel" aria-labelledby="tab-how" tabindex="0">
        <div class="controls-guide"><div class="control-item"><span class="key-pair"><kbd>W</kbd><small>↑</small></span><span>THROTTLE<small>${isTrials?'Tap for control.':'Give it some.'}</small></span></div><div class="control-item"><span class="key-pair"><kbd>S</kbd><small>↓</small></span><span>${isTrials?'BRAKE / HOLD':'BRAKE / REVERSE'}<small>Keep it in check.</small></span></div><div class="control-item"><span class="key-pair double"><kbd>A</kbd><kbd>D</kbd></span><span>${isTrials?'WEIGHT / PITCH':'LEAN / FLIP'}<small>${isTrials?'Balance, then align.':'Own the airtime.'}</small></span></div><div class="control-item"><kbd>R</kbd><span>CHECKPOINT RETRY<small>One fault. Keep practicing.</small></span></div><div class="control-item"><kbd>SPACE</kbd><span>BUNNY HOP<small>Ground contact required.</small></span></div><div class="control-item"><kbd>T</kbd><span>TRACK RESTART<small>Or Backspace. Clean slate.</small></span></div><div class="control-item"><kbd>P</kbd><span>PAUSE<small>Take a breather.</small></span></div></div>
        <div class="guide-note"><span>${isTrials?'Feather W: full gas lifts the front and can loop you out, so lean forward with D on climbs. A / D move your weight on the ground and set the landing angle in the air; land rear wheel first. Hold A, then snap to D with gas to bunny-hop (Space also hops). S stops you dead. Shift + W is precision gas. Every crash or R retry is a fault; T / Backspace restarts. Zero faults earns Gold; zero under par earns Platinum.':'Land clean flips for −0.5s each. Space bunny-hops, R retries the checkpoint and T / Backspace restarts the track.'}</span><div class="star-targets">${level.stars.map((t,i)=>`<div class="star-target"><span>${star.repeat(3-i)}</span><b>${isTrials?['0F','≤3F','≤8F'][i]:`&lt; ${t}s`}</b></div>`).join('')}</div></div>
      </section>
      <section id="panel-settings" class="bottom-panel hidden" role="tabpanel" aria-labelledby="tab-settings" tabindex="0">
        <div class="settings-grid">
          <label class="setting-field" for="setting-framerate"><span>FRAME RATE</span><select id="setting-framerate"><option value="0">Auto / display refresh</option><option value="30">Up to 30 FPS</option><option value="60">Up to 60 FPS</option><option value="120">Up to 120 FPS</option><option value="144">Up to 144 FPS</option></select><small>Change smoothness without changing handling.</small></label>
          <label class="setting-field" for="setting-quality"><span>VISUAL QUALITY</span><select id="setting-quality"><option value="low">Low — lighter graphics</option><option value="medium">Medium — balanced</option><option value="high">High — full detail</option></select><small>Adjust resolution and directional shadows.</small></label>
          <label class="setting-field" for="setting-blood"><span>BLOOD AMOUNT</span><select id="setting-blood"><option value="off">Off</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><small>Stylized red particles on rider crashes.</small></label>
          <label class="setting-field shake-field" for="setting-shake"><span>SCREEN SHAKE</span><span class="setting-toggle"><input id="setting-shake" type="checkbox"><span>Crash & explosion shake</span></span><small>Turn off for a steadier camera.</small></label>
        </div><div class="settings-footnote"><span id="settings-saved" role="status">Preferences save automatically on this browser.</span><div class="settings-utilities"><button id="open-garage-settings" class="text-button">GARAGE & RIDER</button><button id="toggle-rig-debug" class="text-button" aria-pressed="false">SHOW RIG DEBUG</button><button id="reset-settings" class="text-button">RESTORE DEFAULTS</button></div></div>
      </section>
      </div></div>
    </section>
    <footer><span>GOOD RUNS ARE EARNED. GREAT RUNS ARE SENT.</span><span>REVBIKE <b>/</b> 01 — REDROCK RIDGE</span></footer>
  </main>`;

type State='ready'|'playing'|'crashed'|'paused'|'finished';
let state:State='ready',previousState:State='ready';
let sim:Simulation,view:GameRenderer;
let faults=0;
let elapsed=0,bonus=0,checkpoint=-1,crashElapsed=0,steps=0,toastTimeout=0,renderFrames=0;
let activeFlips=0,modalPrimary=()=>{},modalSecondary=()=>{};
let panelPaused=false;
let checkpointSnapshot:ReturnType<Simulation['captureCheckpoint']>|undefined;
let checkpointBonus=0,checkpointFlips=0;
function flashFault(){const el=$('faults').parentElement!;el.classList.remove('fault-hit');void el.offsetWidth;el.classList.add('fault-hit');}
function retryCheckpoint(){
 if(!sim)return;const manual=!sim.crashed;if(manual){faults++;if(isTrials)flashFault();}
 clearControls();$('level-overlay').classList.add('hidden');$('garage-overlay').classList.add('hidden');
 if(checkpointSnapshot){sim.restoreCheckpoint(checkpointSnapshot);bonus=checkpointBonus;activeFlips=checkpointFlips;}
 else{sim.restartRound();bonus=0;activeFlips=0;}
 view.reset(sim.bike.frame.translation());for(let i=0;i<=checkpoint;i++)view.checkpoint(i);start();updateHUD();toast(manual&&isTrials?'+1 FAULT / CHECKPOINT RETRY':'CHECKPOINT RETRY / CLOCK KEEPS RUNNING');
}

const controls:Controls={gas:false,brake:false,left:false,right:false,precision:false,hop:false};
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
function start(){if(!sim)return;$('garage-overlay').classList.add('hidden');levelsPaused=false;$('level-overlay').classList.add('hidden');closeMenu(false);state='playing';panelPaused=false;$('resume-panel').classList.add('hidden');hideModal();$('intro').classList.add('hidden');$('riding-hint').classList.remove('hidden');$('timer-state').textContent='MAKE IT COUNT';$('run-status').textContent='RUN IN PROGRESS';$('game').focus({preventScroll:true});}
function restart(){
  if(!sim)return;$('garage-overlay').classList.add('hidden');levelsPaused=false;$('level-overlay').classList.add('hidden');closeMenu(false);clearControls();hideModal();
  faults=0;elapsed=0;bonus=0;checkpoint=-1;checkpointSnapshot=undefined;activeFlips=0;steps=0;
  panelPaused=false;$('resume-panel').classList.add('hidden');sim.restartRound();view.reset();
  state='playing';crashElapsed=0;$('intro').classList.add('hidden');$('riding-hint').classList.remove('hidden');
  $('run-status').textContent='RUN IN PROGRESS';$('timer-state').textContent='MAKE IT COUNT';updateHUD();
  toast('FRESH TRACK. ZERO FAULTS.');
}
function pause(){
  if(!$('garage-overlay').classList.contains('hidden')){closeGarage();return;}
  if(!$('level-overlay').classList.contains('hidden')){closeLevels();return;}
  if(!$('menu-overlay').classList.contains('hidden')){closeMenu();return;}
  if(panelPaused){resumePanel();return;}
  if(state==='finished'||state==='crashed')return;
  if(state==='paused'){state=previousState;hideModal();return;}
  previousState=state;state='paused';clearControls();
  modal('TAKE A BREATHER','HOLD THAT THOUGHT.', '<p>The dirt will still be here.<br>Your timer is paused.</p>','KEEP RIDING',()=>pause(),'RESTART ROUND',restart);
}
function resumePanel(){
  $('menu-overlay').classList.add('hidden');
  if(!panelPaused)return;
  panelPaused=false;state=previousState;$('resume-panel').classList.add('hidden');$('game').focus({preventScroll:true});
  $('run-status').textContent='RUN IN PROGRESS';
}
function closeMenu(resume=true){
  $('menu-overlay').classList.add('hidden');
  if(resume&&panelPaused)resumePanel();
  if(state==='ready')$('intro').classList.remove('hidden');
  if(resume)(state==='ready'?$('start'):$('game')).focus({preventScroll:true});
}
function selectMenuTab(selected:'how'|'settings'){
  $('menu-overlay').classList.remove('hidden');
  $('intro').classList.add('hidden');
  for(const name of ['how','settings']){
    const active=name===selected,tab=$(`tab-${name}`);
    tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$(`panel-${name}`).classList.toggle('hidden',!active);
  }
  if(state==='playing'){
    previousState=state;state='paused';panelPaused=true;clearControls();
    $('resume-panel').classList.remove('hidden');$('run-status').textContent='RIDE PAUSED';
  }
}
function syncSettingsControls(){
  $<HTMLSelectElement>('setting-framerate').value=String(settings.frameRate);
  $<HTMLSelectElement>('setting-quality').value=settings.quality;
  $<HTMLSelectElement>('setting-blood').value=settings.blood;
  $<HTMLInputElement>('setting-shake').checked=settings.screenShake;
}
function saveSettings(){
  frameLimiter.setFrameRate(settings.frameRate);view?.applySettings(settings);syncSettingsControls();
  try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));$('settings-saved').textContent='Preferences saved on this browser.';}
  catch{$('settings-saved').textContent='Preferences applied for this visit.';}
}
function syncRigDebug(){
  $('rig-debug').classList.toggle('hidden',!debugEnabled);
  $('toggle-rig-debug').textContent=debugEnabled?'HIDE RIG DEBUG':'SHOW RIG DEBUG';
  $('toggle-rig-debug').setAttribute('aria-pressed',String(debugEnabled));
  if(sim)updateRigDebug();
}
function updateRigDebug(){
  if(!debugEnabled)return;
  const [rear,front]=sim.getSuspensionTelemetry(),omega=sim.bike.frame.angvel();
  $('debug-contact').textContent=`${sim.crashed?'CRASHED':sim.grounded?'WHEEL CONTACT':'AIRBORNE'} / ${(omega*180/Math.PI).toFixed(1)}°/s${isTrials?` · RIDER ${sim.riderShift.toFixed(2)}m · GAS ${Math.round(sim.throttle*100)}%`:''}`;
  for(const data of [rear,front]){
    $(`debug-${data.wheel}`).textContent=`${data.compression.toFixed(3)} / ${data.travel.toFixed(2)} m`;
    $(`debug-${data.wheel}-bar`).style.width=`${data.compressionRatio*100}%`;
    $(`debug-${data.wheel}-bar`).classList.toggle('at-stop',data.compressionRatio>0.95);
  }
  $('debug-drop').textContent=`${rear.axleDrop.toFixed(3)} / ${front.axleDrop.toFixed(3)} m`;
  $('debug-clearance').textContent=`${rear.tireClearance.toFixed(3)} / ${front.tireClearance.toFixed(3)} m`;
  $('debug-angular').textContent=`${omega.toFixed(3)} rad/s`;
}
function levelUrl(id:number){const query=new URLSearchParams(location.search);query.set('mode',mode);query.delete('course');query.set('level',String(id));return `./?${query}`;}
let selectedEnvironment=theme.id,levelsPaused=false;
function renderLevelGrid(){
  $('environment-tabs').innerHTML=environments.map(e=>{const courses=catalog.filter(l=>l.environment===e.id),range=`${String(courses[0].id).padStart(2,'0')}–${String(courses.at(-1)!.id).padStart(2,'0')}`;return `<button role="tab" id="env-${e.id}" aria-selected="${selectedEnvironment===e.id}" aria-controls="level-grid" tabindex="${selectedEnvironment===e.id?0:-1}" data-environment="${e.id}"><span>${range}</span>${e.name}</button>`;}).join('');
  let totalStars=0,completed=0;
  $('level-grid').innerHTML=catalog.filter(l=>l.environment===selectedEnvironment).map(l=>{
    const record=isTrials?readTrialRecord(l.id!):null;const saved=isTrials?record?.time??null:readBest(l);
    const earned=saved===null?0:isTrials?trialStars(record!):starsFor(l,saved);totalStars+=earned;if(saved!==null)completed++;
    return `<a class="level-tile ${l.id===level.id?'current':''}" href="${levelUrl(l.id!)}" aria-label="Level ${l.id}: ${l.name}, ${saved===null?'not played':`${earned} stars, ${record?`${record.faults} faults, `:''}best ${formatTime(saved)}`}"><div class="level-tile-top"><span>${String(l.id).padStart(2,'0')}</span><small>${l.id===level.id?'CURRENT':'UNLOCKED'}</small></div><h3>${l.name}</h3><p>${l.setPieces!.map(s=>s.name).join(' / ')}</p><div class="level-tile-stars">${[0,1,2].map(i=>`<span class="${i<earned?'earned':''}">${star}</span>`).join('')}</div><div class="level-tile-best"><span>BEST</span><b>${saved===null?'— —':`${record?`${record.faults}F · `:''}${formatTime(saved)}`}</b></div><div class="level-tile-targets">${['GOLD','SILVER','BRONZE'].map((label,i)=>`<span>${label}<b>${isTrials?['0 FAULTS','≤ 3 FAULTS','≤ 8 FAULTS'][i]:`&lt; ${l.stars[i]}s`}</b></span>`).join('')}${isTrials?`<small class="platinum-target">PLATINUM · 0F / ≤ ${l.targetSeconds}s</small>`:''}</div></a>`;
  }).join('');
  $('campaign-progress').textContent=`${completed} / ${isTrials?6:5} COMPLETE · ${totalStars} / ${isTrials?18:15} STARS`;
  for(const tab of $('environment-tabs').querySelectorAll<HTMLButtonElement>('button')){
    tab.onclick=()=>{selectedEnvironment=tab.dataset.environment as typeof selectedEnvironment;renderLevelGrid();$(`env-${selectedEnvironment}`).focus();};
    tab.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();let index=environments.findIndex(env=>env.id===selectedEnvironment);index=e.key==='Home'?0:e.key==='End'?4:(index+(e.key==='ArrowRight'?1:4))%5;selectedEnvironment=environments[index].id;renderLevelGrid();$(`env-${selectedEnvironment}`).focus();};
  }
}
function openLevels(){
  if(state==='playing'){previousState=state;state='paused';levelsPaused=true;clearControls();}
  hideModal();$('intro').classList.add('hidden');$('menu-overlay').classList.add('hidden');renderLevelGrid();$('level-overlay').classList.remove('hidden');$('levels-back').focus();
}
function closeLevels(){
  $('level-overlay').classList.add('hidden');if(levelsPaused){levelsPaused=false;state=previousState;}
  if(state==='ready')$('intro').classList.remove('hidden');
  (state==='ready'?$('home-levels'):$('game')).focus({preventScroll:true});
}

let garageWasPlaying=false;
function renderGarage(){
 completed=trialsCourses.filter(l=>readTrialRecord(l.id!)!==null).length;
 $('garage-progress').textContent=`${completed} / 30 TRIALS TRACKS COMPLETE`;
 $('bike-choices').innerHTML=bikes.map(b=>{const unlocked=completed>=b.required;return `<button class="bike-choice ${appearance.bike===b.id?'equipped':''}" data-bike="${b.id}" ${unlocked?'':'disabled'}><span>${b.tag}</span><b>${b.name}</b><small>${b.description}</small><strong>${!unlocked?`COMPLETE ${b.required} TRIALS TRACK${b.required===1?'':'S'}`:appearance.bike===b.id?'EQUIPPED':'EQUIP BIKE'}</strong></button>`;}).join('');
 for(const button of $('bike-choices').querySelectorAll<HTMLButtonElement>('button'))button.onclick=()=>{appearance=normalizeAppearance({...appearance,bike:button.dataset.bike},completed);saveGarage();renderGarage();};
 for(const [id,key]of [['paint-color','paint'],['jersey-color','jersey'],['helmet-color','helmet'],['rider-number','number']] as const){const input=$<HTMLInputElement>(id);input.value=String(appearance[key]);input.oninput=()=>{appearance=normalizeAppearance({...appearance,[key]:key==='number'?Number(input.value):input.value},completed);saveGarage();};}
}
function saveGarage(){
 try{localStorage.setItem(GARAGE_KEY,JSON.stringify(appearance));$('garage-saved').textContent='Bike and rider saved on this browser.';}catch{$('garage-saved').textContent='Bike and rider applied for this visit.';}
 view?.applyAppearance(appearance);
 if(sim?.isTrials){const setup=bikes.find(b=>b.id===appearance.bike)!;sim.tuning.rearTorque=setup.torque;sim.tuning.wheelFriction=setup.grip;sim.tuning.maxWheelSpeed=setup.speed;sim.bike.wheels.forEach(w=>w.collider(0).setFriction(setup.grip));}
}
function openGarage(){garageWasPlaying=state==='playing'||state==='paused'&&panelPaused&&previousState==='playing';if(panelPaused){panelPaused=false;$('resume-panel').classList.add('hidden');}if(garageWasPlaying){state='paused';clearControls();}hideModal();$('intro').classList.add('hidden');$('garage-overlay').classList.remove('hidden');renderGarage();$('garage-back').focus();}
function closeGarage(){$('garage-overlay').classList.add('hidden');if(garageWasPlaying){state='playing';garageWasPlaying=false;}if(state==='ready')$('intro').classList.remove('hidden');(state==='ready'?$('home-garage'):$('game')).focus({preventScroll:true});}

function finish(){
 if(state!=='playing')return;state='finished';clearControls();
 const time=Math.max(0,elapsed-(isTrials?0:bonus)),record={faults,time};
 const stars=isTrials?trialStars(record):starsFor(level,time),medal=isTrials?trialsMedal(record,level.targetSeconds!):stars===3?'GOLD':stars===2?'SILVER':stars===1?'BRONZE':'FINISHED';
 let unlock='';
 if(isTrials){
  if(betterTrial(record,trialRecord)){trialRecord=record;best=time;try{localStorage.setItem(`revbike-trials-${level.id}`,JSON.stringify(record));}catch{}}
  const oldCompleted=completed;completed=trialsCourses.filter(l=>readTrialRecord(l.id!)!==null).length;
  unlock=bikes.filter(b=>oldCompleted<b.required&&completed>=b.required).map(b=>`${b.name} unlocked!`).join(' ');
 }else if(best===null||time<best){best=time;try{localStorage.setItem(`revbike-best-${level.name}`,String(time));}catch{}}
 $('best').textContent=best===null?'— —':`${isTrials?`${trialRecord!.faults}F · `:''}${formatTime(best)}`;
 $('run-status').textContent='TRACK COMPLETE';$('timer-state').textContent=medal;view.burst(level.finish[0],3,0xd8ef68,45,7);
 const result=isTrials?`<div class="result-faults">${faults}<span>FAULT${faults===1?'':'S'}</span></div><div class="result-stars">${[0,1,2].map(i=>`<span class="${i<stars?'earned':''}">${star}</span>`).join('')}</div><div class="result-time secondary-time">${formatTime(time)}</div><p>${unlock|| (faults===0?'Clean riding. Every section under control.':'Faults first. Take your time and chase a cleaner ride.')}</p>`:`<div class="result-stars">${[0,1,2].map(i=>`<span class="${i<stars?'earned':''}">${star}</span>`).join('')}</div><div class="result-time">${formatTime(time)}</div><p>Flip bonus −${bonus.toFixed(1)}s.</p>`;
 const next=level.id&&level.id<catalog.length;
 modal(`${level.name.toUpperCase()} / ${medal}`,isTrials?'SECTION COMPLETE.':'ABSOLUTELY SENT.',result,next?'NEXT TRACK':'RIDE AGAIN',next?()=>location.assign(levelUrl(level.id!+1)):restart,'TRACK SELECT',openLevels);
}

function updateHUD(){
  updateRigDebug();
  const score=Math.max(0,elapsed-(isTrials?0:bonus)),time=formatTime(score),parts=time.split('.');
  $('timer').innerHTML=`${parts[0]}<span>.${parts[1]}</span>`;
  const stars=isTrials?trialStars({faults,time:score}):level.stars.filter(t=>score<t).length;
  $('faults').textContent=String(faults).padStart(2,'0');$('game').dataset.hops=String(sim.hopCount);
  $('live-stars').innerHTML=[0,1,2].map(i=>`<span class="${i<stars?'earned':''}">${star}</span>`).join('');
  const next=level.stars.find(t=>score<t);
  if(state==='playing')$('timer-state').textContent=isTrials?`${faults===0?'CLEAN RUN':`${faults} FAULT${faults===1?'':'S'}`} · CONTROL FIRST`:next?`${stars} STAR${stars===1?'':'S'} · ${(next-score).toFixed(1)}s LEFT`:'BRING IT HOME';
  $('checkpoint-status').textContent=`CHECKPOINT ${String(checkpoint+1).padStart(2,'0')} / ${String(level.checkpoints.length).padStart(2,'0')}`;
  const p=sim.bike.frame.translation(),progress=Math.min(100,Math.max(0,p.x/level.length*100));
  $('progress-fill').style.width=`${progress}%`;$('progress-bike').style.left=`${progress}%`;
  const setpiece=[...(level.setPieces??[])].reverse().find(piece=>p.x>=piece.x-12);
  $('setpiece-hint').classList.toggle('hidden',!setpiece||state!=='playing');
  if(setpiece){$('setpiece-name').textContent=setpiece.name;$('setpiece-instruction').textContent=setpiece.hint;}
  $('speed').textContent=String(Math.round(Math.abs(sim.bike.frame.linvel().x)*3.6)).padStart(2,'0');
}

$('home-levels').onclick=openLevels;$('toolbar-levels').onclick=openLevels;$('levels-back').onclick=closeLevels;
$('home-garage').onclick=openGarage;$('open-garage-settings').onclick=()=>{closeMenu(false);openGarage();};$('garage-back').onclick=closeGarage;
$('start').onclick=start;$('restart').onclick=restart;$('pause').onclick=pause;
$('resume-panel').onclick=()=>closeMenu();
$('menu-back').onclick=()=>closeMenu();
$('home-settings').onclick=()=>{selectMenuTab('settings');$('tab-settings').focus();};
$('home-how').onclick=()=>{selectMenuTab('how');$('tab-how').focus();};
$('menu').onclick=()=>{selectMenuTab('settings');$('tab-settings').focus();};
for(const [i,name]of ['how','settings'].entries()){
  const tab=$(`tab-${name}`);tab.onclick=()=>selectMenuTab(name as 'how'|'settings');
  tab.onkeydown=e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();
    const next=e.key==='Home'?'how':e.key==='End'?'settings':i===0?'settings':'how';
    selectMenuTab(next);$(`tab-${next}`).focus();
  };
}
syncSettingsControls();
for(const id of ['setting-framerate','setting-quality','setting-blood','setting-shake'])$(id).onchange=()=>{
  settings=normalizeSettings({frameRate:Number($<HTMLSelectElement>('setting-framerate').value),quality:$<HTMLSelectElement>('setting-quality').value,blood:$<HTMLSelectElement>('setting-blood').value,screenShake:$<HTMLInputElement>('setting-shake').checked});saveSettings();
};
$('reset-settings').onclick=()=>{settings={...DEFAULT_SETTINGS};saveSettings();};
$('toggle-rig-debug').onclick=()=>{debugEnabled=!debugEnabled;syncRigDebug();};
syncRigDebug();
$('modal-primary').onclick=()=>modalPrimary();$('modal-secondary').onclick=()=>modalSecondary();
$('sound').onclick=()=>{audio.setEnabled(!audio.enabled);$('sound').innerHTML=icon(audio.enabled?'sound':'mute');$('sound').setAttribute('aria-label',audio.enabled?'Mute sound':'Enable sound');$('sound').title=audio.enabled?'Mute sound':'Enable sound';};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.game-shell')!.requestFullscreen();}catch{toast('FULLSCREEN IS UNAVAILABLE IN THIS BROWSER');}};
const keymap:Record<string,keyof Controls>={w:'gas',arrowup:'gas',s:'brake',arrowdown:'brake',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
window.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const key=e.key.toLowerCase();
 if(e.key==='F3'){e.preventDefault();if(!e.repeat){debugEnabled=!debugEnabled;syncRigDebug();}return;}
 if(!$('garage-overlay').classList.contains('hidden')){if(key==='escape'){e.preventDefault();closeGarage();}return;}
 if(e.target instanceof HTMLElement&&e.target.closest('select,input,textarea'))return;
 if(!$('level-overlay').classList.contains('hidden')){if(key==='escape'){e.preventDefault();closeLevels();}return;}
 if(!$('menu-overlay').classList.contains('hidden')){if(key==='escape'){e.preventDefault();closeMenu();}return;}
 if(keymap[key]||['r','c','t','backspace','p','escape','enter',' '].includes(key))e.preventDefault();
 if(e.repeat&&['r','c','t','backspace','p','escape','enter',' '].includes(key))return;
 if(key==='shift'){controls.precision=true;return;}
 if(key==='r'||key==='c'){retryCheckpoint();return;}
 if(key==='t'||key==='backspace'){restart();return;}
 if(key==='p'||key==='escape'){pause();return;}
 if(key==='enter'||key===' '){
  if(state==='ready')start();else if(state==='crashed')retryCheckpoint();else if(state==='finished')restart();else if(state==='paused'){if(panelPaused)resumePanel();else modalPrimary();}else if(key===' ')controls.hop=true;
  return;
 }
 if(keymap[key]){if(state==='ready')start();if(state==='playing')controls[keymap[key]]=true;}
});
window.addEventListener('keyup',e=>{const key=e.key.toLowerCase();if(keymap[key])controls[keymap[key]]=false;if(key==='shift')controls.precision=false;});
window.addEventListener('blur',()=>{clearControls();if(state==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-control]')){
  const control=button.dataset.control as keyof Controls;
  button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(state==='ready')start();if(state==='playing'){controls[control]=true;button.classList.add('pressed');}};
  const release=()=>{if(control!=='hop')controls[control]=false;button.classList.remove('pressed');};
  button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
}
// Keep keyboard focus inside dialogs; R remains available for instant retries.
document.addEventListener('keydown',e=>{
  if(e.key==='Tab'&&!$('garage-overlay').classList.contains('hidden')){const items=[...$('garage-overlay').querySelectorAll<HTMLElement>('button:not(:disabled),input')],first=items[0],last=items.at(-1)!;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}

  if(e.key==='Tab'&&!$('level-overlay').classList.contains('hidden')){
    const items=[...$('level-overlay').querySelectorAll<HTMLElement>('button,a')].filter(el=>el.getClientRects().length&&el.tabIndex>=0),first=items[0],last=items.at(-1)!;
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
  if(e.key==='Tab'&&!$('menu-overlay').classList.contains('hidden')){
    const items=[...$('menu-overlay').querySelectorAll<HTMLElement>('button,select,input,[tabindex="0"]')].filter(el=>el.getClientRects().length>0&&el.tabIndex>=0);
    const first=items[0],last=items[items.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
  if(e.key==='Tab'&&!$('modal').classList.contains('hidden')){
    const first=$('modal-primary'),last=$('modal-secondary');
    if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});

async function boot(){
  try{
    await RAPIER.init();sim=new Simulation(level);view=new GameRenderer($<HTMLCanvasElement>('game'),level,appearance);await view.modelReady;
    view.applySettings(settings);saveGarage();
    sim.onFlip=(count,direction)=>{if(isTrials)return;bonus+=count*0.5;activeFlips+=count;toast(`${count>1?`${count}× `:''}${direction} LANDED / −${(count*0.5).toFixed(1)}s`);};
    sim.onExplosion=index=>{const h=level.hazards[index];view.burst(h.x,h.y,0xfa693e,55,10);audio.explosion();};
    sim.onCrash=()=>{
      if(state!=='playing')return;faults++;state='crashed';crashElapsed=0;clearControls();audio.explosion();
      const p=sim.bike.frame.translation();view.burst(p.x,p.y+0.6);view.bloodBurst(p.x,p.y+1);$('run-status').textContent='RIDER DOWN';$('timer-state').textContent='R RETRIES / T RESTARTS';
      if(isTrials){flashFault();toast(`+1 FAULT / ${sim.crashReason||'RIDER DOWN'} / R RETRIES`);}else toast('RIDER DOWN / R RETRIES THE CHECKPOINT');
    };
    // Settle the suspension before presenting the opening scene.
    for(let i=0;i<100;i++)sim.step(controls);
    sim.resetHazards();$('loading').classList.add('hidden');updateHUD();
    let last=performance.now(),accumulator=0,hudClock=0,debugClock=0;
    const loop=(now:number)=>{
      const dt=Math.min((now-last)/1000,0.05);last=now;
      if(state==='playing'||state==='crashed'){
        accumulator+=dt;
        while(accumulator>=STEP){
          const running=state==='playing';sim.step(controls);controls.hop=false;steps++;elapsed+=STEP;
          if(running){
            const p=sim.bike.frame.translation();
            level.checkpoints.forEach(([x,y],i)=>{if(i>checkpoint && p.x>x && p.x<x+4 && p.y>y-0.5 && p.y<y+5 && !sim.crashed){checkpoint=i;checkpointSnapshot=sim.captureCheckpoint();checkpointBonus=bonus;checkpointFlips=activeFlips;view.checkpoint(i);toast(`CHECKPOINT ${String(i+1).padStart(2,'0')} / LOCKED IN`);}});
            if(p.x>=level.finish[0] && p.y>level.finish[1]-1 && !sim.crashed)finish();
          }
          accumulator-=STEP;
          if((state as State)==='finished')break;
        }
      }else accumulator=0;
      if(state==='crashed'){
        crashElapsed+=dt;
        if(crashElapsed>1.1&&$('modal').classList.contains('hidden'))
          modal('GRAVITY WINS THIS ROUND.','SHAKE OFF THE DUST.','<p>R retries the checkpoint instantly.<br>T / Backspace starts a clean track.</p>','RETRY CHECKPOINT',retryCheckpoint,'RESTART TRACK',restart);
      }
      hudClock+=dt;if(hudClock>0.05){updateHUD();hudClock=0;}
      if(debugEnabled&&logRig&&(state==='playing'||state==='crashed')){
        debugClock+=dt;if(debugClock>=0.5){debugClock=0;console.info('[REVBIKE rig]',{angularVelocity:sim.bike.frame.angvel(),suspension:sim.getSuspensionTelemetry()});}
      }
      audio.update(sim.bike.wheels[0].angvel(),controls.gas,state==='playing');
      const renderDt=frameLimiter.tick(now);
      if(renderDt!==null){view.render(sim,renderDt,state==='playing'||state==='crashed',state==='playing'||state==='crashed'?accumulator/STEP:1);$('game').dataset.renderFrames=String(++renderFrames);}
      requestAnimationFrame(loop);
    };requestAnimationFrame(loop);
    // Read-only diagnostics make fixed-step physics and browser failures inspectable.
    Object.defineProperty(window,'revbike',{value:{get state(){return state;},get diagnostics(){return {position:{...sim.bike.frame.translation()},velocity:{...sim.bike.frame.linvel()},angle:sim.bike.frame.rotation(),angularVelocity:sim.bike.frame.angvel(),suspension:sim.getSuspensionTelemetry(),tuning:{...sim.tuning},dimensions:{...sim.dimensions},riderShift:sim.riderShift,throttle:sim.throttle,hopCount:sim.hopCount,faults,mode,grounded:sim.grounded,crashed:sim.crashed,steps,elapsed,bonus,checkpoint,flips:activeFlips,rigidBodies:sim.world.bodies.len(),renderer:view.renderer.info.render};}},writable:false});
  }catch(error){console.error(error);$('loading-status').textContent='The engine couldn’t start. Reload to try again. WebGL is required.';$('loading-status').classList.add('load-error');}
}
void boot();
