import {buildTrimMap,clamp} from './fold-core.js';
import {motion} from './motion-config.js';
import {analyze,plan,posedPaths,posedDots,trimPath,relaySchedule,relayPaths} from './structure.js';
const preparedGlyphs=new Map();

export function glyphImage(text){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 let size=210;ctx.font=`${size}px WadalabActual`;let m=ctx.measureText(text);
 const width=m.actualBoundingBoxLeft+m.actualBoundingBoxRight,height=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
 size*=Math.min(1,210/Math.max(1,width),210/Math.max(1,height));ctx.font=`${size}px WadalabActual`;m=ctx.measureText(text);
 ctx.fillStyle='#111';ctx.fillText(text,(256-m.actualBoundingBoxRight+m.actualBoundingBoxLeft)/2,(256+m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2);
 const rgba=ctx.getImageData(0,0,256,256).data,alpha=new Uint8Array(256*256);for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
 return {canvas,alpha,advance:Math.max(.15,m.width/size),pixelFontSize:size,centerX:(m.actualBoundingBoxRight-m.actualBoundingBoxLeft)/(2*size),centerY:(m.actualBoundingBoxDescent-m.actualBoundingBoxAscent)/(2*size)};
}

export class FoldRenderer {
 constructor(canvas,options={}){
  if(options.structural)return new LineRenderer(canvas,options);
  this.options=options;this.variant=options.variant??0;this.duration=options.duration??motion.duration;this.stagger=options.stagger??motion.stagger;
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('WebGLを利用できません。');
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const program=this.program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 position;attribute vec2 uv;uniform vec2 resolution;varying vec2 texcoord;void main(){gl_Position=vec4(position.x/resolution.x*2.0-1.0,1.0-position.y/resolution.y*2.0,0,1);texcoord=uv;}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;
uniform sampler2D mask;uniform float progress;uniform float variant;varying vec2 texcoord;
void main(){vec4 m=texture2D(mask,texcoord);float t=m.r;float p=progress;float softness=.003;
if(variant==1.0)t=1.0-t;
if(variant==2.0)t=min(t,1.0-t)*2.0;
if(variant==3.0)t=fract(min(t,.999)*4.0);
if(variant==4.0)p=floor(p*6.0)/6.0;
if(variant==5.0)p=1.0-pow(1.0-p,3.0);
if(variant==8.0)softness=.10;
if(variant==9.0){float group=floor(min(t,.999)*4.0);t=fract(min(t,.999)*4.0);p=clamp((p-group*.10)/.70,0.0,1.0);}
float reveal=progress>=1.0?1.0:progress<=0.0?0.0:1.0-smoothstep(p-softness,p+softness,t);
gl_FragColor=vec4(vec3(0.0666667),m.a*reveal);}`));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,'variant'),this.variant);this.position=gl.getAttribLocation(program,'position');this.uv=gl.getAttribLocation(program,'uv');this.progress=gl.getUniformLocation(program,'progress');this.resolution=gl.getUniformLocation(program,'resolution');gl.enableVertexAttribArray(this.position);gl.enableVertexAttribArray(this.uv);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(1,1,1,1);this.cache=new Map();this.items=[];this.time=0;
 }
 make(text){
  if(this.cache.has(text))return this.cache.get(text);
  let prepared=preparedGlyphs.get(text);
  if(!prepared){const image=glyphImage(text),trim=buildTrimMap(image.alpha,256,256),pixels=image.canvas.getContext('2d').getImageData(0,0,256,256);for(let i=0;i<trim.length;i++)pixels.data[i*4]=Math.round(trim[i]*255);prepared={...image,pixels};preparedGlyphs.set(text,prepared);if(preparedGlyphs.size>100)preparedGlyphs.delete(preparedGlyphs.keys().next().value);}
  const {alpha,advance,pixelFontSize,centerX,centerY,pixels}=prepared,gl=this.gl;
  if(!alpha.some(v=>v>0))return null;
  const strategy=null,rig={vertices:[{x:0,y:0,u:0,v:0},{x:256,y:0,u:1,v:0},{x:0,y:256,u:0,v:1},{x:256,y:256,u:1,v:1}],indices:[0,2,1,1,2,3]};
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,256,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels.data);
  const buffer=(target,data)=>{const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;};
  const glyph={text,rig,strategy,texture,advance,pixelFontSize,centerX,centerY,positions:new Float32Array(rig.vertices.length*2),screen:new Float32Array(rig.vertices.length*2),positionBuffer:gl.createBuffer(),uvBuffer:buffer(gl.ARRAY_BUFFER,new Float32Array(rig.vertices.flatMap(v=>[v.u,v.v]))),indexBuffer:buffer(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(rig.indices)),alpha};
  this.cache.set(text,glyph);return glyph;
 }
 async setText(text,isCurrent=()=>true,now=null){
  const segments=[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(text)].map(x=>x.segment),previous=this.items,next=new Array(segments.length);let prefix=0;
  while(prefix<previous.length&&prefix<segments.length&&previous[prefix].segment===segments[prefix]){next[prefix]=previous[prefix];prefix++;}
  let suffix=0;while(suffix<previous.length-prefix&&suffix<segments.length-prefix&&previous[previous.length-1-suffix].segment===segments[segments.length-1-suffix]){next[segments.length-1-suffix]=previous[previous.length-1-suffix];suffix++;}
  const started=(typeof now==='function'?now():now)??performance.now()/1000,appendOnly=prefix===previous.length&&suffix===0,last=segments.length-suffix;let nextBorn=Math.max(started,prefix?previous[prefix-1].born+this.stagger:started);
  let sliceStart=performance.now();for(let i=prefix;i<last;i++){
   if(!isCurrent())return;const segment=segments[i],glyph=/^\s+$/u.test(segment)?null:this.make(segment),current=(typeof now==='function'?now():now)??performance.now()/1000,born=Math.max(nextBorn,current);next[i]={glyph,segment,born};nextBorn=born+this.stagger;
   if(performance.now()-sliceStart>8){if(appendOnly){this.items=next.slice(0,i+1);this.layout();}await new Promise(requestAnimationFrame);sliceStart=performance.now();}
  }
  if(isCurrent()){
   for(let i=1;i<next.length;i++){const earliest=next[i-1].born+this.stagger;if(next[i].born<earliest)next[i]={...next[i],born:earliest};}
   this.items=next;this.layout();this.prune();
  }
 }
 replay(now=performance.now()/1000){this.items.forEach((item,i)=>item.born=now+i*this.stagger);this.layout();}
 prune(){
  const keep=new Set(this.items.map(i=>i.segment));
  for(const [key,g] of this.cache){if(this.cache.size<=80)break;if(keep.has(key))continue;this.gl.deleteTexture(g.texture);for(const b of [g.positionBuffer,g.uvBuffer,g.indexBuffer])this.gl.deleteBuffer(b);this.cache.delete(key);}
 }
 layout(){
  this.dirty=true;
  const rect=this.options.fontSize?this.canvas.parentElement.getBoundingClientRect():this.canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);this.width=rect.width;this.height=rect.height;this.canvas.width=Math.round(rect.width*dpr);this.canvas.height=Math.round(rect.height*dpr);
  const pad=this.options.pad??(this.options.compact?10:this.width<600?20:32),top=this.options.top??(this.options.compact?14:72);let size=this.options.fontSize??(this.options.compact?Math.min(52,this.width/4.7):this.width<600?motion.mobileFontSize:motion.fontSize);
  const makeRows=s=>{const rows=[[]];let width=0;for(const [sourceIndex,item] of this.items.entries()){const advance=s*(item.glyph?item.glyph.advance:.5)+s*.06;if(item.segment==='\n'){rows.push([]);width=0;continue;}if(width+advance>this.width-pad*2&&rows.at(-1).length){rows.push([]);width=0;}rows.at(-1).push({...item,sourceIndex,advance});width+=advance;}return rows;};
  let rows=makeRows(size);while(!this.options.fontSize&&rows.length*size*1.35>this.height-top-pad&&size>14){size*=.92;rows=makeRows(size);}this.placed=[];
  if(this.options.fontSize){
   this.contentHeight=Math.max(this.height,rows.length*size*1.35+top+pad);
   this.canvas.style.height=`${this.height}px`;
   if(this.spacer)this.spacer.style.height=`${Math.max(0,this.contentHeight-this.height)}px`;
  }
  rows.forEach((row,r)=>{let x=pad;for(const item of row){if(item.glyph)this.placed.push({glyph:item.glyph,born:item.born,sourceIndex:item.sourceIndex,x:x+item.glyph.centerX*size,y:top+r*size*1.35+size*.96+item.glyph.centerY*size,size});x+=item.advance;}if(r===rows.length-1)this.caret={x,y:top+r*size*1.35+size*.08,height:size*.9};});
 }
 draw(time,{staticAmount=null}={}){
  const pending=this.placed?.some(item=>time<item.born+this.duration);
  if(!this.dirty&&!pending&&staticAmount===null)return;
  this.dirty=pending;
  const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.uniform2f(this.resolution,this.width,this.height);
  this.placed?.forEach((item,i)=>{
   if(staticAmount===null&&time<item.born)return;
   const g=item.glyph,progress=staticAmount===null?clamp((time-item.born)/this.duration):1-staticAmount;gl.uniform1f(this.progress,progress);for(let j=0;j<g.rig.vertices.length;j++){g.positions[j*2]=g.rig.vertices[j].x;g.positions[j*2+1]=g.rig.vertices[j].y;}
   const scale=item.size/g.pixelFontSize,remaining=(1-progress)**2,angle=!this.options.structural&&this.variant===7?-.14*remaining:0,dy=!this.options.structural&&this.variant===6?item.size*.12*remaining:0;
   for(let j=0;j<g.positions.length;j+=2){const x=(g.positions[j]-128)*scale,y=(g.positions[j+1]-128)*scale;g.screen[j]=item.x+Math.cos(angle)*x-Math.sin(angle)*y;g.screen[j+1]=item.y+Math.sin(angle)*x+Math.cos(angle)*y+dy;}
   gl.bindBuffer(gl.ARRAY_BUFFER,g.positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,g.screen,gl.DYNAMIC_DRAW);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,g.uvBuffer);gl.vertexAttribPointer(this.uv,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,g.indexBuffer);gl.bindTexture(gl.TEXTURE_2D,g.texture);gl.drawElements(gl.TRIANGLES,g.rig.indices.length,gl.UNSIGNED_SHORT,0);
  });
 }
}


// Structural previews draw moving centerlines, never a deformed bitmap surface.
const lineGlyphs=new Map();
function strokeWidth(alpha,path){
 const widths=[];
 for(const p of path){
  const x=Math.round(p.x),y=Math.round(p.y);let nearest=12;
  for(let dy=-12;dy<=12;dy++)for(let dx=-12;dx<=12;dx++){
   const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=256||yy>=256||alpha[yy*256+xx]<96)nearest=Math.min(nearest,Math.hypot(dx,dy));
  }
  widths.push(Math.max(1,nearest*2-1));
 }
 widths.sort((a,b)=>a-b);return widths[Math.floor(widths.length*.35)]??2;
}
export class LineRenderer {
 constructor(canvas,options={}){
  this.canvas=canvas;this.options=options;this.variant=options.variant??0;
  this.duration=options.duration??motion.duration;this.stagger=options.stagger??motion.stagger;
  this.cache=new Map();this.items=[];this.elements=new Map();
  this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  this.svg.classList.add('live-paths');this.svg.setAttribute('role','img');this.svg.setAttribute('aria-label',canvas.getAttribute('aria-label')||'文字のパス');
  canvas.style.display='none';canvas.setAttribute('aria-hidden','true');canvas.after(this.svg);
  this.spacer=document.createElement('div');this.spacer.className='canvas-spacer';this.svg.after(this.spacer);
  canvas.parentElement.addEventListener('scroll',()=>{this.dirty=true;});
 }
 make(text){
  if(this.cache.has(text))return this.cache.get(text);
  let base=lineGlyphs.get(text);
  if(!base){
   base=glyphImage(text);if(!base.alpha.some(v=>v))return null;
   base.graph=analyze(base.alpha,256,256);
   base.widths=base.graph.edges.map(e=>strokeWidth(base.alpha,e.path));
   base.dotWidths=base.graph.nodes.filter(n=>!n.edges.length).map(n=>strokeWidth(base.alpha,[n]));
   lineGlyphs.set(text,base);if(lineGlyphs.size>100)lineGlyphs.delete(lineGlyphs.keys().next().value);
  }
  const glyph={...base,text,strategy:plan(base.graph,this.variant)};this.cache.set(text,glyph);return glyph;
 }
 async setText(...args){return FoldRenderer.prototype.setText.apply(this,args);}
 replay(...args){this.canvas.parentElement.scrollTop=0;return FoldRenderer.prototype.replay.apply(this,args);}
 layout(){
  if(!this.options.relay)return FoldRenderer.prototype.layout.call(this);
  const original=this.items,times=relaySchedule(original,this.duration,this.stagger);
  this.items=original.map((item,i)=>({...item,born:times[i]}));
  FoldRenderer.prototype.layout.call(this);this.items=original;
 }
 prune(){const keep=new Set(this.items.map(i=>i.segment));for(const key of this.cache.keys()){if(this.cache.size<=80)break;if(!keep.has(key))this.cache.delete(key);}}
 draw(time,{staticAmount=null}={}){
  const pending=this.placed?.some(item=>time<item.born+this.duration);
  if(!this.dirty&&!pending&&staticAmount===null)return;this.dirty=pending;
  this.svg.setAttribute('viewBox',`0 0 ${this.width} ${this.height}`);this.svg.style.height=`${this.height}px`;
  const scrollTop=this.canvas.parentElement.scrollTop,keep=new Set();
  const create=tag=>document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [index,item] of (this.placed??[]).entries()){
   if(item.y+item.size*2<scrollTop||item.y-item.size*2>scrollTop+this.height)continue;
   const g=item.glyph,amount=staticAmount===null?1-clamp((time-item.born)/this.duration):clamp(staticAmount),scale=item.size/g.pixelFontSize;
   keep.add(index);let entry=this.elements.get(index);
   if(entry&&entry.glyph!==g){entry.group.remove();this.elements.delete(index);entry=null;}
   if(!entry){
    const group=create('g');group.setAttribute('fill','none');group.setAttribute('stroke','#111');group.setAttribute('stroke-linecap','round');group.setAttribute('stroke-linejoin','round');group.dataset.character=g.text;
    const paths=g.strategy.parts.map(part=>{const path=create('path');path.setAttribute('stroke-width',g.widths[part.edge]);group.append(path);return path;});
    const dots=g.dotWidths.map(width=>{const path=create('path');path.setAttribute('stroke-width',width);group.append(path);return path;});
    this.svg.append(group);entry={group,paths,dots,glyph:g};this.elements.set(index,entry);
   }
   entry.group.setAttribute('visibility',staticAmount===null&&time<item.born?'hidden':'visible');
   entry.group.setAttribute('transform',`translate(${item.x} ${item.y-scrollTop}) scale(${scale}) translate(-128 -128)`);
   const reveal=[5,9].includes(this.variant)?clamp((1-amount)/.85):1;
   const paths=this.options.relay?relayPaths(g.strategy,1-amount):posedPaths(g.strategy,amount);
   paths.forEach((fullPath,i)=>{const path=trimPath(fullPath,reveal);entry.paths[i].setAttribute('d',path.length<2?'':path.map((p,j)=>`${j?'L':'M'}${p.x} ${p.y}`).join(' '));});
   posedDots(g.graph,amount).forEach((p,i)=>{entry.dots[i].setAttribute('stroke-width',g.dotWidths[i]*reveal);entry.dots[i].setAttribute('d',reveal?`M${p.x} ${p.y}l.001 0`:'');});
  }
  for(const [index,entry] of this.elements){if(!keep.has(index)){entry.group.remove();this.elements.delete(index);}}
 }
}
