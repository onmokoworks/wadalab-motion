// Opt-in ?diag=all rendering diagnostics: metric aggregation, phase progression,
// identical story replay per phase, and invalidation. Records canvas commands only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {summarize,createRun,attributeLongFrames} from './web/motion-4-diagnostics.js';

// Pure helpers.
assert.deepEqual(summarize([]),{mean:null,p50:null,p95:null});
assert.deepEqual(summarize(Array.from({length:20},(_,i)=>20-i)),{mean:10.5,p50:10,p95:19});
{
 const run=createRun({modes:['a','b'],warmupMs:10,sampleMs:20}),steps=[];
 for(const now of [0,5,10,15,20,29,30,40,50,60,61]){const step=run.frame(now);steps.push(step.mode+(step.reset?'*':''));run.draw(1);if(now===15)run.spriteCreated();}
 assert.deepEqual(steps,['a*','a','a','a','a','a','b*','b','b','null','null']);
 assert.equal(run.status,'done');
 assert.deepEqual(run.phases.map(p=>[p.mode,p.frames,p.spriteCreations]),[['a',4,1],['b',2,0]]);
 assert.deepEqual(run.phases[0].rafIntervalMs,{mean:6,p50:5,p95:9});
 assert.equal(run.phases[0].rafRatePerSec,4000/24);
 assert.deepEqual(run.phases[0].jsDrawMs,{mean:1,p95:1});
 assert.deepEqual(run.phases[0].sampleWindow,[10,30]);
 const stopped=createRun({modes:['a'],warmupMs:0,sampleMs:100});stopped.frame(0);stopped.invalidate('x');
 assert.deepEqual([stopped.status,stopped.reason,stopped.frame(10).mode],['invalid','x',null]);
}
assert.deepEqual(attributeLongFrames([10,30],[{startTime:5,duration:60},{startTime:10,duration:70,blockingDuration:20},{startTime:30,duration:90}]),{count:1,durationMs:70,blockingMs:20});

// Integration with web/motion-4.js through a recording canvas.
const phrases=JSON.parse(await fs.readFile('web/night-one.json','utf8')).phrases;
let counts,resets=0,queue=[],now=1000;
const noop=()=>{},offscreen={setTransform:noop,stroke:noop,fill:noop};
const main={setTransform:noop,save:noop,restore:noop,translate:noop,scale:noop,setLineDash:noop,
 stroke(){counts.stroke++;},fill(){counts.stroke++;},drawImage(){counts.image++;},clearRect(){counts.clear++;}};
function element(tagName){
 return {tagName,style:{},hidden:false,disabled:false,textContent:'',value:'',width:0,height:0,children:[],listeners:{},
  append(...nodes){this.children.push(...nodes);},addEventListener(type,f){(this.listeners[type]??=[]).push(f);},
  setAttribute(key,value){if(this===canvas&&key==='aria-label'&&value===phrases[0])resets++;},
  setPointerCapture:noop,select:noop,focus:noop,getContext:()=>offscreen};
}
const canvas=element('canvas');canvas.getContext=()=>main;
const documentListeners={};
class TestPath{moveTo(){}lineTo(){}ellipse(){}}
Object.assign(globalThis,{innerWidth:3840,innerHeight:2160,devicePixelRatio:1,scrollY:0,Path2D:TestPath,location:{search:'?diag=all'},
 document:{hidden:false,documentElement:{requestFullscreen:()=>Promise.reject(new Error('denied'))},querySelector:()=>canvas,createElement:element,body:element('body'),
  addEventListener(type,f){(documentListeners[type]??=[]).push(f);}},
 addEventListener:noop,matchMedia:()=>({matches:false}),requestAnimationFrame:f=>queue.push(f),
 fetch:async url=>({ok:true,json:async()=>JSON.parse(await fs.readFile(url,'utf8'))})});
await import('./web/motion-4.js');
const panel=document.body.children.find(node=>node.tagName==='section'),[message,start,copy,output]=panel.children;
assert.match(message.textContent,/F11/);
const tick=()=>{counts={clear:0,stroke:0,image:0};now+=16;const callbacks=queue;queue=[];for(const f of callbacks)f(now);return counts;};
async function begin(){
 start.listeners.click[0]();
 while(!panel.hidden){tick();await new Promise(resolve=>setTimeout(resolve,1));}
}

await begin();
const phases=[];resets=0;
while(panel.hidden){const before=resets,frame=tick();if(resets>before)phases.push([]);phases.at(-1).push(frame);}
assert.equal(phases.length,5,'each mode restarts the story at the first sentence');
const [idle,clear,sprites,live,full]=phases.map(frames=>frames.slice(0,740)),sum=(frames,key)=>frames.reduce((n,f)=>n+f[key],0);
assert.deepEqual([sum(idle,'clear'),sum(idle,'stroke'),sum(idle,'image')],[1,0,0],'idle: only the restart clear');
assert.ok(sum(clear,'clear')>=clear.length&&sum(clear,'stroke')+sum(clear,'image')===0,'clear: clearRect only');
assert.ok(sum(sprites,'stroke')===0&&sum(sprites,'image')>0,'sprites: completed glyphs only');
assert.ok(sum(live,'image')===0&&sum(live,'stroke')>0,'live: animated glyphs only');
assert.deepEqual(full.map(f=>f.stroke),live.map(f=>f.stroke),'full replays the same animated glyphs');
assert.deepEqual(full.map(f=>f.image),sprites.map(f=>f.image),'full replays the same completed glyphs');

const report=JSON.parse(output.value);
assert.deepEqual(report.phases.map(p=>p.mode),['idle','clear','sprites','live','full']);
for(const p of report.phases){assert.equal(p.frames,625);assert.equal(p.rafRatePerSec,62.5);assert.equal(p.rafIntervalMs.p50,16);assert.equal(p.longAnimationFrames,null);assert.ok(p.jsDrawMs.mean>=0);}
const created=report.phases.map(p=>p.spriteCreations);
assert.ok(created[0]===0&&created[1]===0&&created[3]===0&&created[2]>0&&created[4]===created[2],'sprite cache is cleared per phase');
assert.deepEqual(report.viewport,{cssWidth:3840,cssHeight:2160,devicePixelRatio:1,backingWidth:3840,backingHeight:2160,scrollY:0});
assert.match(message.textContent,/GPU の表示 FPS ではありません/);
await copy.listeners.click[0]();
assert.match(copy.textContent,/コピーできません/,'clipboard failure leaves the JSON for manual selection');

// Invalidation: viewport change, hidden tab and dragging each stop the run and allow a retry.
await begin();tick();innerWidth=3000;tick();innerWidth=3840;
assert.ok(!panel.hidden&&/無効/.test(message.textContent)&&/表示サイズ/.test(message.textContent));
await begin();tick();document.hidden=true;for(const f of documentListeners.visibilitychange)f();document.hidden=false;
assert.ok(!panel.hidden&&/タブ/.test(message.textContent));
await begin();tick();canvas.listeners.pointerdown[0]({button:0,pointerId:1,clientX:0});tick();canvas.listeners.pointerup[0]({pointerId:1});
assert.ok(!panel.hidden&&/ドラッグ/.test(message.textContent));
console.log('Motion-4 diagnostics: metrics, identical phase replay, layer isolation and invalidation pass');
