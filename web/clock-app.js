import {loadSourceEngine} from './source-engine.js';
import {clockMotion,formatClock,transitionProgress} from './clock-core.js';
import {clamp,smooth} from './fold-core.js';

const NS='http://www.w3.org/2000/svg',$=id=>document.getElementById(id),svg=tag=>document.createElementNS(NS,tag),pathD=path=>path.map((point,index)=>`${index?'L':'M'}${point.x} ${point.y}`).join(' ');
const slots=[],widths=[400,400,180,400,400,180,400,400];

function makeLayer(){const group=svg('g');group.dataset.layer='glyph';return group;}
function foldedOutline(d,growth,pivot={x:200,y:200}){let coordinate=0;return d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi,value=>{const number=Number(value),axis=coordinate++%2,x=axis?pivot.y:pivot.x;return String(x+(number-x)*growth);});}
function drawOutlineGlyph(group,glyph,amount){
 const progress=clamp(1-amount),last=Math.max(1,glyph.restEntries.length-1),d=glyph.restEntries.map((entry,index)=>{const delay=index?Math.max(.55,.3*index/last):0,local=smooth(clamp((progress-delay)/(1-delay)));return foldedOutline(entry.d,local);}).join(' ');
 let path=group.firstElementChild;if(!path){path=svg('path');path.setAttribute('fill-rule','evenodd');group.append(path);}while(group.children.length>1)group.lastElementChild.remove();group.setAttribute('fill','#111');group.setAttribute('stroke','none');path.setAttribute('d',d);
}
function drawGlyph(engine,group,glyph,amount){
 if(glyph.outlineOnly){drawOutlineGlyph(group,glyph,amount);return;}
 const pieces=engine.closeLoopPaths(glyph,amount);
 group.setAttribute('fill','none');group.setAttribute('stroke','#111');group.setAttribute('stroke-width','16');group.setAttribute('stroke-linecap','round');group.setAttribute('stroke-linejoin','round');
 while(group.children.length<pieces.length)group.append(svg('path'));
 for(let i=0;i<group.children.length;i++){const path=group.children[i],piece=pieces[i];path.setAttribute('d',piece&&piece.path.length>1?pathD(piece.path):'');}
}

function setTime(engine,date,now){
 const formatted=formatClock(date);$('clock').setAttribute('aria-label',formatted.ascii);
 for(const [index,character] of [...formatted.display].entries()){
  const slot=slots[index];if(slot.character===character)continue;
  slot.previous=slot.current;slot.character=character;slot.current=engine.make(character,11);slot.started=now;
 }
}

function draw(engine,now){
 for(const slot of slots){const progress=transitionProgress(now,slot.started),outgoing=clamp(progress/.6),incoming=clamp((progress-.4)/.6);if(slot.previous&&progress<1){drawGlyph(engine,slot.outgoing,slot.previous,outgoing);slot.outgoing.setAttribute('visibility','visible');}else{slot.previous=null;slot.outgoing.setAttribute('visibility','hidden');}drawGlyph(engine,slot.incoming,slot.current,1-incoming);}
}

async function initialize(){
 const engine=await loadSourceEngine(),clock=$('clock');let x=0;
 for(const width of widths){const holder=svg('g'),outgoing=makeLayer(),incoming=makeLayer();holder.setAttribute('transform',`translate(${x+(width-400)/2} 0)`);holder.append(outgoing,incoming);clock.append(holder);slots.push({outgoing,incoming,current:null,previous:null,character:'',started:0});x+=width;}
 let lastSecond=-1;
 function frame(timestamp){const now=timestamp/1000,date=new Date(),second=Math.floor(date.getTime()/1000);if(second!==lastSecond){lastSecond=second;setTime(engine,date,now);}draw(engine,now);requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
}

$('info').onclick=async()=>{$('license').showModal();try{const response=await fetch('/LICENSE.txt');if(!response.ok)throw Error();$('license-text').textContent=await response.text();}catch{$('license-text').textContent='ライセンスを読み込めませんでした。';}};$('close').onclick=()=>$('license').close();$('license').addEventListener('click',event=>{if(event.target!==$('license'))return;const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();});
initialize();
