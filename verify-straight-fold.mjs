import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SourceEngine} from './web/source-engine.js';

const engine=new SourceEngine(JSON.parse(fs.readFileSync('./web/source-program.json')),JSON.parse(fs.readFileSync('./web/source-glyphs.json')),JSON.parse(fs.readFileSync('./web/font/ascii-outlines.json')));
const length=path=>path.slice(1).reduce((sum,point,i)=>sum+Math.hypot(point.x-path[i].x,point.y-path[i].y),0);

for(const character of [...'出羽良彰コロヨユキサホモハリカタ']){
 const glyph=engine.make(character,11),start=engine.closeLoopPaths(glyph,1),middle=engine.closeLoopPaths(glyph,.58),end=engine.closeLoopPaths(glyph,0);
 assert.equal(glyph.straightFoldProfile.enabled,true,`${character}: 直線骨格モード`);
 assert.ok(start.every(piece=>length(piece.path)<1e-6),`${character}: 全画が0から始まる`);
 assert.ok(end.every((piece,index)=>piece.path.every((point,i)=>Math.hypot(point.x-glyph.strokes[index].motionPath[i].x,point.y-glyph.strokes[index].motionPath[i].y)<1e-6)),`${character}: 原典へ正確に戻る`);
 const articulated=[...glyph.straightFoldProfile.plans.values()].filter(plan=>plan.mode==='hinge'||plan.mode==='slide');
 assert.ok(articulated.length>0,`${character}: トリム以外の受け渡しがある`);
 assert.ok(middle.every(piece=>piece.path.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))),`${character}: 中間形が有限`);
}

for(const character of [...'のし']){
 const glyph=engine.make(character,11);engine.closeLoopPaths(glyph,.5);
 assert.equal(glyph.straightFoldProfile.enabled,false,`${character}: 曲線用C+5を維持`);
}

console.log(JSON.stringify({straightMode:'出羽良彰・直線主体カタカナ',rules:['seed','hinge','slide'],curves:'existing C+5'}));
