const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
export function coast(velocity,seconds){
 const decay=Math.exp(-seconds/1.8);
 return {velocity:velocity*decay,distance:velocity*1.8*(1-decay)};
}
// First extend the front while the rear stays planted, then pull the rear in.
// The front finishes before catch-up starts. Each cycle restores the glyph.
export function walkingPoint(point,{lead=0,step,time}){
 const cycle=Math.floor(time),phase=time-cycle,position=Math.max(0,Math.min(1,lead));
 const front=smooth(phase/.36),rear=smooth((phase-.44)/.36);
 return {x:point.x+step*(cycle+position*front+(1-position)*rear),y:point.y};
}

// Curve extrema define the lead; all paths share one monotone x field.
export function leadingWeights(strokes,{originX}={}){
 const points=strokes.flatMap(stroke=>stroke.points),left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),apices=[];
 for(const stroke of strokes){
  const source=stroke.points,closed=Math.hypot(source[0].x-source.at(-1).x,source[0].y-source.at(-1).y)<1e-5,p=closed?source.slice(0,-1):source;
  for(let i=0;i<p.length;i++){
   if(!closed&&(i===0||i===p.length-1))continue;
   const previous=p[(i-1+p.length)%p.length],next=p[(i+1)%p.length],a=p[i].y-previous.y,b=next.y-p[i].y;
   const before=Math.atan2(a,p[i].x-previous.x),after=Math.atan2(b,next.x-p[i].x),turn=Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before)));
   // Exclude polygon corners and nearly flat sampling noise.
   if(a*b<0&&Math.min(Math.abs(a),Math.abs(b))>.01&&turn>.005&&turn<.8)apices.push(p[i].x);
  }
 }
 // Straight strokes follow the same field when a curved apex exists.
 const origins=Number.isFinite(originX)?[originX]:apices.length?apices:strokes.map(stroke=>Math.max(...stroke.points.map(p=>p.x)));
 const reach=Math.max(1,(right-left)*.16);
 return strokes.map(stroke=>stroke.points.map(p=>Math.max(0,...origins.map(x=>smooth((p.x-x+reach)/reach)))));
}
