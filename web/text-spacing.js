// Corner brackets retain their outer half-em side bearing. Cropping every
// glyph to its ink bounds incorrectly removes the space outside the quotation.
export function layoutText(characters,getGlyph){
 let advance=0;
 const positions=characters.map(character=>{
  const glyph=getGlyph(character);
  if('「『'.includes(character)){
   const x=advance-200;advance+=200;return x;
  }
  if('」』'.includes(character)){
   const x=advance;advance+=200;return x;
  }
  const x=advance-glyph.left;advance+=glyph.width+24;return x;
 });
 return {positions,width:advance};
}
