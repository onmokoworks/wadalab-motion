import {readFile} from 'node:fs/promises';
import {SourceEngine} from './web/source-engine.js';

const read=path=>readFile(new URL(path,import.meta.url),'utf8').then(JSON.parse);
const [program,glyphs,ascii]=await Promise.all([read('./web/source-program.json'),read('./web/source-glyphs.json'),read('./web/font/ascii-outlines.json')]);
const engine=new SourceEngine(program,glyphs,ascii),checked=[];
for(const character of ['A','a','0','1','2','3','&','?']){const glyph=engine.make(character,11);if(glyph.sourceCharacter!==character)throw Error(`${character} was replaced by another code point`);if(!glyph.outlineOnly||!glyph.restEntries.length)throw Error(`${character} has no TrueType outline`);if(glyph.restEntries.some(entry=>!/^M/.test(entry.d)||/NaN|Infinity/.test(entry.d)))throw Error(`${character} has an invalid SVG path`);checked.push({character,contours:glyph.restEntries.length,advance:glyph.advance});}
if(JSON.stringify(engine.make('A').rest)===JSON.stringify(engine.make('Ａ').rest))throw Error('ASCII A still resolves to the old fullwidth CLWFK glyph');
console.log(JSON.stringify({passed:checked.length,source:ascii.source,checked}));
