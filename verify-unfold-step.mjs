import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SourceEngine} from './web/source-engine.js';
import {prepareGlyph,dotGeometry} from './web/motion-library.js';
import {createUnfoldRig,unfoldPaths} from './web/unfold-step.js';
const names={program:'source-program.json',glyphs:'source-glyphs.json',ascii:'font/ascii-outlines.json',alpha:'font/alpha-centerlines.json'};
const data=Object.fromEntries(await Promise.all(Object.entries(names).map(async([k,p])=>[k,JSON.parse(await readFile(`web/${p}`,'utf8'))])));
const engine=new SourceEngine(data.program,data.glyphs,data.ascii,data.alpha);
const points=p=>p.dotWidth?Array.from({length:25},(_,i)=>{const d=dotGeometry(p);return {x:d.center.x+Math.cos(i/24*Math.PI*2)*d.radiusX,y:d.center.y+Math.sin(i/24*Math.PI*2)*d.radiusY};}):p.path;
for(const ch of new Set('TESTonmk.workMOTIONWadalabfontThequickbrownfoxjumpsoverthelazydog')){
 const rest=engine.closeLoopPaths(prepareGlyph(engine,ch),0).map(points),rig=createUnfoldRig(rest);
 assert.ok(rig.step>0,ch+' has geometric reach');
 for(const t of [0,.2,.38,.48,.6,.8,.86,.99999,1]){
  const paths=unfoldPaths(rest,rig,t,120);
  paths.forEach((path,s)=>path.forEach((p,i)=>{
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
   if(t===1){assert.ok(Math.abs(p.x-rest[s][i].x-120)<1e-8);assert.ok(Math.abs(p.y-rest[s][i].y)<1e-8);}
  }));
 }
 const tip=rig.chain.at(-1);
 const tipIndex=rest.findIndex(p=>p.some(q=>q.x===tip.x&&q.y===tip.y));
 const i=rest[tipIndex].findIndex(q=>q.x===tip.x&&q.y===tip.y);
 for(const t of [.48,.6,.8])assert.ok(Math.abs(unfoldPaths(rest,rig,t,120)[tipIndex][i].x-tip.x-120)<1e-8,ch+' planted tip');
}
console.log('All displayed glyphs: finite poses, fixed landed tip, complete restoration and translation pass');
