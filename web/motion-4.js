import {layoutText} from './text-spacing.js';
import {scheduleLetters} from './transition-spacing.js';
import {SourceEngine} from './source-engine.js';
import {prepareGlyph} from './motion-library.js';
import {coast} from './walk-core.js';





const [program,glyphs,ascii,alpha,story]=await Promise.all(['source-program.json','source-glyphs.json','font/ascii-outlines.json','font/alpha-centerlines.json','night-one.json'].map(async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw new Error('Failed to load '+path);return response.json();}));
const engine=new SourceEngine(program,glyphs,ascii,alpha);
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
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
 const dpr=Math.min(devicePixelRatio,2);canvas.width=width*dpr;canvas.height=height*dpr;
 canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);

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
 const envelope=[];
 for(let i=0;i<=(glyph.outlineOnly?0:32);i++)for(const piece of engine.closeLoopPaths(glyph,i/32)){
  for(const point of piece.path)envelope.push(point.x-(piece.dotWidth??0)/2,point.x+(piece.dotWidth??0)/2);
 }
 const value={glyph,rest,left,width:right-left,minX:Math.min(...envelope)-8,maxX:Math.max(...envelope)+8};cache.set(character,value);return value;
}
function spawn(at){
 const characters=[...story.phrases[index]];
 const {positions,width:advance}=layoutText(characters,getGlyph);
 const sentence={characters,positions,width:advance,born:at};
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
}

function draw(now){
 const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
 if(!document.hidden&&!reduced){time+=dt;if(!drag){const m=coast(velocity,dt);manualOffset+=m.distance;velocity=m.velocity;drift+=dt*width*.025;}}
 if(time>=next)spawn(next);active=active.filter(s=>time<=s.end);
 ctx.clearRect(0,0,width,height);ctx.strokeStyle=ctx.fillStyle='#111';ctx.lineCap=ctx.lineJoin='round';
 const frameGeometry=new Map();
 const total=rows.reduce((n,r,i)=>n+(rowBounds[i].bottom-rowBounds[i].top)*scale*r[0],0)+4*(rows.length-1);let y=(height-total)/2;
 for(const [rowIndex,[multiplier,speed]] of rows.entries()){
  const rowScale=scale*multiplier,rowHeight=(rowBounds[rowIndex].bottom-rowBounds[rowIndex].top)*rowScale,centerY=y+rowHeight/2;y+=rowHeight+4;
  const driftX=-drift*speed+manualOffset;
  ctx.lineWidth=Math.max(1.4,Math.min(3,width/450));
  for(const sentence of active){
   const period=(sentence.width+180)*rowScale;
   const offset=((driftX%period)+period)%period;
   const timing=sentence.timing[rowIndex];
   const letters=sentence.characters.map((character,i)=>{
    const enter=clamp((time-timing.births[i])/duration),exit=clamp((time-timing.out-i*stagger)/duration),progress=exit>0?1-exit:enter;
    if(progress<=0)return null;
    const data=getGlyph(character),key=character+':'+progress;
    if(data.glyph.outlineOnly){
     if(!data.outlinePath)data.outlinePath=new Path2D(data.glyph.restEntries.map(c=>c.d).join(' '));
     if(progress>=.55)return {outline:data.outlinePath};
     if(!frameGeometry.has(key)){
      const image=document.createElement('canvas');image.width=image.height=800;
      const mask=image.getContext('2d');mask.scale(2,2);
      const t=clamp(progress/.55),reveal=t*t*(3-2*t);
      mask.strokeStyle='#fff';mask.lineWidth=96;mask.lineCap=mask.lineJoin='round';
      data.glyph.restEntries.forEach((contour,j)=>{
       const points=data.rest[j].path;
       const length=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
       mask.setLineDash([length,length]);mask.lineDashOffset=length*(1-reveal);
       mask.stroke(new Path2D(contour.d));
      });
      mask.globalCompositeOperation='source-in';mask.fillStyle='#111';mask.fill(data.outlinePath,'evenodd');
      frameGeometry.set(key,image);
     }
     return {outline:data.outlinePath,image:frameGeometry.get(key)};
    }
    if(!frameGeometry.has(key))frameGeometry.set(key,progress===1?data.rest:engine.closeLoopPaths(data.glyph,1-progress));
    return {pieces:frameGeometry.get(key)};
   });
   for(let copy=-1;copy<Math.ceil(width/period)+1;copy++)letters.forEach((letter,i)=>{
    if(!letter)return;
    const baseX=sentence.positions[i];
    if(letter.outline){
     // Match index's outline-following reveal mask, preserving contour holes.
     ctx.save();ctx.translate(baseX*rowScale+offset+copy*period,centerY-200*rowScale);ctx.scale(rowScale,rowScale);
     if(letter.image)ctx.drawImage(letter.image,0,0,400,400);
     else ctx.fill(letter.outline,'evenodd');
     ctx.restore();return;
    }
    for(let s=0;s<letter.pieces.length;s++){
     const piece=letter.pieces[s];
     const point=p=>({x:(p.x+baseX)*rowScale+offset+copy*period,y:centerY+(p.y-200)*rowScale});
     if(piece.dotWidth){const p=point(piece.path[0],0),r=piece.dotWidth/2*rowScale,ry=r*piece.dotScale;if(ry>0){ctx.beginPath();ctx.ellipse(p.x,p.y+r-ry,r,ry,0,0,Math.PI*2);ctx.fill();}continue;}
     ctx.beginPath();piece.path.forEach((p,k)=>{const q=point(p,k);if(k)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.stroke();
    }
   });
  }
 }
 requestAnimationFrame(draw);
}
spawn(0);if(reduced)time=active[0].timing[0].out-.01;requestAnimationFrame(draw);
