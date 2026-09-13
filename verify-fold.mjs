import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildRig,pose,deform,entryTimes} from './web/fold-core.js';
import {hasCodePoint} from './web/font-support.js';

test('bundled font is the unmodified 4.73 release; added characters are indexed',async()=>{
 const metadata=JSON.parse(await readFile(new URL('./web/font/metadata.json',import.meta.url)));
 const bytes=await readFile(new URL('./web/font/wlmaru2004emoji.ttf',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),metadata.sha256);
 for(const c of '和田研あいうえお𠮷😀ABCabc123')assert.ok(hasCodePoint(metadata,c.codePointAt(0)),c);
 assert.equal(hasCodePoint(metadata,0x10ffff),false);
});
test('joint articulation preserves the rest pose and each link length',()=>{
 const w=64,h=64,alpha=new Uint8Array(w*h);
 for(let y=8;y<56;y++)for(let x=29;x<34;x++)alpha[y*w+x]=255;
 for(let y=29;y<34;y++)for(let x=8;x<56;x++)alpha[y*w+x]=255;
 const rig=buildRig(alpha,w,h,{jointLength:8,grid:16});assert.ok(rig.bones.length>5);
 const points=deform(rig,pose(rig,0));
 rig.vertices.forEach((v,i)=>{assert.ok(Math.abs(v.x-points[2*i])<1e-4);assert.ok(Math.abs(v.y-points[2*i+1])<1e-4);});
 for(const t of [0,.2,.5,.8,1]){
  const p=pose(rig,t);for(let i=1;i<rig.bones.length;i++){const parent=p[rig.bones[i].parent];assert.ok(Math.abs(Math.hypot(p[i].x-parent.x,p[i].y-parent.y)-rig.bones[i].length)<1e-8);}
  assert.ok([...deform(rig,p)].every(Number.isFinite));
 }
 assert.notDeepEqual([...deform(rig,pose(rig,1))],[...points]);
});
test('appending is sequential and preserves existing character entry times',()=>{
 const a=entryTimes([],['和','田'],1,.2);assert.deepEqual(a.map(x=>x.born),[1,1.2]);
 const b=entryTimes(a,['和','田','研'],1.1,.2);assert.deepEqual(b.map(x=>x.born),[1,1.2,1.4]);
 const c=entryTimes(b,['和','研'],4,.2);assert.deepEqual(c.map(x=>x.born),[1,1.4]);
});

test('path trimming follows a bent stroke by length, without moving its pixels',async()=>{
 const {buildTrimMap}=await import('./web/fold-core.js');
 const w=48,h=48,a=new Uint8Array(w*h);
 for(let y=5;y<=35;y++)for(let x=7;x<=11;x++)a[y*w+x]=255;
 for(let y=31;y<=35;y++)for(let x=7;x<=38;x++)a[y*w+x]=255;
 const trim=buildTrimMap(a,w,h);
 assert.ok(trim[8*w+9]<trim[23*w+9]);
 assert.ok(trim[23*w+9]<trim[33*w+25]);
 assert.ok([...trim].every(v=>Number.isFinite(v)&&v>=0&&v<1));
 const visible=t=>a.reduce((sum,v,i)=>sum+(v&&trim[i]<=t?1:0),0);
 assert.ok(visible(.2)<visible(.6));
 assert.equal(visible(1),a.filter(v=>v).length);
});
