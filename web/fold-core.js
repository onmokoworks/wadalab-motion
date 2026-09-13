// Pure numeric font articulation. Coordinates and lengths are in mask pixels.
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

export function entryTimes(previous,segments,now,stagger=.14){
 let prefix=0;while(prefix<previous.length&&prefix<segments.length&&previous[prefix].segment===segments[prefix])prefix++;
 let suffix=0;while(suffix<previous.length-prefix&&suffix<segments.length-prefix&&previous[previous.length-1-suffix].segment===segments[segments.length-1-suffix])suffix++;
 let next=Math.max(now,prefix?previous[prefix-1].born+stagger:now);
 return segments.map((segment,i)=>{let born;if(i<prefix)born=previous[i].born;else if(i>=segments.length-suffix)born=previous[previous.length-(segments.length-i)].born;else{born=next;next+=stagger;}return {segment,born};});
}

export function skeletonize(alpha,w,h){
 const a=Uint8Array.from(alpha,v=>v>=96?1:0),remove=[];
 let changed=true,iteration=0;
 while(changed&&iteration++<Math.max(w,h)){
  changed=false;
  for(let pass=0;pass<2;pass++){
   remove.length=0;
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x;if(!a[i])continue;
    const p=[a[i-w],a[i-w+1],a[i+1],a[i+w+1],a[i+w],a[i+w-1],a[i-1],a[i-w-1]],n=p.reduce((s,v)=>s+v,0);
    if(n<2||n>6)continue;
    let transitions=0;for(let k=0;k<8;k++)if(!p[k]&&p[(k+1)%8])transitions++;
    if(transitions!==1)continue;
    if(pass===0?(p[0]*p[2]*p[4]||p[2]*p[4]*p[6]):(p[0]*p[2]*p[6]||p[0]*p[4]*p[6]))continue;
    remove.push(i);
   }
   if(remove.length)changed=true;for(const i of remove)a[i]=0;
  }
 }
 return a;
}

// Arc-length trim coordinates, obtained from the actual glyph's centerlines.
// This is geometric path order, not linguistic stroke order.
export function buildTrimMap(alpha,w,h){
 const sk=skeletonize(alpha,w,h),order=new Float32Array(w*h).fill(-1),seen=new Uint8Array(w*h),points=[];
 const neighbors=i=>{const x=i%w,y=Math.floor(i/w),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if((!dx&&!dy)||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;const j=i+dx+dy*w;if(sk[j]&&!(dx&&dy&&(sk[i+dx]||sk[i+dy*w])))out.push(j);}return out;};
 for(let i=0;i<sk.length;i++)if(sk[i])points.push(i);
 const starts=[...points].sort((a,b)=>{const ae=neighbors(a).length<=1,be=neighbors(b).length<=1;return Number(be)-Number(ae)||a-b;});
 let length=0;
 for(const start of starts){if(seen[start])continue;const stack=[{i:start,previous:-1}];while(stack.length){const {i,previous}=stack.pop();if(seen[i])continue;seen[i]=1;if(previous>=0)length+=Math.hypot(i%w-previous%w,Math.floor(i/w)-Math.floor(previous/w));order[i]=length;const next=neighbors(i).filter(j=>!seen[j]);next.sort((a,b)=>b-a);for(const j of next)stack.push({i:j,previous:i});}length+=1;}
 // Propagate each path coordinate across the stroke width, preserving its alpha.
 const queue=new Int32Array(w*h);let head=0,tail=0;for(const i of points)queue[tail++]=i;
 while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if((!dx&&!dy)||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;const j=i+dx+dy*w;if(order[j]<0){order[j]=order[i];queue[tail++]=j;}}}
 for(let i=0;i<order.length;i++)if(alpha[i]&&order[i]<0){order[i]=length++;}
 const max=Math.max(1,length);for(let i=0;i<order.length;i++)order[i]=order[i]<0?0:Math.min(.999,order[i]/max);
 return order;
}

