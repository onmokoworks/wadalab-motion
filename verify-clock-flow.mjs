import assert from 'node:assert/strict';
import {createClockMotion} from './web/clock-flow-core.js';
import {readFile} from 'node:fs/promises';
import {SourceEngine} from './web/source-engine.js';
import {prepareGlyph} from './web/motion-library.js';
const files=['source-program.json','source-glyphs.json','font/ascii-outlines.json','font/alpha-centerlines.json'];
const data=await Promise.all(files.map(async p=>JSON.parse(await readFile(`web/${p}`,'utf8'))));
const engine=new SourceEngine(...data),motion=createClockMotion(engine);
for(const ch of '0123456789'){
 const glyph=prepareGlyph(engine,ch),rest=engine.closeLoopPaths(glyph,0),xs=rest.flatMap(p=>p.path.map(p=>p.x)),offset=100-(Math.min(...xs)+Math.max(...xs))/2;
 for(const amount of [0,.2,.5,.8,1])assert.deepEqual(motion.pose(ch,amount),engine.closeLoopPaths(glyph,amount).map(p=>p.path.map(q=>({x:q.x+offset,y:q.y}))),'C5 parity');
}
for(const a of '0123456789')for(const b of '0123456789'){
 assert.deepEqual(motion.transition(a,b,0),motion.pose(a,0));assert.deepEqual(motion.transition(a,b,1),motion.pose(b,0));
 if(a!==b){assert.deepEqual(motion.transition(a,b,.25),motion.pose(a,.5));assert.deepEqual(motion.transition(a,b,.75),motion.pose(b,.5));assert.deepEqual(motion.transition(a,b,.5),[]);}
 for(const t of [.1,.4,.6,.9])for(const p of motion.transition(a,b,t).flat())assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
}
console.log('100 clock transitions: C5 source parity, outgoing fold/incoming unfold, finite paths pass');
