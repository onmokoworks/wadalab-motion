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
 const circles=strokes.map((stroke,s)=>{
  const p=stroke.points,length=p.slice(1).reduce((sum,q,i)=>sum+Math.hypot(q.x-p[i].x,q.y-p[i].y),0);
  const angles=p.slice(1).map((q,i)=>Math.atan2(q.y-p[i].y,q.x-p[i].x));let signed=0,total=0;
  for(let i=1;i<angles.length;i++){const turn=Math.atan2(Math.sin(angles[i]-angles[i-1]),Math.cos(angles[i]-angles[i-1]));signed+=turn;total+=Math.abs(turn);}
  const gap=Math.hypot(p[0].x-p.at(-1).x,p[0].y-p.at(-1).y);
  return {s,length,circular:Math.abs(signed)>Math.PI*1.3&&Math.abs(signed)/(total||1)>.7&&gap<length*.25};
 }).filter(row=>row.circular).sort((a,b)=>b.length-a.length);

 return strokes.map((stroke,s)=>{
  const points=stroke.points,circular=circles.some(row=>row.s===s);
  const tips=circular?[points.reduce((best,q,i)=>q.y<points[best].y?i:best,0),points.reduce((best,q,i)=>q.y>points[best].y?i:best,0)]:[points.reduce((best,q,i)=>q.x>points[best].x?i:best,0)];
  const distances=[0];for(let i=1;i<stroke.points.length;i++)distances.push(distances[i-1]+Math.hypot(stroke.points[i].x-stroke.points[i-1].x,stroke.points[i].y-stroke.points[i-1].y));
  const reach=Math.max(1,distances.at(-1)*.22);
  const last=stroke.points.at(-1),first=stroke.points[0],closed=Math.hypot(last.x-first.x,last.y-first.y)<distances.at(-1)*.05;
  return distances.map(distance=>{let gap=Math.min(...tips.map(index=>{const d=Math.abs(distance-distances[index]);return closed?Math.min(d,distances.at(-1)-d):d;}));return smooth(1-gap/reach);});
 });
}
