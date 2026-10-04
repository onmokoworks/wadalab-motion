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
const {arcPosition}=await import('./web/glyph-morph.js');
assert.deepEqual(arcPosition(0,220,0),{x:0,y:-0});
assert.ok(Math.abs(arcPosition(0,220,1).x-220)<1e-9);
assert.ok(Math.abs(arcPosition(0,220,1).y)<1e-9);
assert.equal(arcPosition(0,220,.5).x,110);assert.ok(arcPosition(0,220,.5).y<0);
for(const count of [3,4,9])for(const tick of [0,count-1,count,count+1]){
 const state=morphSchedule(tick*1.18+.01,count,1,.18);
 const positions=Array.from({length:count},(_,i)=>(i+state.round+(i<state.active?1:0))%count);
 if(state.active===0)assert.equal(new Set(positions).size,count);
}
const {travelMorph}=await import('./web/glyph-morph.js');
const straight=[[{x:0,y:0},{x:100,y:0}]],travel=buildMorph(straight,straight);
assert.deepEqual(travelMorph(travel,0,220,0),straight);
assert.deepEqual(travelMorph(travel,0,220,1),[[{x:220,y:0},{x:320,y:0}]]);
const moving=travelMorph(travel,0,220,.2)[0];assert.equal(moving[0].x,0);assert.ok(moving.at(-1).x>100);
const {sequenceState}=await import('./web/glyph-morph.js');
assert.deepEqual(sequenceState(-1,4),{index:0,next:1,progress:0,done:false});
assert.equal(sequenceState(.99,4).progress,0);assert.ok(sequenceState(1.09,4).progress>0);
assert.deepEqual(sequenceState(1.18,4),{index:1,next:2,progress:0,done:false});
for(const t of [3.54,10,1000])assert.deepEqual(sequenceState(t,4),{index:3,next:3,progress:0,done:true});
assert.deepEqual(sequenceState(0,1),{index:0,next:0,progress:0,done:true});
assert.deepEqual(sequenceState(0,4,0,1),{index:0,next:1,progress:0,done:false});
assert.equal(sequenceState(.5,4,0,1).progress,.5);
assert.deepEqual(sequenceState(1,4,0,1),{index:1,next:2,progress:0,done:false});
assert.deepEqual(sequenceState(3,4,0,1),{index:3,next:3,progress:0,done:true});

// Repetition advances the world position; the last-to-first transition goes right.
for(const count of [3,4,9]){
 const last=morphSchedule((count-1)*.94+.5,count,.14,.8),first=morphSchedule(count*.94+.01,count,.14,.8);
 assert.equal(last.active,count-1);assert.equal(first.active,0);assert.equal(first.round,last.round+1);
}
const arm=[[{x:0,y:0},{x:100,y:0}]],targetArms=[arm[0],[{x:0,y:50},{x:100,y:50}]],branched=buildMorph(arm,targetArms);
assert.equal(branched.pairs.length,2);assert.ok(branched.pairs[1][0].every(p=>p.y===0));
const {straightMorphPaths,strongEase}=await import('./web/glyph-morph.js');
const curve=[[{x:0,y:0},{x:50,y:100},{x:100,y:0}]],curved=buildMorph(curve,[[{x:0,y:0},{x:50,y:-50},{x:100,y:0}]]);
assert.deepEqual(straightMorphPaths(curved,0),curve);
assert.deepEqual(straightMorphPaths(curved,1),curved.to);
for(const path of straightMorphPaths(curved,.5)){const a=path[0],b=path.at(-1);for(const p of path)assert.ok(Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))<1e-6);}
assert.ok(strongEase(.25)<.05);assert.ok(strongEase(.75)>.95);
console.log('Straight intermediate paths and stronger ease-in-out pass');
