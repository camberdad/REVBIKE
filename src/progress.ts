import type {Level} from './track';
// Browser storage is per course, so new campaigns cannot overwrite other best times.
export function readBest(level:Level):number|null{
 try{const raw=localStorage.getItem(`revbike-best-${level.name}`),time=Number(raw);return raw!==null&&Number.isFinite(time)&&time>=0?time:null;}catch{return null;}
}
