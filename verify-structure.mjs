import test from 'node:test';import assert from 'node:assert/strict';
import {analyze,plan,posedPaths,posedDots,flexPath,trimPath} from './web/structure.js';
function fixture(){const w=96,h=96,a=new Uint8Array(w*h);const rect=(x,y,dx,dy)=>{for(let j=y;j<y+dy;j++)for(let i=x;i<x+dx;i++)a[j*w+i]=255;};rect(18,18,44,5);rect(18,58,44,5);rect(18,18,5,45);rect(58,18,5,45);rect(38,5,5,18);rect(58,38,30,5);rect(78,38,5,35);return analyze(a,w,h);}
test('closed paths and actual junctions survive graph extraction',()=>{const g=fixture();assert.ok(g.edges.some(e=>e.cycle));assert.ok(g.nodes.some(n=>n.edges.length>=3));assert.ok(g.nodes.some(n=>n.edges.length===1));});
test('rigid-cycle rule preserves internal distances; changes pivot to cycle attachment',()=>{const g=fixture(),s=plan(g,8),p=posedPaths(s,1);for(const part of s.parts.filter(p=>!p.fixed)){const a=part.path,b=p[part.edge];for(let i=1;i<a.length;i++)assert.ok(Math.abs(Math.hypot(a[i].x-a[0].x,a[i].y-a[0].y)-Math.hypot(b[i].x-b[0].x,b[i].y-b[0].y))<1e-7);}});
test('horizontal / vertical / junction / endpoint decisions differ structurally',()=>{const g=fixture();const signatures=[0,1,3,4,5,6,7,8,9].map(r=>JSON.stringify(plan(g,r).parts.map(p=>[p.fixed,p.pivot.id,p.mode,Math.round(p.theta*100)])));assert.ok(new Set(signatures).size>=8);});

test('all strategies restore exact paths and produce finite coordinates',()=>{const g=fixture();for(let r=0;r<10;r++){const s=plan(g,r);assert.deepEqual(posedPaths(s,0),s.parts.map(p=>p.path));for(const amount of [.2,.65,1])assert.ok(posedPaths(s,amount).flat().every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}});
test('terminal joints keep roots anchored without a common rotation',()=>{const s=plan(fixture(),2),paths=posedPaths(s,.65);s.parts.forEach((p,i)=>assert.deepEqual(paths[i][0],p.path[0]));});
test('short straight paths flex with both endpoints anchored',()=>{const p=[{x:0,y:0},{x:1,y:0}],v=flexPath(p,.65);assert.deepEqual(v[0],p[0]);assert.deepEqual(v.at(-1),p[1]);assert.ok(v.some(p=>Math.abs(p.y)>.001));});
test('isolated dots move independently',()=>{const g={nodes:[{x:12,y:12,edges:[]}]};assert.equal(posedDots(g,0)[0].y,12);assert.ok(posedDots(g,.65)[0].y>12);});

test('entry starts empty and trims by articulated path length',()=>{const p=[{x:0,y:0},{x:10,y:0},{x:10,y:30}];assert.deepEqual(trimPath(p,0),[]);assert.deepEqual(trimPath(p,.5),[{x:0,y:0},{x:10,y:0},{x:10,y:10}]);assert.deepEqual(trimPath(p,1),p);});
