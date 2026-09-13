import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
async function generate(text,params={}){const response=await fetch('http://127.0.0.1:4184/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,steps:60,...params})});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;}
test('original CLWFK final output matches animated final frames',async()=>{
 const direct=spawnSync('java',['-Dfile.encoding=UTF-8','-jar','runtime/abcl.jar','--noinform','--batch','--load','engine/reference.lisp'],{encoding:'utf8',timeout:30000,windowsHide:true,maxBuffer:4000000});assert.equal(direct.status,0,direct.stderr);
 const reference=JSON.parse(direct.stdout.split('\n').find(l=>l.startsWith('@')).slice(1));const result=await generate('永語あ');
 result.glyphs.forEach((g,i)=>{assert.ok(!g.error,g.message);assert.deepEqual(g.frames.at(-1).outlines.map(o=>o.points.map(p=>[p.kind,p.x,p.y])),reference[i]);assert.equal(g.frames[0].outlines.length,0);assert.notDeepEqual(g.frames[10].outlines,g.frames[59].outlines);});
});
test('all 3 original styles generate kanji, kana and alphabet',async()=>{
 for(const style of ['mincho','gothic','maru']){const result=await generate('永語鬱あいうアイウabc',{style,steps:3});assert.equal(result.glyphs.length,12);for(const g of result.glyphs){assert.ok(!g.error,`${style}/${g.character}: ${g.message}`);for(const f of g.frames)for(const o of f.outlines)for(const p of o.points)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}}
});
test('lower and upper case remain distinct; missing emoji is explicit',async()=>{const result=await generate('Ａa😀',{steps:2});assert.equal(result.glyphs[0].sourceCharacter,'Ａ');assert.equal(result.glyphs[1].sourceCharacter,'ａ');assert.notDeepEqual(result.glyphs[0].frames[1],result.glyphs[1].frames[1]);assert.equal(result.glyphs[2].error,'missing');});
test('parameter extremes produce finite animation',async()=>{for(const params of [{weight:2,serif:.1,contrast:.2},{weight:16,serif:1.5,contrast:.8}]){const result=await generate('永語あアa',{...params,steps:12});for(const g of result.glyphs){assert.ok(!g.error,`${g.character}: ${g.message}`);for(const f of g.frames)for(const o of f.outlines)for(const p of o.points)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}}});
