import {LineRenderer} from './renderer.js';
import {getSourceEngine} from './source-engine.js';
import {clamp,smooth} from './fold-core.js';

const NS='http://www.w3.org/2000/svg';
const svg=tag=>document.createElementNS(NS,tag);
const pathD=path=>path.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');
let rendererId=0;

export class NativeRenderer extends LineRenderer{
 constructor(...args){super(...args);this.rendererId=++rendererId;}
 make(text){const glyph=getSourceEngine().make(text,this.variant);this.cache.set(text,glyph);return glyph;}

 layout(){
  const saved=this.options.relay;this.options.relay=false;const original=this.items;
  if(saved){let previous=null;this.items=original.map(item=>{if(!item.glyph){previous=null;return item;}const born=previous?Math.max(item.born,previous.born+previous.glyph.release*this.duration):item.born,placed={...item,born};previous=placed;return placed;});}
  super.layout();this.items=original;this.options.relay=saved;
 }

 draw(time,{staticAmount=null}={}){
  const pending=this.placed?.some(item=>time<item.born+this.duration);if(!this.dirty&&!pending&&staticAmount===null)return;this.dirty=pending;
  this.svg.setAttribute('viewBox',`0 0 ${this.width} ${this.height}`);this.svg.style.height=`${this.height}px`;const scroll=this.canvas.parentElement.scrollTop,keep=new Set(),engine=getSourceEngine();
  for(const [index,item] of (this.placed??[]).entries()){
   if(item.y+item.size*2<scroll||item.y-item.size*2>scroll+this.height)continue;keep.add(index);const glyph=item.glyph,amount=staticAmount===null?1-clamp((time-item.born)/this.duration):clamp(staticAmount);let entry=this.elements.get(index);
   if(entry&&entry.glyph!==glyph){entry.group.remove();this.elements.delete(index);entry=null;}
   if(!entry){entry=glyph.outlineOnly?this.makeOutlineEntry(glyph,index):this.makeCenterlineEntry(glyph);this.svg.append(entry.group);this.elements.set(index,entry);}
   entry.group.setAttribute('transform',`translate(${item.x} ${item.y-scroll}) scale(${item.size/400}) translate(-200 -200)`);const hidden=staticAmount===null&&time<item.born;entry.group.setAttribute('visibility',hidden?'hidden':'visible');if(hidden||entry.amount===amount)continue;
   try{
    if(glyph.outlineOnly){this.drawOutlineEntry(entry,amount);entry.amount=amount;this.canvas.dataset.renderError='';continue;}
    const pieces=this.options.motionMode==='junction'?engine.junctionBranchPaths(glyph,amount):this.options.motionMode==='tangent'?engine.tangentRelayStrokePaths(glyph,amount):this.options.motionMode==='close'?engine.closeLoopPaths(glyph,amount):this.options.motionMode==='carefulClose'?engine.carefulClosePaths(glyph,amount):this.options.curveUnfold?engine.cPlus2StrokePaths(glyph,amount):this.options.roundTrim?engine.cPlusStrokePaths(glyph,amount):engine.motionStrokePaths(glyph,amount,this.options.relay),reveal=this.roundReveal(glyph,pieces,amount);
    while(entry.paths.length<pieces.length){const path=svg('path');path.setAttribute('pathLength','1');entry.group.append(path);entry.paths.push(path);}
    pieces.forEach((piece,i)=>{const path=entry.paths[i],progress=reveal.get(i)??1,pathLength=piece.path.slice(1).reduce((sum,point,j)=>sum+Math.hypot(point.x-piece.path[j].x,point.y-piece.path[j].y),0);path.setAttribute('d',pathLength>.001?pathD(piece.path):'');if(this.options.motionMode&&pathLength<16)path.setAttribute('stroke-linecap','butt');else path.removeAttribute('stroke-linecap');if(progress>=.999){path.removeAttribute('stroke-dasharray');path.removeAttribute('stroke-dashoffset');}else{path.setAttribute('stroke-dasharray','1');path.setAttribute('stroke-dashoffset',String(1-progress));}});
    entry.paths.forEach((path,i)=>{if(i>=pieces.length)path.setAttribute('d','');});entry.amount=amount;this.canvas.dataset.renderError='';
   }catch(error){this.canvas.dataset.renderError=error.message;entry.group.setAttribute('visibility','hidden');}
  }
  for(const [index,entry] of this.elements)if(!keep.has(index)){entry.group.remove();this.elements.delete(index);}
 }

 makeCenterlineEntry(glyph){
  const group=svg('g');group.setAttribute('fill','none');group.setAttribute('stroke','#111');group.setAttribute('stroke-width','16');group.setAttribute('stroke-linecap','round');group.setAttribute('stroke-linejoin','round');group.dataset.character=glyph.text;group.dataset.source='clwfk-centerline';return {group,glyph,paths:[],amount:null};
 }

 makeOutlineEntry(glyph,index){
  const group=svg('g'),shape=svg('path'),mask=svg('mask'),black=svg('rect'),maskId=`wadalab-outline-${this.rendererId}-${index}`;
  group.dataset.character=glyph.text;group.dataset.source='clwfk-outline';shape.setAttribute('d',glyph.restEntries.map(entry=>entry.d).join(' '));shape.setAttribute('fill','#111');shape.setAttribute('fill-rule','evenodd');shape.setAttribute('mask',`url(#${maskId})`);
  mask.setAttribute('id',maskId);mask.setAttribute('maskUnits','userSpaceOnUse');mask.setAttribute('x','0');mask.setAttribute('y','0');mask.setAttribute('width','400');mask.setAttribute('height','400');black.setAttribute('x','0');black.setAttribute('y','0');black.setAttribute('width','400');black.setAttribute('height','400');black.setAttribute('fill','black');mask.append(black);
  const revealPaths=glyph.restEntries.map(contour=>{const path=svg('path');path.setAttribute('d',contour.d);path.setAttribute('fill','none');path.setAttribute('stroke','white');path.setAttribute('stroke-width','96');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.setAttribute('pathLength','1');mask.append(path);return path;});group.append(mask,shape);return {group,glyph,paths:[],shape,revealPaths,amount:null};
 }

 drawOutlineEntry(entry,amount){
  const progress=smooth(clamp((1-amount)/.55));
  if(progress>=.999){entry.shape.removeAttribute('mask');return;}
  entry.shape.setAttribute('mask',`url(#${entry.group.querySelector('mask').id})`);for(const path of entry.revealPaths){path.setAttribute('stroke-dasharray','1');path.setAttribute('stroke-dashoffset',String(1-progress));}
 }

 roundReveal(glyph,pieces,amount){
  const result=new Map();if(!this.options.roundTrim)return result;const progress=smooth(clamp((1-amount)/.55));
  for(const stroke of glyph.roundStrokes){const ordered=pieces.map((piece,index)=>({piece,index})).filter(row=>row.piece.stroke===stroke).sort((a,b)=>a.piece.order-b.piece.order),lengths=ordered.map(row=>row.piece.path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-row.piece.path[i].x,p.y-row.piece.path[i].y),0)),total=lengths.reduce((a,b)=>a+b,0)||1;let consumed=0;ordered.forEach((row,i)=>{result.set(row.index,clamp((progress*total-consumed)/(lengths[i]||1)));consumed+=lengths[i];});}
  return result;
 }
}
