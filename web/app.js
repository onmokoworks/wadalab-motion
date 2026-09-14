import {NativeRenderer} from './native-renderer.js';
import {loadSourceEngine} from './source-engine.js';
import {deletionDelays,removedIndices} from './deletion-schedule.js';

const $=id=>document.getElementById(id);
const segmenter=new Intl.Segmenter('ja',{granularity:'grapheme'});
const segments=text=>[...segmenter.segment(text)].map(entry=>entry.segment);
let engine,renderer,token=0,composing=false,clock=0,lastFrame=0,inputFocused=false,viewportFrame=0,bulkPlayback=false,updating=false,playbackScrollTarget=0;

function fontSize(){return innerWidth<600?72:112;}

async function update({bulkHint=false}={}){
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
  if(bulk){stage.scrollTop=Math.min(savedScrollTop,Math.max(0,stage.scrollHeight-stage.clientHeight));updateCaret();}
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
 cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(()=>{if(!renderer)return;renderer.options.fontSize=fontSize();renderer.layout();keepActivityVisible();});
}

$('input').addEventListener('compositionstart',()=>{composing=true;++token;});
$('input').addEventListener('compositionend',()=>{composing=false;update();});
$('input').addEventListener('input',event=>{if(!composing)update({bulkHint:event.inputType==='insertFromPaste'||event.inputType==='insertFromDrop'});});
$('input').addEventListener('focus',()=>{inputFocused=true;});
$('input').addEventListener('blur',()=>{inputFocused=false;document.body.classList.remove('waiting');});

function focusInput(){if(!$('license').open)$('input').focus({preventScroll:true});}
document.addEventListener('click',event=>{if(event.target.closest('button,dialog'))return;event.preventDefault();focusInput();});

$('info').onclick=async()=>{
 $('license').showModal();
 try{const response=await fetch('/LICENSE.txt');if(!response.ok)throw Error();$('license-text').textContent=await response.text();}
 catch{$('license-text').textContent='ライセンスを読み込めませんでした。';}
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
 document.body.classList.toggle('waiting',Boolean(renderer&&inputFocused&&!composing&&!renderer.isAnimating(clock)&&!$('license').open));
 requestAnimationFrame(frame);
}

async function initialize(){
 try{
  syncViewport();
  engine=await loadSourceEngine();
  renderer=new NativeRenderer($('canvas'),{compact:true,fontSize:fontSize(),pad:4,top:58,variant:11,structural:true,motionMode:'close'});
  await update();
  focusInput();
 }catch(error){$('error').textContent=error.message;}
 requestAnimationFrame(frame);
}

initialize();
