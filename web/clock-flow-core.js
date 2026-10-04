import {foldStrokePath,strokeVisibility} from './clock-core.js';
import {clamp} from './fold-core.js';
// The original clock's renderer, shared by the single and flowing clocks.
export function clockGlyphFrame(glyph,amount){
 const progress=clamp(1-amount),points=glyph.paths.flat(),left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x));
 return {offset:glyph.advance/2-(left+right)/2,opacity:strokeVisibility(progress),paths:glyph.paths.map(path=>foldStrokePath(path,progress))};
}
export function clockLayers(current,previous,progress){
 const outgoing=clamp(progress/.6),incoming=clamp((progress-.4)/.6);
 return [{glyph:previous,amount:outgoing,visible:Boolean(previous&&progress<1)},{glyph:current,amount:1-incoming,visible:true}];
}
