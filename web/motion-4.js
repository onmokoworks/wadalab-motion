import {layoutText} from './text-spacing.js';
import {scheduleLetters} from './transition-spacing.js';
import {SourceEngine} from './source-engine.js';
import {prepareGlyph} from './motion-library.js';
import {coast} from './walk-core.js';





const [program,glyphs,ascii,alpha,story]=await Promise.all(['source-program.json','source-glyphs.json','font/ascii-outlines.json','font/alpha-centerlines.json','night-one.json'].map(async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error('Failed to load '+path);return response.json();}));
const engine=new SourceEngine(program,glyphs,ascii,alpha);
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const spacer=document.createElement('div');spacer.setAttribute('aria-hidden','true');document.body.append(spacer);
Object.assign(canvas.style,{position:'fixed',top:'0',left:'0'});
const maskPool=[];let masksUsed=0;
const sprites=new Map();let spriteBytes=0,pixelRatio=1;
const spriteBudget=64*1024*1024;
const clamp=v=>Math.max(0,Math.min(1,v)),cache=new Map();
// Varied row sizes, with bounded right-to-left drift; no glyph stretching.
const rows=[[.95,1],[.48,1.7],[.82,.85],[1.6,.7],[.18,2.4],[1.35,.9],[.62,2.1],[1.05,1.15],[.78,1.5],[1.45,.8],[.38,2.2],[.88,1.3],[1.15,.95],[.55,1.9]];
const duration=.48,stagger=.10,hold=.7;
const referenceTexts=["TEST","onmk.work","MOTION","Wadalab font","The quick brown fox jumps over the lazy dog","The","quick","brown","fox","jumps","over","the","lazy","dog"];
const rowBounds=referenceTexts.map(text=>{const points=[...text].filter(c=>c!==" ").flatMap(c=>getGlyph(c).rest.flatMap(p=>p.dotWidth?[{y:p.path[0].y},{y:p.path[0].y+p.dotWidth}]:p.path));return {top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};});
let time=0,last=0,active=[],index=0,next=0,width=0,height=0,scale=0;
let manualOffset=0,velocity=0,drag=null,drift=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){
 width=innerWidth;scale=Math.min(width/2400,innerHeight/2600);
 const total=rows.reduce((n,r,i)=>n+(rowBounds[i].bottom-rowBounds[i].top)*scale*r[0],0)+4*(rows.length-1);
 height=Math.max(innerHeight,total+90);
 sprites.clear();spriteBytes=0;
 const dpr=pixelRatio=Math.min(devicePixelRatio,2);canvas.width=width*dpr;canvas.height=innerHeight*dpr;
 canvas.style.height=innerHeight+'px';spacer.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);

}
addEventListener('resize',resize);resize();
canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,time:performance.now()};velocity=0;canvas.style.cursor='grabbing';});
canvas.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const now=performance.now(),dx=event.clientX-drag.x,dt=(now-drag.time)/1000;manualOffset+=dx;if(dt>0)velocity=velocity*.3+Math.max(-2400,Math.min(2400,dx/dt))*.7;drag={id:drag.id,x:event.clientX,time:now};});
function release(event){if(!drag||drag.id!==event.pointerId)return;if(performance.now()-drag.time>100)velocity=0;drag=null;canvas.style.cursor='grab';}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',event=>{velocity=0;release(event);});
function getGlyph(character){
 if(cache.has(character))return cache.get(character);
 const glyph=prepareGlyph(engine,character),rest=engine.closeLoopPaths(glyph,0);
 const xs=rest.flatMap(p=>p.dotWidth?[p.path[0].x-p.dotWidth/2,p.path[0].x+p.dotWidth/2]:p.path.map(q=>q.x));
 const left=Math.min(...xs),right=Math.max(...xs);
 const envelope=[],vertical=[];
 for(let i=0;i<=(glyph.outlineOnly?0:32);i++)for(const piece of engine.closeLoopPaths(glyph,i/32)){
  for(const point of piece.path){envelope.push(point.x-(piece.dotWidth??0)/2,point.x+(piece.dotWidth??0)/2);vertical.push(point.y,point.y+(piece.dotWidth??0));}
 }
 const value={glyph,rest,left,width:right-left,minX:Math.min(...envelope)-8,maxX:Math.max(...envelope)+8,minY:Math.min(...vertical)-16,maxY:Math.max(...vertical)+16};cache.set(character,value);return value;
}
let warmupPending=false;
function prewarmNext(){
 if(warmupPending||typeof requestIdleCallback!=='function')return;
 const queue=[...new Set(story.phrases[index])].filter(c=>!cache.has(c));
 if(!queue.length)return;
 warmupPending=true;
 const work=deadline=>{
  // At most one glyph per idle callback; never batch a sentence on a frame.
  if(deadline.timeRemaining()>5)getGlyph(queue.shift());
  if(queue.length)requestIdleCallback(work);else warmupPending=false;
 };
 requestIdleCallback(work);
}
function spawn(at){
 const characters=[...story.phrases[index]];
 const {positions,width:advance}=layoutText(characters,getGlyph);
 const sentence={characters,positions,width:advance,born:at,minY:Math.min(...characters.map(c=>getGlyph(c).minY)),maxY:Math.max(...characters.map(c=>getGlyph(c).maxY))};
 const extent=(text,rowScale)=>text.characters.map((c,i)=>{const g=getGlyph(c);return [(g.minX+text.positions[i])*rowScale,(g.maxX+text.positions[i])*rowScale];});
 sentence.timing=rows.map(([multiplier,speed],r)=>{
  const rowScale=scale*multiplier;
  const old=active.filter(s=>s.timing[r].end>at);
  const horizon=Math.max(at,...old.map(s=>s.timing[r].end))-at;
  const births=scheduleLetters({bounds:extent(sentence,rowScale),period:(advance+180)*rowScale,
   old:old.map(s=>({bounds:extent(s,rowScale),period:(s.width+180)*rowScale,ends:s.characters.map((_,i)=>s.timing[r].out+i*stagger+duration)})),
   width,shift:-drift*speed+manualOffset,travel:width*.025*speed*horizon+Math.abs(velocity)*horizon,
   start:at,stagger});
  const out=births.at(-1)+duration+hold;
  return {births,out,end:out+(characters.length-1)*stagger+duration};
 });
 sentence.end=Math.max(...sentence.timing.map(r=>r.end));active.push(sentence);
 next=Math.min(...sentence.timing.map(r=>r.out+duration+stagger));index=(index+1)%story.phrases.length;
 canvas.setAttribute('aria-label',story.phrases[(index+story.phrases.length-1)%story.phrases.length]);
 prewarmNext();
}

