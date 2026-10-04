const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export function resample(path,count=48){
 const lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths.at(-1)+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y));
 let segment=1;return Array.from({length:count},(_,i)=>{const d=lengths.at(-1)*i/(count-1);while(segment<path.length-1&&lengths[segment]<d)segment++;return mix(path[segment-1]??path[0],path[segment]??path[0],(d-lengths[segment-1])/(lengths[segment]-lengths[segment-1]||1));});
}
const center=path=>path.reduce((s,p)=>({x:s.x+p.x/path.length,y:s.y+p.y/path.length}),{x:0,y:0});
const squared=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
export function buildMorph(from,to){
 const a=from.map(p=>resample(p)),b=to.map(p=>resample(p)),pairs=[],unused=new Set(b.map((_,i)=>i));
 for(const path of a){
  let selected=-1,cost=Infinity;for(const i of unused){const c=squared(center(path),center(b[i]));if(c<cost){cost=c;selected=i;}}
  if(selected<0){const p=center(path);pairs.push([path,path.map(()=>p)]);continue;}
  unused.delete(selected);let target=b[selected];
  const score=q=>path.reduce((sum,p,i)=>sum+squared(p,q[i]),0);
  if(score(target.slice().reverse())<score(target))target=target.slice().reverse();
  // Closed curves can start at any sample: align their seam before morphing.
  if(squared(path[0],path.at(-1))<1e-6&&squared(target[0],target.at(-1))<1e-6){
   let best=target,bestCost=score(target);for(let shift=1;shift<target.length-1;shift++){const q=target.slice(0,-1).map((_,i)=>target[(i+shift)%(target.length-1)]);q.push(q[0]);const c=score(q);if(c<bestCost){best=q;bestCost=c;}}target=best;
  }
  pairs.push([path,target]);
 }
 for(const i of unused){const p=center(b[i]);pairs.push([b[i].map(()=>p),b[i]]);}
 return {from,to,pairs};
}
export function morphPaths(morph,progress){
 if(progress<=0)return morph.from;if(progress>=1)return morph.to;
 const t=progress*progress*(3-2*progress);return morph.pairs.map(([a,b])=>a.map((p,i)=>mix(p,b[i],t)));
}
export function morphSchedule(seconds,count,hold=1,duration=.4666666667){
 seconds=Math.max(0,seconds);
 const tick=Math.floor(seconds/(hold+duration)),phase=seconds-tick*(hold+duration);
 return {round:Math.floor(tick/count),active:tick%count,progress:Math.max(0,Math.min(1,(phase-hold)/duration))};
}// Keep the glyph upright while its origin follows a shallow arc between slots.
export function arcPosition(from,to,progress){
 const p=Math.max(0,Math.min(1,progress)),t=p*p*(3-2*p);
 return {x:from+(to-from)*t,y:-Math.min(110,Math.abs(to-from)*.38)*Math.sin(Math.PI*t)};
}
