// Flowing clock page. Kept to old-browser-safe syntax and DOM calls: this file
// is also bundled into clock-flow-legacy.js for browsers without ES modules.
import {coast} from '/walk-core.js';
import {formatClock,transitionProgress} from '/clock-core.js';
import {clockGlyphFrame,clockLayers} from '/clock-flow-core.js';
const svg=document.querySelector('svg'),NS='http://www.w3.org/2000/svg';
const create=name=>document.createElementNS(NS,name);
const frame=window.requestAnimationFrame?callback=>requestAnimationFrame(callback):callback=>setTimeout(()=>callback(performance.now()),16);
let drag=null,manualOffset=0,velocity=0,lastFrame=performance.now(),distance=0;
function press(id,x){drag={id,x,time:performance.now()};velocity=0;}
function move(id,x){if(!drag||drag.id!==id)return;const now=performance.now(),dx=x-drag.x,dt=(now-drag.time)/1000;manualOffset+=dx;if(dt>0)velocity=.3*velocity+.7*Math.max(-2400,Math.min(2400,dx/dt));drag={id,x,time:now};}
function release(){if(drag&&performance.now()-drag.time>100)velocity=0;drag=null;}
function cancel(){drag=null;velocity=0;}
if(window.PointerEvent){
 svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(svg.setPointerCapture)svg.setPointerCapture(e.pointerId);press(e.pointerId,e.clientX);});
 svg.addEventListener('pointermove',e=>move(e.pointerId,e.clientX));
 svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',cancel);
}else{
 // Vertical page scrolling stays native; only the horizontal offset is read.
 svg.addEventListener('touchstart',e=>{const t=e.changedTouches[0];press(t.identifier,t.clientX);});
 svg.addEventListener('touchmove',e=>{for(let i=0;i<e.changedTouches.length;i++)move(e.changedTouches[i].identifier,e.changedTouches[i].clientX);});
 svg.addEventListener('touchend',release);svg.addEventListener('touchcancel',cancel);
 svg.addEventListener('mousedown',e=>{if(e.button===0)press('mouse',e.clientX);});
 addEventListener('mousemove',e=>move('mouse',e.clientX));addEventListener('mouseup',()=>{if(drag&&drag.id==='mouse')release();});
}
function start(data){
 const glyphs=new Map(data.glyphs.map(entry=>[entry[0],{character:entry[0],paths:entry[1],width:entry[2],advance:entry[3]}]));
 const initial=formatClock(new Date()).ascii,slots=Array.from(initial).map(character=>({character,current:glyphs.get(character),previous:null,started:performance.now()/1000}));
 const rowSizes=[.45,1.1,.65,2,.3,1.5,.8,.4,1.8,.6,1,.35,1.3],rows=rowSizes.map((size,i)=>({size,phase:i*.19,speed:Math.max(1,1/size)}));
 let current=initial,width,scale;
 function resize(){width=innerWidth;scale=Math.min(width/1900,innerHeight/3100);const total=rows.reduce((sum,row)=>sum+400*scale*row.size+4,0),height=Math.max(innerHeight,total+70);svg.style.height=height+'px';svg.setAttribute('viewBox','0 0 '+width+' '+height);while(svg.firstChild)svg.removeChild(svg.firstChild);let y=(height-total)/2;
  for(const row of rows){row.scale=scale*row.size;row.y=y;y+=400*row.scale+4;row.period=1780*row.scale;row.copies=Array.from({length:Math.ceil(width/row.period)+3},()=>Array.from({length:8},()=>{const g=create('g');svg.appendChild(g);return g;}));}
 }
 resize();addEventListener('resize',resize);
 function draw(now){
  const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
  if(!drag){const m=coast(velocity,dt);manualOffset+=m.distance;velocity=m.velocity;distance+=dt*width*.025;}
  const time=formatClock(new Date()).ascii;if(time!==current){current=time;Array.from(time).forEach((ch,i)=>{const slot=slots[i];if(slot.character===ch)return;slot.previous=slot.current;slot.current=glyphs.get(ch);slot.character=ch;slot.started=now/1000;});svg.setAttribute('aria-label',current);}
  const frames=slots.map(slot=>{const progress=transitionProgress(now/1000,slot.started);const layers=clockLayers(slot.current,slot.previous,progress).map(layer=>layer.visible?clockGlyphFrame(layer.glyph,layer.amount):null);if(progress>=1)slot.previous=null;return layers;});
  for(const row of rows){const offset=((distance*row.speed+manualOffset+row.phase*row.period)%row.period+row.period)%row.period;
   row.copies.forEach((holders,copy)=>holders.forEach((holder,i)=>{
    // childNodes, not children: older engines lack children on SVG elements.
    while(holder.childNodes.length<2)holder.appendChild(create('g'));
    frames[i].forEach((glyphFrame,l)=>{const group=holder.childNodes[l];group.setAttribute('visibility',glyphFrame?'visible':'hidden');if(!glyphFrame)return;group.setAttribute('opacity',glyphFrame.opacity);
     while(group.childNodes.length<glyphFrame.paths.length){const node=create('path');node.setAttribute('stroke-width',Math.max(1.3,Math.min(2.8,width/500)));group.appendChild(node);}
     for(let s=0;s<group.childNodes.length;s++){const path=glyphFrame.paths[s];group.childNodes[s].setAttribute('d',path&&path.length>1?path.map((p,j)=>(j?'L':'M')+((p.x+glyphFrame.offset+i*200)*row.scale+offset+(copy-1)*row.period)+','+(p.y*row.scale+row.y)).join(' '):'');}
    });
   }));
  }frame(draw);
 }svg.setAttribute('aria-label',current);frame(draw);
}
fetch('/font/clock-skeletons.json').then(response=>{if(!response.ok)throw Error(response.status);return response.json();}).then(start).catch(e=>{document.querySelector('#error').textContent='読み込みに失敗しました：'+e.message;});
