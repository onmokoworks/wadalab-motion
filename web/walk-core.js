const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
// Right edge leads; the left catches up. Every cycle ends in rigid translation.
export function walkingPoint(point,{left,right,step,time}){
 const cycle=Math.floor(time),phase=time-cycle,position=Math.max(0,Math.min(1,(point.x-left)/(right-left||1)));
 return {x:point.x+step*(cycle+smooth((phase-(1-position)*.48)/.52)),y:point.y};
}