function compilePaths(pieces){
 const stroke=new Path2D(),dots=new Path2D();let hasStroke=false,hasDots=false;
 for(const piece of pieces){
  if(piece.dotWidth){const p=piece.path[0],r=piece.dotWidth/2,ry=r*piece.dotScale;if(ry>0){dots.moveTo(p.x+r,p.y+r-ry);dots.ellipse(p.x,p.y+r-ry,r,ry,0,0,Math.PI*2);hasDots=true;}continue;}
  piece.path.forEach((p,i)=>{if(i)stroke.lineTo(p.x,p.y);else stroke.moveTo(p.x,p.y);});hasStroke=true;
 }
 return {stroke,dots,hasStroke,hasDots};
}
function renderGlyph(data,progress,frameGeometry,character){
 if(!data.glyph.outlineOnly&&progress===1)return data.renderPaths??=compilePaths(data.rest);
 const key=character+':'+progress;
 if(frameGeometry.has(key))return frameGeometry.get(key);
 let result;
 if(data.glyph.outlineOnly){
  if(!data.outlinePath){
   data.outlinePath=new Path2D(data.glyph.restEntries.map(c=>c.d).join(' '));
   data.outlineContours=data.glyph.restEntries.map((c,j)=>({path:new Path2D(c.d),length:data.rest[j].path.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-data.rest[j].path[i].x,p.y-data.rest[j].path[i].y),0)}));
  }
  if(progress>=.55)return {outline:data.outlinePath};
  let image=maskPool[masksUsed++];
  if(!image){image=document.createElement('canvas');image.width=image.height=800;maskPool.push(image);}
  const mask=image.getContext('2d');mask.setTransform(2,0,0,2,0,0);mask.globalCompositeOperation='source-over';mask.clearRect(0,0,400,400);
  const t=clamp(progress/.55),reveal=t*t*(3-2*t);
  mask.strokeStyle='#fff';mask.lineWidth=96;mask.lineCap=mask.lineJoin='round';
  for(const contour of data.outlineContours){mask.setLineDash([contour.length,contour.length]);mask.lineDashOffset=contour.length*(1-reveal);mask.stroke(contour.path);}
  mask.globalCompositeOperation='source-in';mask.fillStyle='#111';mask.fill(data.outlinePath,'evenodd');
  result={outline:data.outlinePath,image};
 }else result=compilePaths(engine.closeLoopPaths(data.glyph,1-progress));
 frameGeometry.set(key,result);return result;
}
// Rasterize completed glyphs once at their actual display resolution. Moving a
// bitmap avoids tessellating and antialiasing hundreds of curved paths per frame.
// LRU bounds storage across the whole story; resizing invalidates every sprite.
function restSprite(data,character,rowScale,lineWidth,letter){
 const key=character+':'+rowScale;
 if(sprites.has(key)){const cached=sprites.get(key);sprites.delete(key);sprites.set(key,cached);return cached;}
 const points=data.rest.flatMap(p=>p.dotWidth?
  [{x:p.path[0].x-p.dotWidth/2,y:p.path[0].y},{x:p.path[0].x+p.dotWidth/2,y:p.path[0].y+p.dotWidth}]:p.path);
 if(!points.length)return null;
 const pad=lineWidth/2+2/pixelRatio;
 const x=Math.floor((Math.min(...points.map(p=>p.x))*rowScale-pad)*pixelRatio)/pixelRatio;
 const y=Math.floor((Math.min(...points.map(p=>p.y))*rowScale-pad)*pixelRatio)/pixelRatio;
 const w=Math.ceil((Math.max(...points.map(p=>p.x))*rowScale+pad-x)*pixelRatio);
 const h=Math.ceil((Math.max(...points.map(p=>p.y))*rowScale+pad-y)*pixelRatio);
 const bytes=w*h*4;
 if(w<=0||h<=0||bytes>spriteBudget)return null;
 while(spriteBytes+bytes>spriteBudget&&sprites.size){const oldest=sprites.keys().next().value;spriteBytes-=sprites.get(oldest).bytes;sprites.delete(oldest);}
 const image=document.createElement('canvas');image.width=w;image.height=h;
 const pen=image.getContext('2d');
 pen.setTransform(pixelRatio*rowScale,0,0,pixelRatio*rowScale,-x*pixelRatio,-y*pixelRatio);
 pen.strokeStyle=pen.fillStyle='#111';pen.lineCap=pen.lineJoin='round';pen.lineWidth=lineWidth/rowScale;
 if(letter.outline)pen.fill(letter.outline,'evenodd');
 else{if(letter.hasStroke)pen.stroke(letter.stroke);if(letter.hasDots)pen.fill(letter.dots);}
 const result={image,x,y,width:w/pixelRatio,height:h/pixelRatio,bytes};
 sprites.set(key,result);spriteBytes+=bytes;return result;
}
function draw(now){
 const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
 if(document.hidden){requestAnimationFrame(draw);return;}
 if(!reduced){time+=dt;if(!drag){const m=coast(velocity,dt);manualOffset+=m.distance;velocity=m.velocity;drift+=dt*width*.025;}}
 if(time>=next)spawn(next);active=active.filter(s=>time<=s.end);
 ctx.clearRect(0,0,width,innerHeight);ctx.strokeStyle=ctx.fillStyle='#111';ctx.lineCap=ctx.lineJoin='round';
 const frameGeometry=new Map();masksUsed=0;
 const total=rows.reduce((n,r,i)=>n+(rowBounds[i].bottom-rowBounds[i].top)*scale*r[0],0)+4*(rows.length-1);let y=(height-total)/2;
 const minY=Math.min(0,...active.map(s=>s.minY)),maxY=Math.max(400,...active.map(s=>s.maxY));
 const lineWidth=Math.max(1.4,Math.min(3,width/450));
 for(const [rowIndex,[multiplier,speed]] of rows.entries()){
  const rowScale=scale*multiplier,rowHeight=(rowBounds[rowIndex].bottom-rowBounds[rowIndex].top)*rowScale,centerY=y+rowHeight/2-scrollY;y+=rowHeight+4;
  // The viewport canvas preserves page scrolling without painting unseen rows.
  if(centerY+(maxY-200)*rowScale+lineWidth<0||centerY+(minY-200)*rowScale-lineWidth>innerHeight)continue;
  const driftX=-drift*speed+manualOffset;
  for(const sentence of active){
   const period=(sentence.width+180)*rowScale,offset=((driftX%period)+period)%period,timing=sentence.timing[rowIndex];
   sentence.characters.forEach((character,i)=>{
    const enter=clamp((time-timing.births[i])/duration),exit=clamp((time-timing.out-i*stagger)/duration),progress=exit>0?1-exit:enter;
    if(progress<=0)return;
    const data=getGlyph(character),baseX=sentence.positions[i]*rowScale+offset;
    // Include both contour and stroke extents; never cut a partially visible glyph.
    const left=baseX+data.minX*rowScale-lineWidth,right=baseX+data.maxX*rowScale+lineWidth;
    const first=Math.ceil(-right/period),lastCopy=Math.floor((width-left)/period);
    if(first>lastCopy)return;
    const letter=renderGlyph(data,progress,frameGeometry,character);
    const sprite=progress===1?restSprite(data,character,rowScale,lineWidth,letter):null;
    for(let copy=first;copy<=lastCopy;copy++){
     if(sprite){ctx.drawImage(sprite.image,baseX+copy*period+sprite.x,centerY-200*rowScale+sprite.y,sprite.width,sprite.height);continue;}
     ctx.save();ctx.translate(baseX+copy*period,centerY-200*rowScale);ctx.scale(rowScale,rowScale);
     if(letter.outline){if(letter.image)ctx.drawImage(letter.image,0,0,400,400);else ctx.fill(letter.outline,'evenodd');}
     else{ctx.lineWidth=lineWidth/rowScale;if(letter.hasStroke)ctx.stroke(letter.stroke);if(letter.hasDots)ctx.fill(letter.dots);}
     ctx.restore();
    }
   });
  }
 }
 requestAnimationFrame(draw);
}
spawn(0);if(reduced)time=active[0].timing[0].out-.01;requestAnimationFrame(draw);
