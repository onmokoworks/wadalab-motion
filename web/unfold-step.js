const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
// Fold into a compact pose, then use the index renderer's actual C5 unfolding.
export function unfoldStep(time,step=200){
 const cycle=Math.floor(time),phase=time-cycle;
 const progress=phase<.24?1-ease(phase/.24):ease((phase-.24)/.62);
 return {progress,travel:step*(cycle+ease((phase-.24)/.62))};
}
