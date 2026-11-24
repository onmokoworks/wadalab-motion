// Flowing clock page. Kept to old-browser-safe syntax and DOM calls: this file
// is also bundled into clock-flow-legacy.js for browsers without ES modules.
import {coast} from '/walk-core.js';
import {formatClock,transitionProgress} from '/clock-core.js';
import {clockGlyphFrame,clockLayers} from '/clock-flow-core.js';
const stage=document.querySelector('canvas');
const frame=window.requestAnimationFrame?callback=>requestAnimationFrame(callback):callback=>setTimeout(()=>callback(performance.now()),16);
let drag=null,manualOffset=0,velocity=0,lastFrame=performance.now(),distance=0;
function press(id,x){drag={id,x,time:performance.now()};velocity=0;}
function move(id,x){if(!drag||drag.id!==id)return;const now=performance.now(),dx=x-drag.x,dt=(now-drag.time)/1000;manualOffset+=dx;if(dt>0)velocity=.3*velocity+.7*Math.max(-2400,Math.min(2400,dx/dt));drag={id,x,time:now};}
function release(){if(drag&&performance.now()-drag.time>100)velocity=0;drag=null;}
function cancel(){drag=null;velocity=0;}
if(window.PointerEvent){
 stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(stage.setPointerCapture)stage.setPointerCapture(e.pointerId);press(e.pointerId,e.clientX);});
 stage.addEventListener('pointermove',e=>move(e.pointerId,e.clientX));
 stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',cancel);
}else{
 // Vertical page scrolling stays native; only the horizontal offset is read.
 stage.addEventListener('touchstart',e=>{const t=e.changedTouches[0];press(t.identifier,t.clientX);});
 stage.addEventListener('touchmove',e=>{for(let i=0;i<e.changedTouches.length;i++)move(e.changedTouches[i].identifier,e.changedTouches[i].clientX);});
 stage.addEventListener('touchend',release);stage.addEventListener('touchcancel',cancel);
 stage.addEventListener('mousedown',e=>{if(e.button===0)press('mouse',e.clientX);});
 addEventListener('mousemove',e=>move('mouse',e.clientX));addEventListener('mouseup',()=>{if(drag&&drag.id==='mouse')release();});
}
function start(data){
 const glyphs=new Map(data.glyphs.map(entry=>[entry[0],{character:entry[0],paths:entry[1],width:entry[2],advance:entry[3]}]));
 const initial=formatClock(new Date()).ascii,slots=Array.from(initial).map(character=>({character,current:glyphs.get(character),previous:null,started:performance.now()/1000,settled:false,layers:[]}));
 const rowSizes=[.45,1.1,.65,2,.3,1.5,.8,.4,1.8,.6,1,.35,1.3],rows=rowSizes.map((size,i)=>({size,phase:i*.19,speed:Math.max(1,1/size)}));
 const context=stage.getContext('2d'),color=getComputedStyle(stage).color,space=document.querySelector('#space');
 let current=initial,width,view,scale,ratio,lineWidth,resting=null,moving=[];
 // One clock string is kept as polylines in glyph units and rebuilt only while
 // a digit is changing. Each frame strokes it once per visible repeat; resting
 // digits share a single path so a repeat is one stroke call.
 function shape(lines){
  if(window.Path2D){const path=new Path2D();for(const line of lines){path.moveTo(line[0],line[1]);for(let i=2;i<line.length;i+=2)path.lineTo(line[i],line[i+1]);}return path;}
  return lines;
 }
 function stroke(path){
  if(window.Path2D){context.stroke(path);return;}
  context.beginPath();for(const line of path){context.moveTo(line[0],line[1]);for(let i=2;i<line.length;i+=2)context.lineTo(line[i],line[i+1]);}context.stroke();
 }
 function resize(){
  // Narrow screens size the rows by width. Wide ones use twice the size their
  // height alone would give: larger digits mean fewer repeats to stroke.
  width=innerWidth;view=innerHeight;scale=Math.min(width/1900,2*view/3100);const total=rows.reduce((sum,row)=>sum+400*scale*row.size+4,0),height=Math.max(view,total+70);
  // Above two device pixels per CSS pixel the hairlines gain little and the fill cost grows fast.
  ratio=Math.min(window.devicePixelRatio||1,2);lineWidth=Math.max(1.3,Math.min(2.8,width/500));
  // The canvas covers only the screen; the spacer gives the page its scroll height.
  space.style.height=height+'px';stage.style.height=view+'px';stage.width=Math.round(width*ratio);stage.height=Math.round(view*ratio);
  let y=(height-total)/2;for(const row of rows){row.scale=scale*row.size;row.y=y;y+=400*row.scale+4;row.period=1780*row.scale;row.count=Math.ceil(width/row.period)+3;}
 }
 resize();addEventListener('resize',()=>{resize();if(resting)paint();});
 function draw(){
  // One clock for everything: frame timestamps and performance.now() can disagree.
  const now=performance.now();
  const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
  if(!drag){const m=coast(velocity,dt);manualOffset+=m.distance;velocity=m.velocity;distance+=dt*width*.025;}
  const time=formatClock(new Date()).ascii;if(time!==current){current=time;Array.from(time).forEach((ch,i)=>{const slot=slots[i];if(slot.character===ch)return;slot.previous=slot.current;slot.current=glyphs.get(ch);slot.character=ch;slot.started=now/1000;slot.settled=false;});stage.setAttribute('aria-label',current);}
  slots.forEach((slot,i)=>{
   if(slot.settled)return;
   const progress=transitionProgress(now/1000,slot.started);
   slot.layers=clockLayers(slot.current,slot.previous,progress).filter(layer=>layer.visible).map(layer=>{
    const glyphFrame=clockGlyphFrame(layer.glyph,layer.amount),shift=glyphFrame.offset+i*200,lines=[];
    for(const path of glyphFrame.paths){if(path.length<2)continue;const line=[];for(const p of path)line.push(p.x+shift,p.y);lines.push(line);}
    return {opacity:glyphFrame.opacity,lines};
   });
   if(progress>=1){slot.previous=null;slot.settled=true;}
   resting=null;
  });
  if(!resting)resting=shape(slots.reduce((all,slot)=>slot.settled?all.concat(slot.layers[0].lines):all,[]));
  moving=[];for(const slot of slots)if(!slot.settled)for(const layer of slot.layers)if(layer.opacity>0&&layer.lines.length)moving.push({opacity:layer.opacity,path:shape(layer.lines)});
  paint();frame(draw);
 }
 // Also runs straight after a resize, which clears the canvas.
 function paint(){
  const top=window.pageYOffset||0;
  context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,stage.width,stage.height);
  context.strokeStyle=color;context.lineCap='round';context.lineJoin='round';
  for(const row of rows){
   const y=row.y-top,tall=400*row.scale;if(y>view+tall*.25||y+tall*1.25<0)continue;
   const offset=((distance*row.speed+manualOffset+row.phase*row.period)%row.period+row.period)%row.period,zoom=row.scale*ratio;
   // Dividing by the row scale keeps the stroke the same width in every row.
   context.lineWidth=lineWidth/row.scale;
   for(let copy=0;copy<row.count;copy++){
    const x=offset+(copy-1)*row.period;if(x>width+row.period*.2||x+row.period*1.2<0)continue;
    context.setTransform(zoom,0,0,zoom,x*ratio,y*ratio);
    context.globalAlpha=1;stroke(resting);
    for(const layer of moving){context.globalAlpha=layer.opacity;stroke(layer.path);}
   }
  }
 }stage.setAttribute('aria-label',current);frame(draw);
}
fetch('/font/clock-skeletons.json').then(response=>{if(!response.ok)throw Error(response.status);return response.json();}).then(start).catch(e=>{document.querySelector('#error').textContent='読み込みに失敗しました：'+e.message;});
