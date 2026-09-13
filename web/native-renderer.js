import {LineRenderer} from './renderer.js';
import {getSourceEngine} from './source-engine.js';
import {clamp,smooth} from './fold-core.js';

const NS='http://www.w3.org/2000/svg';
const svg=tag=>document.createElementNS(NS,tag);
const pathD=path=>path.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');

export class NativeRenderer extends LineRenderer{
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
   if(!entry){const group=svg('g');group.setAttribute('fill','none');group.setAttribute('stroke','#111');group.setAttribute('stroke-width','16');group.setAttribute('stroke-linecap','round');group.setAttribute('stroke-linejoin','round');group.dataset.character=glyph.text;group.dataset.source='clwfk-centerline';this.svg.append(group);entry={group,glyph,paths:[],amount:null};this.elements.set(index,entry);}
   entry.group.setAttribute('transform',`translate(${item.x} ${item.y-scroll}) scale(${item.size/400}) translate(-200 -200)`);const hidden=staticAmount===null&&time<item.born;entry.group.setAttribute('visibility',hidden?'hidden':'visible');if(hidden||entry.amount===amount)continue;
   try{
    const pieces=this.options.roundTrim?engine.cPlusStrokePaths(glyph,amount):engine.motionStrokePaths(glyph,amount,this.options.relay),reveal=this.roundReveal(glyph,pieces,amount);
    while(entry.paths.length<pieces.length){const path=svg('path');path.setAttribute('pathLength','1');entry.group.append(path);entry.paths.push(path);}
    pieces.forEach((piece,i)=>{const path=entry.paths[i],progress=reveal.get(i)??1;path.setAttribute('d',pathD(piece.path));if(progress>=.999){path.removeAttribute('stroke-dasharray');path.removeAttribute('stroke-dashoffset');}else{path.setAttribute('stroke-dasharray','1');path.setAttribute('stroke-dashoffset',String(1-progress));}});
    entry.paths.forEach((path,i)=>{if(i>=pieces.length)path.setAttribute('d','');});entry.amount=amount;this.canvas.dataset.renderError='';
   }catch(error){this.canvas.dataset.renderError=error.message;entry.group.setAttribute('visibility','hidden');}
  }
  for(const [index,entry] of this.elements)if(!keep.has(index)){entry.group.remove();this.elements.delete(index);}
 }

 roundReveal(glyph,pieces,amount){
  const result=new Map();if(!this.options.roundTrim)return result;const progress=smooth(clamp((1-amount)/.55));
  for(const stroke of glyph.roundStrokes){const ordered=pieces.map((piece,index)=>({piece,index})).filter(row=>row.piece.stroke===stroke).sort((a,b)=>a.piece.order-b.piece.order),lengths=ordered.map(row=>row.piece.path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-row.piece.path[i].x,p.y-row.piece.path[i].y),0)),total=lengths.reduce((a,b)=>a+b,0)||1;let consumed=0;ordered.forEach((row,i)=>{result.set(row.index,clamp((progress*total-consumed)/(lengths[i]||1)));consumed+=lengths[i];});}
  return result;
 }
}
