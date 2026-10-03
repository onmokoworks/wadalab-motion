import {SourceEngine} from './source-engine.js';
import {clamp,smooth} from './fold-core.js';

// Shared by the SVG example and the public, DOM-free API.
export function prepareGlyph(engine,text,rule=11) {
 const glyph=engine.make(text,rule),alpha=engine.alpha.get(glyph.sourceCharacter);
 if(alpha){glyph.outlineOnly=false;glyph.lineWidth=alpha.width;glyph.alphaMotion=true;}
 if(text==='：'){
  glyph.outlineOnly=false;
  glyph.colonDots=glyph.strokes.map(stroke=>{
   const points=stroke.ids.map(id=>glyph.points[id]),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
   return {stroke:stroke.id,x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,width:Math.max(...xs)-Math.min(...xs)};
  });
 }
 return glyph;
}

export function dotGeometry(piece) {
 const {x,y}=piece.path[0],radiusX=piece.dotWidth/2,radiusY=radiusX*piece.dotScale;
 return {center:{x,y:y+radiusX-radiusY},radiusX,radiusY};
}

/** Data is supplied by the caller; no fetch, DOM, timer or rendering context. */
export function createMotionLibrary({program,glyphs,ascii,alpha}) {
 if(!Array.isArray(program)||!Array.isArray(glyphs)||!Array.isArray(ascii?.glyphs)||!Array.isArray(alpha?.glyphs))throw new TypeError('Expected program, glyphs, ascii and alpha datasets');
 const engine=new SourceEngine(program,glyphs,ascii,alpha);
 return {
  has:character=>Boolean(engine.resolve(character)),
  characters:()=>[...new Set([...engine.glyphs.keys(),...engine.ascii.keys()])],
  sample(character,progress){
   if(typeof character!=='string'||[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(character)].length!==1)throw new TypeError('Expected one character');
   if(!Number.isFinite(progress))throw new TypeError('Expected finite progress');
   if(!engine.resolve(character))return null;
   const glyph=prepareGlyph(engine,character),p=clamp(progress);
   const frame={character,progress:p,unitsPerEm:400,yAxis:'down',advance:glyph.advance*400};
   if(glyph.outlineOnly)return {...frame,kind:'outline',contours:glyph.restEntries.map(entry=>entry.d),reveal:smooth(clamp(p/.55))};
   return {...frame,kind:'paths',strokes:engine.closeLoopPaths(glyph,1-p).map(piece=>piece.dotWidth?
    {id:piece.stroke,kind:'dot',...dotGeometry(piece)}:
    {id:piece.stroke,kind:'line',width:glyph.lineWidth??16,points:piece.path.map(({x,y})=>({x,y}))})};
  }
 };
}
