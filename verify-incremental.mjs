import assert from 'node:assert/strict';
import test from 'node:test';
import {FoldRenderer} from './web/renderer.js';
import {NativeRenderer} from './web/native-renderer.js';
import {relaySchedule} from './web/structure.js';
import {textThrough} from './web/playback-control.js';

function renderer(items=[]){return {items,duration:.35,stagger:.07,make:segment=>({text:segment}),layout(){this.layouts=(this.layouts??0)+1;},prune(){}};}

test('typing appends one animated glyph without restarting the existing prefix',async()=>{
 const existing={segment:'あ',glyph:{text:'あ'},born:1},r=renderer([existing]);
 await FoldRenderer.prototype.setText.call(r,'あい',()=>true,10);
 assert.equal(r.items[0],existing);assert.equal(r.items[0].born,1);assert.equal(r.items[1].born,10);
});

test('a large paste keeps a stable overlapping interval without batch restarts',async()=>{
 const r=renderer(),text='天地玄黄宇宙洪荒日月盈昃辰宿列張寒来暑往秋収冬蔵閏余成歳律呂調陽雲騰致雨露結為霜金生麗水玉出崑岡剣号巨闕珠称夜光果珍李柰菜重芥薑海鹹河淡鱗潜羽翔';
 await FoldRenderer.prototype.setText.call(r,text,()=>true,20);
 assert.equal(r.items.length,Array.from(text).length);for(let i=1;i<r.items.length;i++)assert.ok(r.items[i].born-r.items[i-1].born>=r.stagger-.000001);
});

test('the animation frontier advances through a long paste without starting the remainder together',async()=>{
 const r=renderer(),text='文字禍'.repeat(200);
 await FoldRenderer.prototype.setText.call(r,text,()=>true,20);
 assert.equal(r.items.length,600);
 for(let i=1;i<r.items.length;i++)assert.ok(r.items[i].born-r.items[i-1].born>=r.stagger-.000001);
 const view={duration:.35,placed:r.items.map((item,index)=>({...item,sourceIndex:index,y:index*10,size:50}))};
 const frontier=NativeRenderer.prototype.animationFrontier.call(view,20.5);
 assert.ok(frontier.sourceIndex>0&&frontier.sourceIndex<20);
 assert.ok(r.items.at(-1).born>50);
});

test('backspace cutoff keeps the animating character and discards every queued character after it',()=>{
 const items=[...'文字禍を読む'].map(segment=>({segment}));
 assert.equal(textThrough(items,2),'文字禍');
 assert.equal(textThrough(items,4),'文字禍を読');
});

test('slow generation cannot leave queued entry times in the past',async()=>{
 let clock=30;const r=renderer();r.make=segment=>{clock+=.12;return {text:segment};};
 await FoldRenderer.prototype.setText.call(r,'和田研究',()=>true,()=>clock);
 for(let i=0;i<r.items.length;i++){assert.ok(r.items[i].born>=30.12+i*.12-.000001);if(i)assert.ok(r.items[i].born>r.items[i-1].born);}
});

test('an unchanged suffix cannot appear before newly inserted middle text',async()=>{
 const previous=[...('計算の役割')].map((segment,i)=>({segment,glyph:{text:segment},born:1+i*.07})),r=renderer(previous);
 await FoldRenderer.prototype.setText.call(r,'計算機の役割',()=>true,10);
 assert.equal(r.items[0],previous[0]);assert.equal(r.items[1],previous[1]);
 for(let i=1;i<r.items.length;i++)assert.ok(r.items[i].born-r.items[i-1].born>=r.stagger-.000001);
 assert.ok(r.items[4].born>=r.items[3].born+r.stagger-.000001);
});

test('a blank character does not restart a relay from an earlier base time',()=>{
 const strategy={parts:[{path:[{x:0,y:0},{x:10,y:0}]}]},items=[{glyph:{strategy},born:1},{glyph:null,born:1.07},{glyph:{strategy},born:1.14}],times=relaySchedule(items,.35);
 assert.ok(times[1]>=times[0]+.21-.000001);assert.ok(times[2]>=times[1]+.07-.000001);
});

test('the drawn caret follows the selection, including across a line break',()=>{
 globalThis.devicePixelRatio??=1;
 const glyph={advance:1,centerX:0,centerY:0},items=[{segment:'a',glyph},{segment:'b',glyph},{segment:'\n',glyph:null},{segment:'c',glyph}];
 const view={items,options:{fontSize:100,pad:4,top:0},canvas:{parentElement:{getBoundingClientRect:()=>({width:1000,height:500})},style:{}},caretFor:FoldRenderer.prototype.caretFor};
 FoldRenderer.prototype.layout.call(view);
 assert.deepEqual(view.slots.map(({x,y})=>[x,y]),[[4,8],[110,8],[216,8],[4,143],[110,143]]);
 assert.equal(view.caret,view.slots[4]);
 view.caretIndex=1;FoldRenderer.prototype.layout.call(view);
 assert.equal(view.caret.x,110);
 assert.equal(view.caretFor(99),view.slots[4]);
});
