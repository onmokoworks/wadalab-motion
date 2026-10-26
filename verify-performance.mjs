// Rendering-work regression test: records canvas commands, not GPU frame rate.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const counts={paths:0,points:0,strokes:0,fills:0,images:0,clearedPixels:0};
class TestPath {
 constructor(){counts.paths++;}
 moveTo(){counts.points++;} lineTo(){counts.points++;} ellipse(){counts.points++;}
}
let rowRects=[];
const ctx={setTransform(){},save(){},restore(){},translate(){},scale(){},beginPath(){},rect(x,y,w,h){rowRects.push({y,h});},clip(){},setLineDash(){},
 moveTo(){counts.points++;},lineTo(){counts.points++;},ellipse(){counts.points++;},
 stroke(){counts.strokes++;},fill(){counts.fills++;},drawImage(){counts.images++;},clearRect(x,y,w,h){counts.clearedPixels+=w*h;}};
const makeCanvas=()=>({style:{},width:0,height:0,getContext:()=>ctx,addEventListener(){},setAttribute(){}});
const canvas=makeCanvas();let frame;
Object.assign(globalThis,{innerWidth:3840,innerHeight:2160,devicePixelRatio:Number(process.argv[3]||1),scrollY:0,Path2D:TestPath,location:{search:process.argv.includes('--source')?'?outline=source':''},
 document:{hidden:false,querySelector:()=>canvas,createElement:makeCanvas,body:{append(){},style:{}}},
 addEventListener(){},matchMedia:()=>({matches:false}),requestAnimationFrame:f=>{frame=f;},
 fetch:async url=>({ok:true,json:async()=>JSON.parse(await fs.readFile(url,'utf8'))})});
const init=performance.now();await import('./web/'+(process.argv[2]||'motion-4.js'));
const initializeMs=performance.now()-init;for(const key of Object.keys(counts))counts[key]=0;
const timings=[];
for(let i=0;i<900;i++){const start=performance.now();rowRects=[];frame(1+i*1000/60);for(let r=1;r<rowRects.length;r++)assert.ok(rowRects[r].y>=rowRects[r-1].y+rowRects[r-1].h,'Animated row bands must not overlap');timings.push(performance.now()-start);}
timings.sort((a,b)=>a-b);
console.log(JSON.stringify({initializeMs,frames:900,canvas:[canvas.width,canvas.height],cpuMs:timings.reduce((a,b)=>a+b,0),p95Ms:timings[855],counts},null,2));

if(!process.argv[2]){assert.equal(canvas.height,2160*devicePixelRatio);assert.ok(counts.points<2000000,'Do not rebuild offscreen/static glyph points');assert.ok(counts.strokes<60000,'Reuse rasterized resting glyphs instead of stroking them each frame');console.log('4K rendering-work regression checks passed');}
