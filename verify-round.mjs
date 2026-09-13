import fs from 'node:fs';
import {SourceEngine} from './web/source-engine.js';

const program=JSON.parse(fs.readFileSync(new URL('./web/source-program.json',import.meta.url)));
const glyphs=JSON.parse(fs.readFileSync(new URL('./web/source-glyphs.json',import.meta.url)));
const engine=new SourceEngine(program,glyphs);
const expected=new Map([['の',1],['あ',1],['め',1],['ぬ',1],['一',0],['永',0]]);
for(const [character,count] of expected){
 const glyph=engine.make(character,11);
 if(glyph.roundStrokes.size!==count)throw Error(`${character}: 円弧判定 ${glyph.roundStrokes.size}（期待 ${count}）`);
 const pieces=engine.cPlusStrokePaths(glyph,.65);
 for(const stroke of glyph.roundStrokes)if(!pieces.some(piece=>piece.stroke===stroke&&piece.path.length>=2))throw Error(`${character}: 円弧の動作パスなし`);
 for(const stroke of glyph.roundStrokes)if(pieces.filter(piece=>piece.stroke===stroke).length!==1)throw Error(`${character}: 一画の円弧が複数トリムに分割されています`);
}
const length=piece=>piece.path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-piece.path[i].x,p.y-piece.path[i].y),0);
const no=engine.make('の',11),noCPlus=engine.cPlusStrokePaths(no,.8),noSource=no.strokes[[...no.roundStrokes][0]].motionPath;
if(noCPlus.length!==1||noCPlus[0].path.some((point,i)=>Math.hypot(point.x-noSource[i].x,point.y-noSource[i].y)>1e-7))throw Error('の: C＋で円弧が回転または分割されています');
for(const character of ['ト','ス']){
 const glyph=engine.make(character,11),start=engine.cPlusStrokePaths(glyph,1),early=engine.cPlusStrokePaths(glyph,.8),rest=engine.cPlusStrokePaths(glyph,0);
 const metrics=glyph.strokes.map(stroke=>{const path=stroke.motionPath,len=path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.y-path[i].y),0),chord=Math.hypot(path.at(-1).x-path[0].x,path.at(-1).y-path[0].y);return {id:stroke.id,len,straightness:chord/(len||1)}}).filter(row=>row.straightness>.95).sort((a,b)=>b.len-a.len),axis=metrics[0].id;
 if(start.filter(piece=>piece.stroke===axis).some(piece=>length(piece)>1e-7))throw Error(`${character}: 主軸が長さ0から始まりません`);
 if(!early.some(piece=>piece.stroke===axis&&length(piece)>1))throw Error(`${character}: 主軸が伸びません`);
 if(new Set(rest.map(piece=>piece.stroke)).size!==rest.length)throw Error(`${character}: 同じ一画が複数パスに分かれています`);
 if(character==='ト'){const a=early.find(piece=>piece.stroke===axis),source=glyph.strokes[axis].motionPath,av={x:a.path.at(-1).x-a.path[0].x,y:a.path.at(-1).y-a.path[0].y},bv={x:source.at(-1).x-source[0].x,y:source.at(-1).y-source[0].y};if(Math.abs(av.x*bv.y-av.y*bv.x)>1e-5)throw Error('ト: 最長縦画が回転しています');}
}
const bun=engine.make('文',11),bunPaths=engine.cPlusStrokePaths(bun,.6);if(new Set(bunPaths.map(piece=>piece.stroke)).size!==bunPaths.length)throw Error('文: 一画が複数パスに分かれています');
const turning=path=>{const angles=path.slice(1).map((point,i)=>Math.atan2(point.y-path[i].y,point.x-path[i].x));return angles.slice(1).reduce((sum,angle,i)=>sum+Math.abs(Math.atan2(Math.sin(angle-angles[i]),Math.cos(angle-angles[i]))),0);};
const shi=engine.make('し',11),shiPlan=shi.arcUnfoldPlans.get(0),shiStart=engine.cPlus2StrokePaths(shi,1)[0],shiEarly=engine.cPlus2StrokePaths(shi,.8)[0],shiRest=engine.cPlus2StrokePaths(shi,0)[0],shiSource=shi.strokes[0].motionPath;
if(!shiPlan||shiPlan.reverse)throw Error('し: 直線部分を曲線の根元として検出できません');if(length(shiStart)>1e-7)throw Error('し: C＋2が長さ0から始まりません');if(turning(shiEarly.path)>=turning(shiSource)*.5)throw Error('し: 初期状態で弧が十分に伸びていません');const earlyVector={x:shiEarly.path[1].x-shiEarly.path[0].x,y:shiEarly.path[1].y-shiEarly.path[0].y},sourceVector={x:shiSource[1].x-shiSource[0].x,y:shiSource[1].y-shiSource[0].y};if(Math.abs(earlyVector.x*sourceVector.y-earlyVector.y*sourceVector.x)>1e-5)throw Error('し: 直線軸が回転しています');if(shiRest.path.some((point,i)=>Math.hypot(point.x-shiSource[i].x,point.y-shiSource[i].y)>1e-7))throw Error('し: 完成形が原典へ戻りません');
console.log(JSON.stringify({passed:expected.size+5,characters:[...expected.keys(),'ト','ス','文','し'],cPlus:['円弧は無回転','最長直線は軸方向へ伸長','原典の一画は一つの連続パス'],cPlus2:['直線軸は無回転','曲率を根元から先端へ展開']}));
