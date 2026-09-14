import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SourceEngine} from './web/source-engine.js';

const engine=new SourceEngine(JSON.parse(fs.readFileSync('./web/source-program.json')),JSON.parse(fs.readFileSync('./web/source-glyphs.json')),JSON.parse(fs.readFileSync('./web/font/ascii-outlines.json')));

for(const [wide,narrow] of [['Ａ','A'],['Ｚ','Z'],['ａ','a'],['ｚ','z'],['０','0'],['９','9']]){
 assert.equal(engine.resolve(wide),narrow,`${wide}: TTFの${narrow}へ解決`);
 const wideGlyph=engine.make(wide,11),narrowGlyph=engine.make(narrow,11);
 assert.equal(wideGlyph.sourceCharacter,narrow);
 assert.deepEqual(wideGlyph.rest,narrowGlyph.rest,`${wide}: 半角と同じ輪郭`);
 assert.equal(wideGlyph.advance,1,`${wide}: 全角字送りを維持`);
 assert.equal(wideGlyph.centerX,.75,`${wide}: 全角枠内で中央配置`);
}

assert.equal(engine.resolve('！'),'！','全角句読点は変換しない');
console.log(JSON.stringify({fullwidthAlphanumerics:'TTF outlines',advance:'fullwidth',alignment:'center'}));
