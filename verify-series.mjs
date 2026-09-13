import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,plan,posedPaths} from './web/structure.js';
test('06 series preserves rest, fixed axes and articulated segment lengths',()=>{
 const w=96,a=new Uint8Array(w*w);for(let y=0;y<w;y++)for(let x=0;x<w;x++)if((y>=20&&y<=23&&x>10&&x<80)||(x>=40&&x<=43&&y>=20&&y<65)||(y>=62&&y<=65&&x>=40&&x<70)||(x>=67&&x<=70&&y>=62&&y<85))a[y*w+x]=255;
 const g=analyze(a,w,w);
 for(const rule of [11,12]){const s=plan(g,rule);assert.deepEqual(posedPaths(s,0),s.parts.map(p=>p.path));for(const amount of [.2,.6,1]){const paths=posedPaths(s,amount);s.parts.forEach((p,i)=>{if(p.fixed)assert.deepEqual(paths[i],p.path);for(let j=1;j<p.path.length;j++){const len=q=>Math.hypot(q[j].x-q[j-1].x,q[j].y-q[j-1].y);assert.ok(Math.abs(len(p.path)-len(paths[i]))<1e-8);}});}}
 assert.notDeepEqual(posedPaths(plan(g,11),.6),posedPaths(plan(g,12),.6));
});
