import data from './level1.json';

export type Point = [number, number];
export type Hazard = { type: string; x: number; y: number; width?: number; radius?: number };
export interface Level {
  name: string; subtitle: string; length: number; stars: number[]; spawn: Point;
  segments: { points: number[][]; smooth: boolean }[];
  loop?: { x: number; y: number; radius: number };
  hazards: Hazard[]; checkpoints: number[][]; finish: number[];
}
export const level1 = data as Level;
export const testLevel: Level = {
  name: 'Suspension test', subtitle: 'FLAT GROUND + ONE RAMP', length: 60, stars: [10,20,30],
  spawn: [2,1.15], segments: [{ points: [[-10,0],[18,0],[24,3],[30,3],[38,0],[70,0]], smooth: false }],
  hazards: [], checkpoints: [], finish: [60,0],
};

// Monotone cubic Hermite interpolation: smooth ramps without spline overshoot.
export function sampleSegment(segment: Level['segments'][number]): Point[] {
  const p = segment.points;
  if (!segment.smooth) return p.map(([x,y]) => [x,y]);
  const slopes = p.slice(1).map((b,i) => (b[1]-p[i][1])/(b[0]-p[i][0]));
  const tangents = p.map((_,i) => i === 0 ? slopes[0] : i === p.length-1 ? slopes[i-1]
    : slopes[i-1]*slopes[i] <= 0 ? 0 : 2/(1/slopes[i-1]+1/slopes[i]));
  const result: Point[] = [];
  for (let i=0; i<p.length-1; i++) {
    const [x,y]=p[i], [nx,ny]=p[i+1], dx=nx-x;
    const n=Math.ceil(dx/0.45);
    for (let j=0;j<n;j++) {
      const t=j/n, t2=t*t, t3=t2*t;
      result.push([x+t*dx,(2*t3-3*t2+1)*y+(t3-2*t2+t)*dx*tangents[i]+(-2*t3+3*t2)*ny+(t3-t2)*dx*tangents[i+1]]);
    }
  }
  result.push(p[p.length-1] as Point);
  return result;
}

export function loopPoints(loop: NonNullable<Level['loop']>): Point[] {
  return Array.from({length: 161}, (_,i) => {
    const t=-Math.PI/2+i/160*Math.PI*2;
    return [loop.x+Math.cos(t)*loop.radius,loop.y+Math.sin(t)*loop.radius];
  });
}
