export const FRAME_RATES = [0, 30, 60, 120, 144] as const;
export type FrameRate = typeof FRAME_RATES[number];
export type BloodAmount = 'off'|'low'|'medium'|'high';
export interface GameSettings {
  frameRate: FrameRate;
  quality: 'low'|'medium'|'high';
  blood: BloodAmount;
  screenShake: boolean;
}
export const SETTINGS_KEY = 'revbike-settings-v1';
export const DEFAULT_SETTINGS: Readonly<GameSettings> = {frameRate:0, quality:'high', blood:'off', screenShake:true};

export function normalizeSettings(value: unknown): GameSettings {
  const saved = value && typeof value==='object' ? value as Record<string,unknown> : {};
  return {
    frameRate: FRAME_RATES.includes(saved.frameRate as FrameRate) ? saved.frameRate as FrameRate : DEFAULT_SETTINGS.frameRate,
    quality: ['low','medium','high'].includes(saved.quality as string) ? saved.quality as GameSettings['quality'] : DEFAULT_SETTINGS.quality,
    blood: ['off','low','medium','high'].includes(saved.blood as string) ? saved.blood as BloodAmount : DEFAULT_SETTINGS.blood,
    screenShake: typeof saved.screenShake==='boolean' ? saved.screenShake : DEFAULT_SETTINGS.screenShake,
  };
}
export function bloodParticleCount(amount:BloodAmount):number {
  return {off:0,low:12,medium:30,high:65}[amount];
}

// This gates drawing only. The fixed-step simulation and clock keep running on
// every animation callback regardless of the selected rendering frame rate.
export class FrameLimiter {
  private scheduledAt:number|undefined;
  private drawnAt:number|undefined;
  constructor(public frameRate:FrameRate=0){}
  setFrameRate(value:FrameRate){this.frameRate=value;this.scheduledAt=undefined;this.drawnAt=undefined;}
  tick(now:number):number|null {
    const interval=this.frameRate===0?0:1000/this.frameRate;
    if(this.scheduledAt!==undefined && now-this.scheduledAt<interval-0.001)return null;
    const dt=this.drawnAt===undefined?1/60:Math.min(0.1,(now-this.drawnAt)/1000);
    this.scheduledAt=this.scheduledAt===undefined||interval===0?now:this.scheduledAt+Math.max(1,Math.floor((now-this.scheduledAt+0.001)/interval))*interval;
    this.drawnAt=now;
    return dt;
  }
}
