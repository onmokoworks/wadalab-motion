import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clockGlyphFrame,clockLayers} from './web/clock-flow-core.js';
import {foldStrokePath,strokeVisibility,clockMotion} from './web/clock-core.js';
import {clamp} from './web/fold-core.js';
const data=JSON.parse(await readFile('web/font/clock-skeletons.json','utf8'));
for(const [character,paths,width,advance] of data.glyphs){
 const glyph={character,paths,width,advance};
 for(const amount of [0,.1,.4,.5,.8,1]){
  const frame=clockGlyphFrame(glyph,amount),p=clamp(1-amount);
  assert.deepEqual(frame.paths,paths.map(path=>foldStrokePath(path,p)));assert.equal(frame.opacity,strokeVisibility(p));
 }
 for(const p of [0,.2,.4,.5,.6,.8,1]){const layers=clockLayers(glyph,glyph,p);assert.equal(layers[0].amount,clamp(p/.6));assert.equal(layers[1].amount,1-clamp((p-.4)/.6));assert.equal(layers[0].visible,p<1);}
}
assert.equal(clockMotion.speed,.75);assert.equal(clockMotion.duration,.35/.75);
console.log('Original clock glyph data, path poses, overlapping layers and timing: identical');
