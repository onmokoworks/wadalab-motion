import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SourceEngine} from './web/source-engine.js';
import {prepareGlyph,dotGeometry} from './web/motion-library.js';
import {leadingWeights} from './web/walk-core.js';
import {unfoldStep,reachPoint} from './web/unfold-step.js';
const names={program:'source-program.json',glyphs:'source-glyphs.json',ascii:'font/ascii-outlines.json',alpha:'font/alpha-centerlines.json'};
const data=Object.fromEntries(await Promise.all(Object.entries(names).map(async([k,p])=>[k,JSON.parse(await readFile(`web/${p}`,'utf8'))])));
const engine=new SourceEngine(data.program,data.glyphs,data.ascii,data.alpha);
const points=p=>p.dotWidth?Array.from({length:25},(_,i)=>{const d=dotGeometry(p);return {x:d.center.x+Math.cos(i/24*Math.PI*2)*d.radiusX,y:d.center.y+Math.sin(i/24*Math.PI*2)*d.radiusY};}):p.path;
assert.equal(unfoldStep(.5).front,1);assert.equal(unfoldStep(.5).rear,0);
for(const ch of new Set('TESTonmk.workMOTIONWadalabfontThequickbrownfoxjumpsoverthelazydog')){
 const g=prepareGlyph(engine,ch),rest=engine.closeLoopPaths(g,0).map(points),weights=leadingWeights(rest.map(points=>({points})));
 for(const t of [0,.08,.16,.3,.5,.54,.7,.84,.99,1]){
  const state=unfoldStep(t);assert.ok(state.progress>=.72);
  const posed=engine.closeLoopPaths(g,1-state.progress).map(points);assert.equal(posed.length,rest.length);
  posed.forEach((path,s)=>{assert.equal(path.length,rest[s].length);path.forEach((p,i)=>{
   const q=reachPoint(rest[s][i],p,weights[s][i],state,120);assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.y),ch);
   if(t===1){assert.ok(Math.abs(q.x-rest[s][i].x-120)<1e-8);assert.equal(q.y,rest[s][i].y);}
  });});
 }
}
console.log('Actual glyphs: finite partial folds, stable paths, front/rear order and completed step pass');
