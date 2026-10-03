import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMotionLibrary} from 'wadalab-motion';
import {SourceEngine} from './web/source-engine.js';
import {prepareGlyph,dotGeometry} from './web/motion-library.js';
const paths={program:'source-program.json',glyphs:'source-glyphs.json',ascii:'font/ascii-outlines.json',alpha:'font/alpha-centerlines.json'};
const data=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,JSON.parse(await readFile(new URL(`web/${path}`,import.meta.url),'utf8'))])));
const library=createMotionLibrary(data),reference=new SourceEngine(data.program,data.glyphs,data.ascii,data.alpha);
assert.equal(library.has('🦄'),false);
assert.equal(library.sample('🦄',.5),null);
assert.throws(()=>library.sample('あい',.5),TypeError);
assert.throws(()=>library.sample('あ',NaN),TypeError);
for(const text of 'あしの文出羽良彰トabc09:：;'){
 const glyph=prepareGlyph(reference,text);
 for(const progress of [0,.25,.5,1]){
  const frame=library.sample(text,progress);
  assert.ok(frame);
  if(frame.kind==='paths'){
   const expected=reference.closeLoopPaths(glyph,1-progress).map(piece=>piece.dotWidth?{id:piece.stroke,kind:'dot',...dotGeometry(piece)}:{id:piece.stroke,kind:'line',width:glyph.lineWidth??16,points:piece.path.map(({x,y})=>({x,y}))});
   assert.deepEqual(frame.strokes,expected,`${text}/${progress}: example parity`);
   assert.ok(!JSON.stringify(frame).includes('opacity'));
  }
 }
}
const completed=library.sample('あ',1);library.sample('あ',.3);assert.deepEqual(library.sample('あ',1),completed);
assert.equal(library.sample(':',0).strokes[0].radiusY,0);
assert.equal(library.sample('：',1).strokes[0].radiusX,30);
console.log('DOM-free library, unsupported characters, repeatability and renderer parity: pass');
