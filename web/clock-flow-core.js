import {prepareGlyph,dotGeometry} from './motion-library.js';
// Use the same rule 11 / C5 pose generator as the typing page.
export function createClockMotion(engine){
 const glyphs=new Map();
 for(const character of '0123456789:'){
  const glyph=prepareGlyph(engine,character),rest=engine.closeLoopPaths(glyph,0),xs=rest.flatMap(p=>p.path.map(p=>p.x));
  glyphs.set(character,{glyph,offset:100-(Math.min(...xs)+Math.max(...xs))/2});
 }
 function pose(character,amount){
  const {glyph,offset}=glyphs.get(character);
  return engine.closeLoopPaths(glyph,amount).map(piece=>{
   const path=piece.dotWidth?(()=>{const d=dotGeometry(piece);return Array.from({length:25},(_,i)=>({x:d.center.x+Math.cos(i/24*Math.PI*2)*d.radiusX,y:d.center.y+Math.sin(i/24*Math.PI*2)*d.radiusY}));})():piece.path;
   return path.map(p=>({x:p.x+offset,y:p.y}));
  });
 }
 return {pose,transition(from,to,progress){
  if(from===to||progress>=1)return pose(to,0);
  if(progress<=0)return pose(from,0);
  if(progress===.5)return [];
  return progress<.5?pose(from,progress*2):pose(to,(1-progress)*2);
 }};
}
