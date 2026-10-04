const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
// First extend the front while the rear stays planted, then pull the rear in.
// The front finishes before catch-up starts. Each cycle restores the glyph.
export function walkingPoint(point,{lead=0,step,time}){
 const cycle=Math.floor(time),phase=time-cycle,position=Math.max(0,Math.min(1,lead));
 const front=smooth(phase/.36),rear=smooth((phase-.44)/.36);
 return {x:point.x+step*(cycle+position*front+(1-position)*rear),y:point.y};
}

// Select one tip per character. Only its short adjoining section stretches.
export function leadingWeights(strokes){
 let tip={stroke:0,point:0,x:-Infinity};
 strokes.forEach((stroke,s)=>stroke.points.forEach((point,i)=>{if(point.x>tip.x)tip={stroke:s,point:i,x:point.x};}));
 return strokes.map((stroke,s)=>{
  if(s!==tip.stroke)return stroke.points.map(()=>0);
  const distances=[0];for(let i=1;i<stroke.points.length;i++)distances.push(distances[i-1]+Math.hypot(stroke.points[i].x-stroke.points[i-1].x,stroke.points[i].y-stroke.points[i-1].y));
  const reach=Math.max(1,distances.at(-1)*.22);
  return distances.map(distance=>smooth(1-Math.abs(distance-distances[tip.point])/reach));
 });
}
