const clamp=v=>Math.max(0,Math.min(1,v));
// Attach the source contour to the existing moving stroke, including its caps.
// Resting contours stay exact; only intermediate poses are transported.
function pathMeasure(path){
 const lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y));
 return {path,lengths,total:lengths.at(-1)};
}
export function bindContours(data){
 return data.glyph.restEntries.map(entry=>{
  const piece=data.rest.find(p=>p.stroke===entry.stroke),path=piece?.path;
  if(!path||path.length<2)return {d:entry.d,stroke:entry.stroke,bindings:null};
  const measured=pathMeasure(path),values=entry.d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number),bindings=[];
  for(let n=0;n<values.length;n+=2){
   const x=values[n],y=values[n+1];let best=null;
   for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-8)continue;
    const raw=((x-a.x)*dx+(y-a.y)*dy)/(len*len),t=clamp(raw),qx=a.x+t*dx,qy=a.y+t*dy,d=(x-qx)**2+(y-qy)**2;
    if(!best||d<best.d)best={d,segment:i,t,count:path.length,u:(measured.lengths[i-1]+t*len)/measured.total,along:(x-qx)*dx/len+(y-qy)*dy/len,normal:(-(x-qx)*dy+(y-qy)*dx)/len};
   }
   bindings.push(best);
  }
  return {d:entry.d,stroke:entry.stroke,bindings};
 });
}
export function warpContour(entry,moving){
 const piece=moving.find(p=>p.stroke===entry.stroke);if(!entry.bindings||!piece||piece.path.length<2)return entry.d;
 const m=pathMeasure(piece.path);let coordinate=0;
 const points=entry.bindings.map(b=>{
  if(!b)return {x:0,y:0};const distance=b.u*m.total;let i=1;
  while(i<m.path.length-1&&m.lengths[i]<distance-1e-9)i++;
  const sameTopology=m.path.length===b.count;if(sameTopology)i=b.segment;
  const a=m.path[i-1],z=m.path[i],len=m.lengths[i]-m.lengths[i-1],t=sameTopology?b.t:(len>1e-8?(distance-m.lengths[i-1])/len:0);
  const dx=len>1e-8?(z.x-a.x)/len:1,dy=len>1e-8?(z.y-a.y)/len:0;
  return {x:a.x+(z.x-a.x)*t+b.along*dx-b.normal*dy,y:a.y+(z.y-a.y)*t+b.along*dy+b.normal*dx};
 });
 return entry.d.replace(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi,()=>{const i=coordinate++;return String(points[Math.floor(i/2)][i%2?'y':'x']);});
}