export function buildRig(alpha,w,h,{jointLength=14,grid=40}={}){
 const sk=skeletonize(alpha,w,h),pixels=[];for(let i=0;i<sk.length;i++)if(sk[i])pixels.push(i);
 if(!pixels.length)return {bones:[],vertices:[],indices:[],width:w,height:h};
 const xy=i=>[i%w,Math.floor(i/w)];
 const neighbors=i=>{
  const x=i%w,y=Math.floor(i/w),out=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if((!dx&&!dy)||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
   if(dx&&dy&&(sk[i+dx]||sk[i+dy*w]))continue;
   const j=i+dx+dy*w;if(sk[j])out.push(j);
  }return out;
 };
 const seen=new Set(),components=[];
 for(const start of pixels){if(seen.has(start))continue;const c=[start];seen.add(start);for(let k=0;k<c.length;k++)for(const j of neighbors(c[k]))if(!seen.has(j)){seen.add(j);c.push(j);}components.push(c);}
 components.sort((a,b)=>b.length-a.length);
 const nearest=(c,x,y)=>c.reduce((a,b)=>{const [ax,ay]=xy(a),[bx,by]=xy(b);return (ax-x)**2+(ay-y)**2<(bx-x)**2+(by-y)**2?a:b;});
 const mainRoot=nearest(components[0],w/2,h/2),[rx,ry]=xy(mainRoot);
 const bones=[{parent:-1,ax:rx,ay:ry,bx:rx,by:ry,length:0,restAngle:0,localAngle:0,foldAngle:0,skin:false}];
 const add=(parent,from,to,skin=true)=>{
  const [ax,ay]=xy(from),[bx,by]=xy(to),angle=Math.atan2(by-ay,bx-ax),id=bones.length;
  bones.push({parent,ax,ay,bx,by,length:Math.hypot(bx-ax,by-ay),restAngle:angle,localAngle:wrap(angle-bones[parent].restAngle),foldAngle:0,skin});return id;
 };
 for(let ci=0;ci<components.length;ci++){
  const comp=components[ci],root=ci?nearest(comp,rx,ry):mainRoot,parents=new Map([[root,-1]]),children=new Map(),queue=[root];
  for(let k=0;k<queue.length;k++){const i=queue[k];for(const j of neighbors(i))if(!parents.has(j)){parents.set(j,i);queue.push(j);if(!children.has(i))children.set(i,[]);children.get(i).push(j);}}
  const componentBone=ci?add(0,mainRoot,root,false):0;
  const pending=(children.get(root)??[]).map(i=>({pixel:i,from:root,parent:componentBone,distance:0}));
  if(!pending.length){bones[componentBone].skin=true;}
  while(pending.length){let {pixel,from,parent,distance}=pending.pop();let previous=parents.get(pixel);distance+=Math.hypot(pixel%w-previous%w,Math.floor(pixel/w)-Math.floor(previous/w));
   const next=children.get(pixel)??[];
   if(distance>=jointLength||next.length!==1){parent=add(parent,from,pixel);from=pixel;distance=0;}
   for(const child of next)pending.push({pixel:child,from,parent,distance});
  }
 }
 // Folded pose is a chain of fixed-length links directed back toward its root.
 // Alternating offsets keep bends visible without shrinking individual links.
 const final=[{x:rx,y:ry,angle:0}];
 for(let i=1;i<bones.length;i++){
  const b=bones[i],p=final[b.parent],angle=p.x>rx?Math.PI:0;
  b.foldAngle=wrap(angle-p.angle);
  final.push({x:p.x+Math.cos(angle)*b.length,y:p.y+Math.sin(angle)*b.length,angle});
 }
 const candidates=bones.map((b,i)=>b.skin?i:-1).filter(i=>i>=0),vertices=[],indices=[];
 const distance=(x,y,b)=>{const dx=b.bx-b.ax,dy=b.by-b.ay,t=clamp(((x-b.ax)*dx+(y-b.ay)*dy)/(dx*dx+dy*dy||1));return Math.hypot(x-b.ax-dx*t,y-b.ay-dy*t);};
 for(let y=0;y<=grid;y++)for(let x=0;x<=grid;x++){
  const px=x*w/grid,py=y*h/grid,best=[];
  for(const id of candidates){const d=distance(px,py,bones[id]);if(best.length<3||d<best.at(-1).d){best.push({id,d});best.sort((a,b)=>a.d-b.d);if(best.length>3)best.pop();}}
  if(!best.length)best.push({id:0,d:0});const weights=best.map(v=>1/(v.d+.7)**4),sum=weights.reduce((a,b)=>a+b,0);
  vertices.push({x:px,y:py,u:x/grid,v:y/grid,bones:best.map(v=>v.id),weights:weights.map(v=>v/sum)});
 }
 for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){const a=y*(grid+1)+x,b=a+1,c=a+grid+1,d=c+1;indices.push(a,c,b,b,c,d);}
 return {bones,vertices,indices,width:w,height:h};
}

export function pose(rig,amount,{bend=1}={}){
 const t=smooth(amount)*bend,bones=rig.bones;
 if(!bones.length)return [];
 const result=[{x:bones[0].bx,y:bones[0].by,angle:0,cos:1,sin:0,ax:bones[0].ax,ay:bones[0].ay}];
 for(let i=1;i<bones.length;i++){
  const b=bones[i],p=result[b.parent],angle=p.angle+b.localAngle+wrap(b.foldAngle-b.localAngle)*t,delta=angle-b.restAngle;
  result.push({x:p.x+Math.cos(angle)*b.length,y:p.y+Math.sin(angle)*b.length,angle,cos:Math.cos(delta),sin:Math.sin(delta),ax:p.x,ay:p.y});
 }return result;
}

export function deform(rig,transforms,out=new Float32Array(rig.vertices.length*2)){
 for(let i=0;i<rig.vertices.length;i++){
  const v=rig.vertices[i];let x=0,y=0;
  for(let k=0;k<v.bones.length;k++){const b=rig.bones[v.bones[k]],p=transforms[v.bones[k]],dx=v.x-b.ax,dy=v.y-b.ay,w=v.weights[k];x+=(p.ax+p.cos*dx-p.sin*dy)*w;y+=(p.ay+p.sin*dx+p.cos*dy)*w;}
  out[i*2]=x;out[i*2+1]=y;
 }return out;
}

export function foldAt(seconds,{hold=1.2,fold=2.3,closed=.65,unfold=1.7}={}){
 const cycle=hold+fold+closed+unfold,t=((seconds%cycle)+cycle)%cycle;
 if(t<hold)return 0;if(t<hold+fold)return (t-hold)/fold;if(t<hold+fold+closed)return 1;return 1-(t-hold-fold-closed)/unfold;
}

