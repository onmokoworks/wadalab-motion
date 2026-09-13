import {FoldRenderer} from './renderer.js';
import {missingCharacters} from './font-support.js';
const $=id=>document.getElementById(id);
let renderer,metadata,token=0,debounce,composing=false,time=0,last=0;
async function generate(mine=++token){
 clearTimeout(debounce);if(!renderer)return;const text=$('text').value;const missing=missingCharacters(metadata,text);$('error').textContent=missing.length?`フォント未収録：${missing.join('・')}`:'';
 const display=Array.from(text).map(c=>missing.includes(c)?' ':c).join('');
 await renderer.setText(display,()=>mine===token);if(mine===token){document.querySelector('canvas').dataset.glyphs=String(renderer.placed.length);}
}
function schedule(){const mine=++token;clearTimeout(debounce);debounce=setTimeout(()=>generate(mine),80);}
$('text').addEventListener('compositionstart',()=>{composing=true;++token;clearTimeout(debounce)});$('text').addEventListener('compositionend',()=>{composing=false;schedule()});$('text').addEventListener('input',()=>{if(!composing)schedule()});
$('info').onclick=async()=>{$('license').showModal();try{const r=await fetch('/LICENSE.txt');if(!r.ok)throw Error();$('license-text').textContent=await r.text();}catch{$('license-text').textContent='ライセンスを読み込めませんでした。'}};
$('close').onclick=()=>$('license').close();$('license').addEventListener('click',e=>{if(e.target===$('license')){const r=$('license').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('license').close();}});$('license').addEventListener('close',()=>$('text').focus());
addEventListener('resize',()=>renderer?.layout());
function frame(now){if(renderer&&!document.hidden&&!$('license').open){time+=last?Math.min(.1,(now-last)/1000):0;renderer.draw(now/1000,{staticAmount:matchMedia('(prefers-reduced-motion: reduce)').matches?0:null});}last=now;requestAnimationFrame(frame)}
async function initialize(){try{const font=new FontFace('WadalabActual','url(/font/wlmaru2004emoji.ttf)');await font.load();document.fonts.add(font);metadata=await fetch('/font/metadata.json').then(r=>r.json());renderer=new FoldRenderer($('canvas'));await generate();requestAnimationFrame(frame);}catch(e){$('error').textContent=e.message;}}
$('text').focus();$('text').select();initialize();


