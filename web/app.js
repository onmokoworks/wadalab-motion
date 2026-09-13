import {NativeRenderer} from './native-renderer.js';
import {loadSourceEngine} from './source-engine.js';
import {deletionDelays,removedIndices} from './deletion-schedule.js';

const $=id=>document.getElementById(id);
const segmenter=new Intl.Segmenter('ja',{granularity:'grapheme'});
const segments=text=>[...segmenter.segment(text)].map(entry=>entry.segment);
let engine,renderer,token=0,composing=false,clock=0,lastFrame=0,inputFocused=false;

function fontSize(){return innerWidth<600?72:112;}

async function update(){
 const mine=++token;
 document.body.classList.remove('waiting');
 if(!renderer)return;
 const text=$('input').value,characters=segments(text),missing=[...new Set(characters.filter(character=>character.trim()&&!engine.resolve(character)))];
 const previous=renderer.items.map(item=>item.segment),removed=removedIndices(previous,characters);
 if(removed.length){const delays=deletionDelays(removed.length);renderer.queueDepartures(removed.map((sourceIndex,index)=>({sourceIndex,delay:delays[index]})),clock);}
 $('error').textContent=missing.length?`未収録：${missing.join('・')}`:'';
 const safe=characters.map(character=>missing.includes(character)?' ':character).join('');
 try{
  await renderer.setText(safe,()=>mine===token,()=>clock);
  if(mine!==token)return;
  renderer.canvas.dataset.glyphs=String(renderer.placed.length);
  const stage=$('stage');
  if(stage.scrollHeight-stage.scrollTop-stage.clientHeight<renderer.options.fontSize*2)stage.scrollTop=stage.scrollHeight;
  updateCaret();
 }catch(error){if(mine===token)$('error').textContent=error.message;}
}

function updateCaret(){
 if(!renderer?.caret)return;
 const caret=$('caret'),stage=$('stage');
 caret.style.transform=`translate(${renderer.caret.x}px,${renderer.caret.y-stage.scrollTop}px)`;
 caret.style.height=`${renderer.caret.height}px`;
}

$('input').addEventListener('compositionstart',()=>{composing=true;++token;});
$('input').addEventListener('compositionend',()=>{composing=false;update();});
$('input').addEventListener('input',()=>{if(!composing)update();});
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
 try{const text=await navigator.clipboard.readText();$('input').value=text;$('input').setSelectionRange(text.length,text.length);await update();}
 catch{$('error').textContent='クリップボードを読み取れませんでした。ブラウザの許可を確認してください。';}
 finally{button.disabled=false;focusInput();}
};
$('close').onclick=()=>$('license').close();
$('license').addEventListener('click',event=>{if(event.target!==$('license'))return;const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();});
$('license').addEventListener('close',focusInput);

addEventListener('resize',()=>{if(!renderer)return;renderer.options.fontSize=fontSize();renderer.layout();updateCaret();});
$('stage').addEventListener('scroll',updateCaret,{passive:true});

function frame(now){
 if(lastFrame&&!document.hidden&&!$('license').open)clock+=Math.min(.1,(now-lastFrame)/1000)*.75;
 lastFrame=now;
 if(renderer&&!document.hidden&&!$('license').open)renderer.draw(clock);
 document.body.classList.toggle('waiting',Boolean(renderer&&inputFocused&&!composing&&!renderer.isAnimating(clock)&&!$('license').open));
 requestAnimationFrame(frame);
}

async function initialize(){
 try{
  engine=await loadSourceEngine();
  renderer=new NativeRenderer($('canvas'),{compact:true,fontSize:fontSize(),pad:4,top:58,variant:11,structural:true,motionMode:'close'});
  await update();
  focusInput();
 }catch(error){$('error').textContent=error.message;}
 requestAnimationFrame(frame);
}

initialize();
