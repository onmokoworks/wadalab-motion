import assert from 'node:assert/strict';
import {buildMorph,morphPaths} from './web/clock-flow-core.js';
import {readFile} from 'node:fs/promises';
import {SourceEngine} from './web/source-engine.js';
import {prepareGlyph} from './web/motion-library.js';
const files=['source-program.json','source-glyphs.json','font/ascii-outlines.json','font/alpha-centerlines.json'];
const data=await Promise.all(files.map(async p=>JSON.parse(await readFile(`web/${p}`,'utf8'))));
const engine=new SourceEngine(...data),digits=Array.from({length:10},(_,i)=>engine.closeLoopPaths(prepareGlyph(engine,String(i)),0).map(p=>p.path));
for(const a of digits)for(const b of digits){const morph=buildMorph(a,b);assert.deepEqual(morphPaths(morph,0),a);assert.deepEqual(morphPaths(morph,1),b);for(const t of [.1,.5,.9])for(const p of morphPaths(morph,t).flat())assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
console.log('100 digit transitions: exact endpoint glyphs and finite intermediate paths pass');
