const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
// Prepare only a shallow fold, reach forwards, then bring the rear up.
export function unfoldStep(time,step=200){
 const cycle=Math.floor(time),phase=time-cycle;
 const prepare=ease(phase/.16),front=ease((phase-.16)/.34),rear=ease((phase-.54)/.30);
 return {progress:1-.28*prepare*(1-front),cycle,front,rear};
}
export function reachPoint(rest,posed,weight,state,step=200){
 return {x:rest.x+(posed.x-rest.x)*weight+step*(state.cycle+weight*state.front+(1-weight)*state.rear),y:rest.y+(posed.y-rest.y)*weight};
}
