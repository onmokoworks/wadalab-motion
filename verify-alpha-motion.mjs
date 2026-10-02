import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareAlphaMotion,alphaMotionPaths} from './web/alpha-motion.js';
const data=JSON.parse(fs.readFileSync('./web/font/alpha-centerlines.json'));
assert.equal(data.glyphs.length,52);
let curves=0;
for(const [character,paths,width,advance,dots] of data.glyphs){
 const rig=prepareAlphaMotion(paths,width,dots);
 assert.ok(width>0&&rig.strokes.length,character);
 for(const piece of alphaMotionPaths(rig,1)) assert.ok(piece.path.every(p=>Math.hypot(p.x-piece.path[0].x,p.y-piece.path[0].y)<1e-8),`${character}: zero start`);
 assert.deepEqual(alphaMotionPaths(rig,0).map(p=>p.path),rig.strokes.map(s=>s.motionPath));
 for(const amount of [.1,.3,.5,.7,.9]){
  const posed=alphaMotionPaths(rig,amount);
  assert.ok(posed.every(p=>p.path.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y))),character);
  for(const stroke of rig.strokes.filter(s=>s.curve)){
   curves++;
   const p=posed[stroke.id].path;
   const final=stroke.motionPath;
   const direction=q=>Math.atan2(q.at(-1).y-q.at(-2).y,q.at(-1).x-q.at(-2).x);
   if(amount===.5) assert.ok(Math.abs(direction(p)-direction(final))>.00001,`${character}: curvature changes`);
  }
 }
}
console.log(JSON.stringify({letters:52,curvedSamples:curves,zeroStart:true,finite:true,finalPaths:true}));
