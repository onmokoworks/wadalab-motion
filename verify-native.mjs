import fs from 'node:fs';import {SourceEngine} from './web/source-engine.js';
const e=new SourceEngine(JSON.parse(fs.readFileSync(new URL('./web/source-program.json',import.meta.url))),JSON.parse(fs.readFileSync(new URL('./source-audit/source-fixture.json',import.meta.url))));
for(const ch of 'あ永木林。一田'){try{const g=e.make(ch);for(const t of [.2,.5,.8,1]){e.outline(g,t);e.outline(g,t,true);}console.log(ch,'OK',g.strokes.length);}catch(err){console.error(ch,err);process.exitCode=1;}}
