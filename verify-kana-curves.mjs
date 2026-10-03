import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SourceEngine} from './web/source-engine.js';
const load=async path=>JSON.parse(await readFile(new URL(`web/${path}`,import.meta.url),'utf8'));
const engine=new SourceEngine(...await Promise.all(['source-program.json','source-glyphs.json','font/ascii-outlines.json','font/alpha-centerlines.json'].map(load)));
const turn=points=>points.slice(2).map((p,i)=>{
 const a=points[i],b=points[i+1];
 const before=Math.atan2(b.y-a.y,b.x-a.x),after=Math.atan2(p.y-b.y,p.x-b.x);
 return Math.atan2(Math.sin(after-before),Math.cos(after-before));
});
for(const text of 'んりな'){
 const glyph=engine.make(text,11);
 assert.ok(glyph.arcUnfoldPlans.size,`${text}: curved stroke detected`);
 const middle=engine.closeLoopPaths(glyph,.5),final=engine.closeLoopPaths(glyph,0);
 for(const [id] of glyph.arcUnfoldPlans){
  const current=middle.find(piece=>piece.stroke===id).path,original=glyph.strokes[id].motionPath;
  assert.ok(turn(current).some((value,i)=>Math.abs(value-turn(original)[i])>.01),`${text}: bends change, not just scale`);
 }
 for(const piece of final)piece.path.forEach((point,i)=>{const source=glyph.strokes[piece.stroke].motionPath[i];assert.ok(Math.hypot(point.x-source.x,point.y-source.y)<1e-8);});
 for(const amount of [0,.25,.5,.75,1])for(const piece of engine.closeLoopPaths(glyph,amount))assert.ok(piece.path.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
}
assert.equal(engine.make('ゆ',11).arcUnfoldPlans.size,0);
console.log('Kana curves unfold their bends and preserve completed source paths: pass');
