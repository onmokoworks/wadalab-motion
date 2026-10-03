import {NativeRenderer} from './native-renderer.js';
import {loadSourceEngine} from './source-engine.js';
import {deletionDelays,removedIndices} from './deletion-schedule.js';
import {textThrough} from './playback-control.js';

const $=id=>document.getElementById(id);
// Original TTF vertices for ▸ (U+25B8) and ▾ (U+25BE), centered in SVG coordinates.
const aboutClosed=[243,201,781,512,243,823],aboutOpen=[823,243,512,781,201,243];
const about=document.querySelector('.license-summary'),aboutPath=about.querySelector('.about-marker path');
let aboutShape=aboutClosed.slice(),aboutFrame=0;
about.addEventListener('toggle',()=>{
 cancelAnimationFrame(aboutFrame);
 const from=aboutShape.slice(),to=about.open?aboutOpen:aboutClosed,start=performance.now();
 const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:180;
 function frame(now){
  const t=duration?Math.min(1,(now-start)/duration):1,p=t*t*(3-2*t);
  aboutShape=from.map((value,index)=>value+(to[index]-value)*p);
  aboutPath.setAttribute('d',`M${aboutShape[0]} ${aboutShape[1]}L${aboutShape[2]} ${aboutShape[3]}L${aboutShape[4]} ${aboutShape[5]}Z`);
  if(t<1)aboutFrame=requestAnimationFrame(frame);
 }
 aboutFrame=requestAnimationFrame(frame);
});
const segmenter=new Intl.Segmenter('ja',{granularity:'grapheme'});
const segments=text=>[...segmenter.segment(text)].map(entry=>entry.segment);
let engine,renderer,token=0,composing=false,clock=0,lastFrame=0,viewportFrame=0,bulkPlayback=false,updating=false,playbackScrollTarget=0;

function fontSize(){return innerWidth<600?72:112;}

async function update({bulkHint=false,preserveScroll=false}={}){
 const mine=++token;
 updating=true;
 document.body.classList.remove('waiting');
 if(!renderer){updating=false;return;}
 const text=$('input').value,characters=segments(text),missing=[...new Set(characters.filter(character=>character.trim()&&!engine.resolve(character)))];
 const previous=renderer.items.map(item=>item.segment),removed=removedIndices(previous,characters);
 const stage=$('stage'),savedScrollTop=stage.scrollTop,bulk=bulkHint||Math.abs(characters.length-previous.length)>12||removed.length>12;
 if(removed.length){const delays=deletionDelays(removed.length);renderer.queueDepartures(removed.map((sourceIndex,index)=>({sourceIndex,delay:delays[index]})),clock);}
 $('error').textContent=missing.length?`未収録：${missing.join('・')}`:'';
 const safe=characters.map(character=>missing.includes(character)?' ':character).join('');
 try{
  if(bulk){bulkPlayback=true;playbackScrollTarget=savedScrollTop;}
  await renderer.setText(safe,()=>mine===token,()=>clock);
  if(mine!==token)return;
  renderer.canvas.dataset.glyphs=String(renderer.placed.length);
  if(bulk||preserveScroll){stage.scrollTop=Math.min(savedScrollTop,Math.max(0,stage.scrollHeight-stage.clientHeight));updateCaret();}
  else keepActivityVisible();
 }catch(error){if(mine===token)$('error').textContent=error.message;}
 finally{if(mine===token)updating=false;}
}

function updateCaret(){
 if(!renderer?.caret)return;
 const caret=$('caret'),stage=$('stage');
 caret.style.transform=`translate(${renderer.caret.x}px,${renderer.caret.y-stage.scrollTop}px)`;
 caret.style.height=`${renderer.caret.height}px`;
}

function keepActivityVisible(){
 if(!renderer?.caret)return;
 const stage=$('stage'),departureBottom=Math.max(0,...renderer.departures.map(item=>item.y+item.size*.72)),bottom=Math.max(renderer.caret.y+renderer.caret.height,departureBottom),top=Math.min(renderer.caret.y,...renderer.departures.map(item=>item.y-item.size*.72)),margin=12;
 if(bottom-stage.scrollTop>stage.clientHeight-margin)stage.scrollTop=Math.max(0,bottom-stage.clientHeight+margin);
 else if(top<stage.scrollTop+margin)stage.scrollTop=Math.max(0,top-margin);
 updateCaret();
}

function keepPlaybackVisible(){
 const item=renderer?.animationFrontier(clock);if(!item)return;
 const stage=$('stage'),margin=Math.min(stage.clientHeight*.24,120),bottom=item.y+item.size*.35;
 if(bottom>playbackScrollTarget+stage.clientHeight-margin)playbackScrollTarget=Math.max(0,bottom-stage.clientHeight+margin);
}

