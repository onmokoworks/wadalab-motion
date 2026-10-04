const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
// First extend the front while the rear stays planted, then pull the rear in.
// The front finishes before catch-up starts. Each cycle restores the glyph.
export function walkingPoint(point,{lead=0,step,time}){
 const cycle=Math.floor(time),phase=time-cycle,position=Math.max(0,Math.min(1,lead));
 const front=smooth(phase/.36),rear=smooth((phase-.44)/.36);
 return {x:point.x+step*(cycle+position*front+(1-position)*rear),y:point.y};
}

// Find a leading point in each vertical part of a path, not one per glyph.
export function leadingWeights(strokes){
 const circles=strokes.map((stroke,s)=>{
  const p=stroke.points,length=p.slice(1).reduce((sum,q,i)=>sum+Math.hypot(q.x-p[i].x,q.y-p[i].y),0);
  const angles=p.slice(1).map((q,i)=>Math.atan2(q.y-p[i].y,q.x-p[i].x));let signed=0,total=0;
  for(let i=1;i<angles.length;i++){const turn=Math.atan2(Math.sin(angles[i]-angles[i-1]),Math.cos(angles[i]-angles[i-1]));signed+=turn;total+=Math.abs(turn);}
  const gap=Math.hypot(p[0].x-p.at(-1).x,p[0].y-p.at(-1).y);
  return {s,length,circular:Math.abs(signed)>Math.PI*1.3&&Math.abs(signed)/(total||1)>.7&&gap<length*.25};
 }).filter(row=>row.circular).sort((a,b)=>b.length-a.length);

 const weights=strokes.map((stroke,s)=>{
  const points=stroke.points,circular=circles.some(row=>row.s===s);
  const top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
  const tips=circular?[points.reduce((best,q,i)=>q.y<points[best].y?i:best,0),points.reduce((best,q,i)=>q.y>points[best].y?i:best,0)]:[0,1,2].map(band=>{
   const candidates=points.map((p,i)=>({p,i})).filter(({p})=>Math.min(2,Math.floor((p.y-top)/(bottom-top||1)*3))===band);
   return candidates.reduce((best,row)=>!best||row.p.x>best.p.x?row:best,null)?.i;
  }).filter(i=>i!==undefined);
  const distances=[0];for(let i=1;i<stroke.points.length;i++)distances.push(distances[i-1]+Math.hypot(stroke.points[i].x-stroke.points[i-1].x,stroke.points[i].y-stroke.points[i-1].y));
  const reach=Math.max(1,distances.at(-1)*.10);
  const last=stroke.points.at(-1),first=stroke.points[0],closed=Math.hypot(last.x-first.x,last.y-first.y)<distances.at(-1)*.05;
  return distances.map(distance=>{let gap=Math.min(...tips.map(index=>{const d=Math.abs(distance-distances[index]);return closed?Math.min(d,distances.at(-1)-d):d;}));return smooth(1-gap/reach);});
 });
 // One horizontal displacement field per glyph: vertically aligned points
 // receive exactly the same motion, including across disconnected strokes.
 const points=strokes.flatMap(stroke=>stroke.points),left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x));
 const origins=strokes.flatMap((stroke,s)=>stroke.points.filter((p,i)=>weights[s][i]>.999999).map(p=>p.x));
 const reach=Math.max(1,(right-left)*.16);
 return strokes.map(stroke=>stroke.points.map(p=>Math.max(0,...origins.map(x=>smooth(1-Math.abs(p.x-x)/reach)))));
}
