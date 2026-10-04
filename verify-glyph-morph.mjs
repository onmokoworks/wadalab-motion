import assert from 'node:assert/strict';
import {buildMorph,morphPaths,morphSchedule} from './web/glyph-morph.js';
import {readFile} from 'node:fs/promises';
import {createMotionLibrary} from './web/motion-library.js';
const files={program:'source-program.json',glyphs:'source-glyphs.json',ascii:'font/ascii-outlines.json',alpha:'font/alpha-centerlines.json'};
const data=Object.fromEntries(await Promise.all(Object.entries(files).map(async([k,p])=>[k,JSON.parse(await readFile(`web/${p}`,'utf8'))]))),library=createMotionLibrary(data);
for(const text of ['TEST','MOTION','Wadalabfont','Thequickbrownfoxjumpsoverthelazydog'])for(let i=0;i<text.length;i++){
 const a=library.sample(text[i],1).strokes.filter(s=>s.kind==='line').map(s=>s.points),b=library.sample(text[(i+1)%text.length],1).strokes.filter(s=>s.kind==='line').map(s=>s.points),m=buildMorph(a,b);
 assert.deepEqual(morphPaths(m,0),a);assert.deepEqual(morphPaths(m,1),b);for(const t of [.1,.5,.9])for(const p of morphPaths(m,t).flat())assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
}
assert.equal(morphSchedule(.99,4).progress,0);assert.equal(morphSchedule(1.2,4).active,0);assert.equal(morphSchedule(1.5,4).active,1);assert.equal(morphSchedule(1.5,4).progress,0);
console.log('Adjacent glyph morph endpoints, finite poses, single active slot and one-second hold pass');
assert.deepEqual(morphSchedule(-.01,4),{round:0,active:0,progress:0});
for(const count of [3,4,6,9,35])for(const seconds of [0,.9,1.09,1.19,2.4,8]){
 const state=morphSchedule(seconds,count,1,.18);
 assert.ok(state.active>=0&&state.active<count);assert.equal(Array.from({length:count},(_,i)=>i).filter(i=>i===state.active).length,1);
}
assert.equal(morphSchedule(1.18,4,1,.18).active,1);