function syncViewport(){
 const height=window.visualViewport?.height??innerHeight;
 document.documentElement.style.setProperty('--viewport-height',`${height}px`);
 cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(()=>{
  if(!renderer)return;
  const stage=$('stage'),scroll=stage.scrollTop,oldWidth=renderer.width;
  const anchor=renderer.placed.find(item=>item.y+item.size*.35>=scroll&&item.born<=clock);
  const offset=anchor?anchor.y-scroll:0;
  renderer.options.fontSize=fontSize();renderer.options.bottomPad=height*.24;renderer.layout();
  if(renderer.width!==oldWidth){
   const moved=anchor&&renderer.placed.find(item=>item.sourceIndex===anchor.sourceIndex);
   stage.scrollTop=moved?Math.max(0,moved.y-offset):scroll;
   playbackScrollTarget=stage.scrollTop;
  }else if(!bulkPlayback&&document.activeElement===$('input'))keepActivityVisible();
  updateCaret();renderer.dirty=true;
 });
}

$('input').addEventListener('compositionstart',()=>{composing=true;++token;});
$('input').addEventListener('compositionend',()=>{composing=false;update();});
$('input').addEventListener('input',event=>{if(!composing)update({bulkHint:event.inputType==='insertFromPaste'||event.inputType==='insertFromDrop',preserveScroll:event.inputType.startsWith('delete')});});
$('input').addEventListener('keydown',event=>{
 if(event.key!=='Backspace'||composing||!bulkPlayback||!renderer)return;
 const frontier=renderer.animationFrontier(clock);if(!frontier)return;
 event.preventDefault();++token;updating=false;bulkPlayback=false;playbackScrollTarget=$('stage').scrollTop;
 const text=textThrough(renderer.items,frontier.sourceIndex);
 renderer.items=renderer.items.slice(0,frontier.sourceIndex+1);renderer.layout();renderer.prune();renderer.dirty=true;
 $('input').value=text;$('input').setSelectionRange(text.length,text.length);$('error').textContent='';updateCaret();
});
$('input').addEventListener('blur',()=>{document.body.classList.remove('waiting');});

function focusInput(){if(!$('license').open)$('input').focus({preventScroll:true});}
document.addEventListener('click',event=>{if(event.target.closest('button,dialog'))return;event.preventDefault();focusInput();});

$('info').onclick=async()=>{
 $('license').showModal();
 await Promise.all([['project-license-text','/PROJECT-LICENSE.txt'],['license-text','/SOURCE-LICENSE.txt']].map(async([id,url])=>{
  try{const response=await fetch(url);if(!response.ok)throw Error();$(id).textContent=await response.text();}
  catch{$(id).textContent='ライセンスを読み込めませんでした。';}
 }));
};
$('paste').onclick=async()=>{
 const button=$('paste');button.disabled=true;
 try{const text=await navigator.clipboard.readText();$('input').value=text;$('input').setSelectionRange(text.length,text.length);await update({bulkHint:true});}
 catch{$('error').textContent='クリップボードを読み取れませんでした。ブラウザの許可を確認してください。';}
 finally{button.disabled=false;focusInput();}
};
$('close').onclick=()=>$('license').close();
$('license').addEventListener('click',event=>{if(event.target!==$('license'))return;const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();});
$('license').addEventListener('close',focusInput);

addEventListener('resize',syncViewport);
window.visualViewport?.addEventListener('resize',syncViewport);
window.visualViewport?.addEventListener('scroll',syncViewport);
$('stage').addEventListener('scroll',updateCaret,{passive:true});

function releasePlaybackScroll(){
 if(!bulkPlayback)return;bulkPlayback=false;playbackScrollTarget=$('stage').scrollTop;
}
$('stage').addEventListener('wheel',releasePlaybackScroll,{passive:true});
$('stage').addEventListener('touchstart',releasePlaybackScroll,{passive:true});
$('stage').addEventListener('pointerdown',releasePlaybackScroll,{passive:true});
document.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))releasePlaybackScroll();});

function frame(now){
 const elapsed=lastFrame?Math.min(.1,(now-lastFrame)/1000):0;
 if(lastFrame&&!document.hidden&&!$('license').open)clock+=elapsed*.75;
 lastFrame=now;
 if(renderer&&!document.hidden&&!$('license').open)renderer.draw(clock);
 if(renderer&&bulkPlayback&&!document.hidden&&!$('license').open){
  keepPlaybackVisible();
  const stage=$('stage'),step=1-Math.exp(-elapsed*7),next=stage.scrollTop+(playbackScrollTarget-stage.scrollTop)*step;
  if(Math.abs(next-stage.scrollTop)>.05){stage.scrollTop=next;updateCaret();}
  if(!updating&&!renderer.isAnimating(clock))bulkPlayback=false;
 }
 document.body.classList.toggle('waiting',Boolean(renderer&&document.activeElement===$('input')&&!composing&&!renderer.isAnimating(clock)&&!$('license').open));
 requestAnimationFrame(frame);
}

async function initialize(){
 try{
  syncViewport();
  engine=await loadSourceEngine();
  renderer=new NativeRenderer($('canvas'),{compact:true,fontSize:fontSize(),pad:4,bottomPad:(window.visualViewport?.height??innerHeight)*.24,top:58,variant:11,structural:true,motionMode:'close'});
  await update();
  focusInput();
 }catch(error){$('error').textContent=error.message;}
 requestAnimationFrame(frame);
}

initialize();
