const ease=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
// Select a real stroke chain; its segment lengths determine the distance reached.
export function createUnfoldRig(paths){
 let best=null;
 for(const path of paths){
  if(path.length<2)continue;
  const left=path.reduce((a,p,i)=>p.x<path[a].x?i:a,0),right=path.reduce((a,p,i)=>p.x>path[a].x?i:a,0);
  let chain=path.slice(Math.min(left,right),Math.max(left,right)+1);
  if(left>right)chain.reverse();
  if(chain.length<2||chain.at(-1).x-chain[0].x<1){chain=path.slice();if(chain.at(-1).y>chain[0].y)chain.reverse();}
  const length=chain.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-chain[i].x,p.y-chain[i].y),0);
  const score=length-(chain.at(-1).x-chain[0].x);
  if(!best||score>best.score)best={chain,score};
 }
 const chain=best.chain,origin=chain[0],segments=chain.slice(1).map((p,i)=>({length:Math.hypot(p.x-chain[i].x,p.y-chain[i].y),angle:Math.atan2(p.y-chain[i].y,p.x-chain[i].x)}));
 const tip=chain.at(-1),length=segments.reduce((s,p)=>s+p.length,0),step=length-(tip.x-origin.x);
 function shape(amount){
  let x=origin.x,y=origin.y;const points=[{x,y}];
  segments.forEach(s=>{x+=s.length*Math.cos(s.angle*(1-amount));y+=s.length*Math.sin(s.angle*(1-amount));points.push({x,y});});
  const correction=tip.y-points.at(-1).y;
  return points.map((p,i)=>({x:p.x,y:p.y+correction*i/(points.length-1)}));
 }
 const bindings=paths.map(path=>path.map(p=>{
  let nearest={distance:Infinity};
  for(let i=0;i<chain.length-1;i++){
   const a=chain[i],b=chain[i+1],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),distance=(p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2;
   if(distance<nearest.distance)nearest={distance,i,t};
  }return nearest;
 }));
 return {chain,bindings,step,shape};
}
export function unfoldStep(time){
 const cycle=Math.floor(time),phase=time-cycle,front=ease(phase/.38),rear=ease((phase-.48)/.38);
 return {cycle,front,rear,amount:front*(1-rear)};
}
export function unfoldPaths(paths,rig,time,distance=rig.step){
 const state=unfoldStep(time),posed=rig.shape(state.amount),tipDelta=posed.at(-1).x-rig.chain.at(-1).x;
 // Once the tip has landed, fold back around that fixed tip. Translation follows
 // from the lost horizontal reach, rather than an independent catch-up tween.
 const shift=state.cycle*distance+(state.rear>0?distance-tipDelta*(distance/(rig.step||1)):0);
 return paths.map((path,s)=>path.map((p,j)=>{
  const {i,t}=rig.bindings[s][j],a=rig.chain[i],b=rig.chain[i+1],u=posed[i],v=posed[i+1];
  return {x:p.x+(distance/(rig.step||1))*((u.x-a.x)*(1-t)+(v.x-b.x)*t)+shift,y:p.y+(u.y-a.y)*(1-t)+(v.y-b.y)*t};
 }));
}
