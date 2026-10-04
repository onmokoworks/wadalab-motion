import {clockMotion,foldStrokePath,formatClock,strokeVisibility,transitionProgress} from './clock-core.js';
import {clamp} from './fold-core.js';
import {clockGlyphFrame} from './clock-flow-core.js';

const NS='http://www.w3.org/2000/svg',$=id=>document.getElementById(id),svg=tag=>document.createElementNS(NS,tag),pathD=path=>path.map((point,index)=>`${index?'L':'M'}${point.x} ${point.y}`).join(' ');
const slots=[];

function makeLayer(){const group=svg('g');group.dataset.layer='glyph';return group;}
function glyphBounds(glyph){if(glyph.bounds)return glyph.bounds;const points=glyph.paths.flat();return glyph.bounds={left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x))};}
function drawGlyph(group,glyph,amount){
 const frame=clockGlyphFrame(glyph,amount),paths=frame.paths;group.setAttribute('transform',`translate(${frame.offset} 0)`);group.setAttribute('opacity',String(frame.opacity));group.setAttribute('fill','none');group.setAttribute('stroke','#111');group.setAttribute('stroke-width',String(glyph.width));group.setAttribute('stroke-linecap','round');group.setAttribute('stroke-linejoin','round');
 while(group.children.length<paths.length)group.append(svg('path'));for(let i=0;i<group.children.length;i++)group.children[i].setAttribute('d',paths[i]?.length>1?pathD(paths[i]):'');
}

function setTime(glyphs,date,now){
 const formatted=formatClock(date),clock=$('clock');clock.setAttribute('aria-label',formatted.ascii);
 for(const [index,character] of [...formatted.display].entries()){
  const slot=slots[index];if(slot.character===character)continue;
  slot.previous=slot.current;slot.character=character;slot.current=glyphs.get(character);slot.started=now;
 }
 const left=Math.min(...slots.map(slot=>{const bounds=glyphBounds(slot.current);return slot.x+slot.current.advance/2-(bounds.right-bounds.left)/2;})),right=Math.max(...slots.map(slot=>{const bounds=glyphBounds(slot.current);return slot.x+slot.current.advance/2+(bounds.right-bounds.left)/2;})),center=(left+right)/2;clock.setAttribute('viewBox',`${center-clock.dataset.width/2} 0 ${clock.dataset.width} 400`);
}

function draw(now){
 for(const slot of slots){const progress=transitionProgress(now,slot.started),outgoing=clamp(progress/.6),incoming=clamp((progress-.4)/.6);if(slot.previous&&progress<1){drawGlyph(slot.outgoing,slot.previous,outgoing);slot.outgoing.setAttribute('visibility','visible');}else{slot.previous=null;slot.outgoing.setAttribute('visibility','hidden');}drawGlyph(slot.incoming,slot.current,1-incoming);}
}

async function initialize(){
 const response=await fetch('/font/clock-skeletons.json'),data=await response.json(),glyphs=new Map(data.glyphs.map(([character,paths,width,advance])=>[character,{character,paths,width,advance}])),clock=$('clock'),characters=[...formatClock(new Date()).display];let x=0;
 for(const character of characters){const width=glyphs.get(character).advance,holder=svg('g'),outgoing=makeLayer(),incoming=makeLayer();holder.setAttribute('transform',`translate(${x} 0)`);holder.append(outgoing,incoming);clock.append(holder);slots.push({x,outgoing,incoming,current:null,previous:null,character:'',started:0});x+=width;}clock.dataset.width=String(x);clock.setAttribute('viewBox',`0 0 ${x} 400`);
 let lastSecond=-1;
 function frame(timestamp){const now=timestamp/1000,date=new Date(),second=Math.floor(date.getTime()/1000);if(second!==lastSecond){lastSecond=second;setTime(glyphs,date,now);}draw(now);requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
}

$('info').onclick=async()=>{$('license').showModal();try{const response=await fetch('/LICENSE.txt');if(!response.ok)throw Error();$('license-text').textContent=await response.text();}catch{$('license-text').textContent='ライセンスを読み込めませんでした。';}};$('close').onclick=()=>$('license').close();$('license').addEventListener('click',event=>{if(event.target!==$('license'))return;const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();});
initialize();
