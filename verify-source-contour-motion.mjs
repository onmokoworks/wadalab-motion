import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {SourceEngine} from './web/source-engine.js';
import {prepareGlyph} from './web/motion-library.js';
import {bindContours,warpContour} from './web/source-contour-motion.js';
const datasets=await Promise.all(['source-program.json','source-glyphs.json','font/ascii-outlines.json','font/alpha-centerlines.json'].map(async p=>JSON.parse(await fs.readFile('web/'+p))));
const engine=new SourceEngine(...datasets),story=JSON.parse(await fs.readFile('web/night-one.json'));
const numbers=d=>d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number);
let changed=0,checked=0;
for(const c of new Set(story.phrases.join(''))){
 const glyph=prepareGlyph(engine,c);if(glyph.outlineOnly)continue;
 const rest=engine.closeLoopPaths(glyph,0),bindings=bindContours({glyph,rest});
 for(const entry of bindings){
  const expected=numbers(entry.d),actual=numbers(warpContour(entry,rest));
  assert.equal(actual.length,expected.length);
  actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-7,`Rest contour changed: ${c}`));
 }
 for(const amount of [.1,.4,.7,.95]){
  const moving=engine.closeLoopPaths(glyph,amount);
  for(const entry of bindings){const d=warpContour(entry,moving);assert.ok(numbers(d).every(Number.isFinite));if(d!==entry.d)changed++;}
 }
 checked++;
}
assert.ok(changed>checked,'Contours must follow moving strokes, not a static reveal');
console.log(`${checked} glyphs: exact resting contours, finite moving poses and motion displacement passed`);
