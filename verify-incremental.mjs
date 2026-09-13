import assert from 'node:assert/strict';
import test from 'node:test';
import {FoldRenderer} from './web/renderer.js';

function renderer(items=[]){return {items,stagger:.07,make:segment=>({text:segment}),layout(){this.layouts=(this.layouts??0)+1;},prune(){}};}

test('typing appends one animated glyph without restarting the existing prefix',async()=>{
 const existing={segment:'あ',glyph:{text:'あ'},born:1},r=renderer([existing]);
 await FoldRenderer.prototype.setText.call(r,'あい',()=>true,10);
 assert.equal(r.items[0],existing);assert.equal(r.items[0].born,1);assert.equal(r.items[1].born,10);
});

test('a large paste keeps its complete entry queue below one second',async()=>{
 const r=renderer(),text='天地玄黄宇宙洪荒日月盈昃辰宿列張寒来暑往秋収冬蔵閏余成歳律呂調陽雲騰致雨露結為霜金生麗水玉出崑岡剣号巨闕珠称夜光果珍李柰菜重芥薑海鹹河淡鱗潜羽翔';
 await FoldRenderer.prototype.setText.call(r,text,()=>true,20);
 assert.equal(r.items.length,Array.from(text).length);assert.ok(r.items.at(-1).born-r.items[0].born<=.800001);
});
