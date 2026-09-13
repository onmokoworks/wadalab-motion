import {NativeRenderer} from './native-renderer.js';
import {loadSourceEngine} from './source-engine.js';

const $=id=>document.getElementById(id);
const segmenter=new Intl.Segmenter('ja',{granularity:'grapheme'});
const segments=text=>[...segmenter.segment(text)].map(entry=>entry.segment);
let engine,renderer,token=0,composing=false,clock=0,lastFrame=0;

function fontSize(){return innerWidth<600?72:112;}

async function update(){
 const mine=++token;
 if(!renderer)return;
 const text=$('input').value,characters=segments(text),missing=[...new Set(characters.filter(character=>character.trim()&&!engine.resolve(character)))];
 $('error').textContent=missing.length?`未収録：${missing.join('・')}`:'';
 const safe=characters.map(character=>missing.includes(character)?' ':character).join('');
 try{
  await renderer.setText(safe,()=>mine===token,()=>clock);
  if(mine!==token)return;
  renderer.canvas.dataset.glyphs=String(renderer.placed.length);
  const stage=$('stage');
  if(stage.scrollHeight-stage.scrollTop-stage.clientHeight<renderer.options.fontSize*2)stage.scrollTop=stage.scrollHeight;
 }catch(error){if(mine===token)$('error').textContent=error.message;}
}

$('input').addEventListener('compositionstart',()=>{composing=true;++token;});
$('input').addEventListener('compositionend',()=>{composing=false;update();});
$('input').addEventListener('input',()=>{if(!composing)update();});

function focusInput(){if(!$('license').open)$('input').focus({preventScroll:true});}
document.addEventListener('pointerdown',event=>{if(!event.target.closest('button,dialog'))focusInput();});

$('info').onclick=async()=>{
 $('license').showModal();
 try{const response=await fetch('/LICENSE.txt');if(!response.ok)throw Error();$('license-text').textContent=await response.text();}
 catch{$('license-text').textContent='ライセンスを読み込めませんでした。';}
};
$('close').onclick=()=>$('license').close();
$('license').addEventListener('click',event=>{if(event.target!==$('license'))return;const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();});
$('license').addEventListener('close',focusInput);

addEventListener('resize',()=>{if(!renderer)return;renderer.options.fontSize=fontSize();renderer.layout();});

function frame(now){
 if(lastFrame&&!document.hidden&&!$('license').open)clock+=Math.min(.1,(now-lastFrame)/1000)*.75;
 lastFrame=now;
 if(renderer&&!document.hidden&&!$('license').open)renderer.draw(clock);
 requestAnimationFrame(frame);
}

async function initialize(){
 try{
  engine=await loadSourceEngine();
  renderer=new NativeRenderer($('canvas'),{compact:true,fontSize:fontSize(),top:58,variant:11,structural:true,motionMode:'close'});
  await update();
  focusInput();
 }catch(error){$('error').textContent=error.message;}
 requestAnimationFrame(frame);
}

initialize();
