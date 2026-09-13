import {glyphImage} from './renderer.js';
import {buildRig} from './fold-core.js';

// Developer integration API; the normal text-only screen has no export controls.
export async function exportGlyph(grapheme){
 if(!document.fonts.check('16px WadalabActual')){
  const font=await new FontFace('WadalabActual','url(/font/wlmaru2004emoji.ttf)').load();document.fonts.add(font);
 }
 const {canvas,alpha,...metrics}=glyphImage(grapheme),rig=buildRig(alpha,256,256);
 return {rig,metrics,mask:await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))};
}
