import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMotionLibrary} from './web/motion-library.js';
import {leadingWeights,walkingPoint} from './web/walk-core.js';
const files={program:'source-program.json',glyphs:'source-glyphs.json',ascii:'font/ascii-outlines.json',alpha:'font/alpha-centerlines.json'};
const data=Object.fromEntries(await Promise.all(Object.entries(files).map(async([k,v])=>[k,JSON.parse(await readFile(new URL(`web/${v}`,import.meta.url),'utf8'))])));
const library=createMotionLibrary(data);
const n=library.sample('n',1).strokes,nWeights=leadingWeights(n);
const arch=n[1].points,apex=arch.reduce((best,p,i)=>p.y<arch[best].y?i:best,0);
assert.equal(nWeights[1][apex],1,'n arch apex leads');
assert.equal(nWeights[0][0],0,'n left stem stays planted before catch-up');
const r=library.sample('r',1).strokes,rWeights=leadingWeights(r);
assert.equal(rWeights[0][0],0,'r stem stays planted');
assert.equal(rWeights[1][0],1,'r shoulder leads');
for(const character of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'){
 const strokes=library.sample(character,1).strokes.map(stroke=>stroke.points?stroke:{...stroke,points:Array.from({length:25},(_,i)=>({x:stroke.center.x+Math.cos(i/24*Math.PI*2)*stroke.radiusX,y:stroke.center.y+Math.sin(i/24*Math.PI*2)*stroke.radiusY}))}),weights=leadingWeights(strokes);
 for(const time of [0,.15,.36,.44,.6,.8,1]){
  const ordered=strokes.flatMap((stroke,s)=>stroke.points.map((point,i)=>({point,moved:walkingPoint(point,{lead:weights[s][i],step:200,time})}))).sort((a,b)=>a.point.x-b.point.x);
  for(let i=1;i<ordered.length;i++)assert.ok(ordered[i].moved.x>=ordered[i-1].moved.x-1e-8,`${character}: horizontal order at ${time}`);
  for(const row of ordered){assert.equal(row.moved.y,row.point.y);if(time===1)assert.ok(Math.abs(row.moved.x-row.point.x-200)<1e-8);}
  for(const stroke of strokes){const a=stroke.points[0],b=stroke.points.at(-1);if(a.x===b.x&&a.y===b.y){const rows=ordered.filter(row=>row.point===a||row.point===b);assert.deepEqual(rows[0].moved,rows[1].moved);}}
 }
}
console.log('Real glyphs: no horizontal inversion, closed seams stay joined, final form restored');
