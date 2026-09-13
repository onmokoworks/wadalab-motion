import {skeletonize,clamp,smooth} from './fold-core.js';
const angle=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const nearestAxis=(a,target)=>{const d=wrap(target-a);return Math.abs(d)>Math.PI/2?wrap(d+Math.PI):d;};
export const rules=[
 ['交点を基準','交点を支点に枝を畳み、軸は局所的にしなる。'],
 ['端点を基準','枝先を支点に、交点側を回す。'],
 ['末端の関節','枝の末端側にある曲がり角だけを畳む。'],
 ['交点間を主軸に','交点間の線を主軸として動かし、外の枝を倒す。'],
 ['最長の経路を主軸に','最長経路を幹として動かし、側枝を倒す。'],
 ['横線を軸に','横線を主軸として動かし、縦向きの枝を倒す。'],
 ['縦線を軸に','縦線を主軸として動かし、横向きの枝を倒す。'],
 ['閉路の接続を保つ','囲みの接続を保ってしならせ、外の枝を畳む。'],
 ['閉路を一部品に','囲まれた部分を変形せず、接続点から回す。'],
 ['曲がり角を関節に','枝の曲がり角を関節とし、連鎖させて畳む。']
];

export function analyze(alpha,w,h){
 const sk=skeletonize(alpha,w,h),pix=[];
 const neighbors=i=>{const x=i%w,y=Math.floor(i/w),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if((!dx&&!dy)||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;if(dx&&dy&&(sk[i+dx]||sk[i+dy*w]))continue;const j=i+dx+dy*w;if(sk[j])out.push(j);}return out;};
 const xy=i=>({x:i%w,y:Math.floor(i/w)}),critical=new Set();
 for(let i=0;i<sk.length;i++)if(sk[i]){pix.push(i);if(neighbors(i).length!==2)critical.add(i);}
 const owners=new Map(),nodes=[],edges=[],used=new Set(),key=(a,b)=>a<b?a+':'+b:b+':'+a;
 function node(cluster){const id=nodes.length,p={x:0,y:0};for(const i of cluster){owners.set(i,id);p.x+=i%w;p.y+=Math.floor(i/w);}nodes.push({id,x:p.x/cluster.length,y:p.y/cluster.length,pixels:cluster,edges:[]});return id;}
 for(const i of critical){if(owners.has(i))continue;const c=[i],seen=new Set(c);for(let k=0;k<c.length;k++)for(const j of neighbors(c[k]))if(critical.has(j)&&!seen.has(j)){seen.add(j);c.push(j);}node(c);}
 // A ring without a junction still needs one graph node.
 const visited=new Set();for(const i of pix){if(visited.has(i))continue;const c=[i];visited.add(i);for(let k=0;k<c.length;k++)for(const j of neighbors(c[k]))if(!visited.has(j)){visited.add(j);c.push(j);}if(!c.some(j=>owners.has(j)))node([c[0]]);}
 for(const n of nodes)for(const start of n.pixels)for(const next of neighbors(start)){
  if(owners.get(next)===n.id||used.has(key(start,next)))continue;
  let previous=start,current=next;const path=[{x:n.x,y:n.y}];used.add(key(previous,current));
  while(!owners.has(current)){path.push(xy(current));const options=neighbors(current).filter(j=>j!==previous);if(!options.length)break;const j=options[0];used.add(key(current,j));previous=current;current=j;}
  const to=owners.get(current);if(to===undefined)continue;path.push({x:nodes[to].x,y:nodes[to].y});
  const clean=simplify(path,1.1);if(clean.length<2)continue;const id=edges.length,length=path.slice(1).reduce((s,p,i)=>s+distance(p,path[i]),0);
  edges.push({id,a:n.id,b:to,path:clean,length,cycle:false});n.edges.push(id);nodes[to].edges.push(id);
 }
 // An edge belongs to a closed path exactly when it is not a bridge.
 const tin=Array(nodes.length).fill(-1),low=Array(nodes.length).fill(0);let tick=0;
 function visit(v,parentEdge=-1){tin[v]=low[v]=tick++;for(const id of nodes[v].edges){if(id===parentEdge)continue;const e=edges[id],to=e.a===v?e.b:e.a;if(tin[to]<0){visit(to,id);low[v]=Math.min(low[v],low[to]);e.cycle=low[to]<=tin[v];}else{low[v]=Math.min(low[v],tin[to]);if(tin[to]<=tin[v])e.cycle=true;}}}
 for(const n of nodes)if(tin[n.id]<0)visit(n.id);
 const components=[],assigned=new Set();for(const n of nodes){if(assigned.has(n.id))continue;const c=[n.id];assigned.add(n.id);for(let k=0;k<c.length;k++)for(const id of nodes[c[k]].edges){const e=edges[id],to=e.a===c[k]?e.b:e.a;if(!assigned.has(to)){assigned.add(to);c.push(to);}}components.push(c);}
 return {nodes,edges,components,width:w,height:h};
}
function simplify(p,tolerance){
 if(p.length<3)return p;
 const a=p[0],b=p.at(-1),dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;let max=0,index=0;
 for(let i=1;i<p.length-1;i++){const t=clamp(((p[i].x-a.x)*dx+(p[i].y-a.y)*dy)/(den||1)),d=Math.hypot(p[i].x-a.x-dx*t,p[i].y-a.y-dy*t);if(d>max){max=d;index=i;}}
 if(max<=tolerance)return [a,b];return [...simplify(p.slice(0,index+1),tolerance).slice(0,-1),...simplify(p.slice(index),tolerance)];
}

export function plan(graph,rule){
 if(rule>=10){
  const base=plan(graph,5);base.rule=rule;
  if(rule===10)return base;
  base.parts=base.parts.map(p=>({...p,mode:p.fixed||graph.edges[p.edge].cycle?p.mode:'horizontalCorners',sequential:rule===12}));
  base.anchors=base.parts.filter(p=>!p.fixed).flatMap(p=>[p.pivot,...p.path.slice(1,-1).filter((v,i)=>Math.abs(wrap(angle(v,p.path[i+2])-angle(p.path[i],v)))>.30).map((v,i)=>({...v,id:`${p.edge}:corner:${i}`}))]);
  base.notice='';return base;
 }

 const {nodes,edges}=graph,degree=n=>nodes[n].edges.length,hasJunction=nodes.some(n=>degree(n.id)>=3),hasLoop=edges.some(e=>e.cycle);
 const junctionLinks=new Set(edges.filter(e=>degree(e.a)>=3&&degree(e.b)>=3).map(e=>e.id));
 const longest=new Set();
 function far(start,allowed){const d=new Map(allowed.map(i=>[i,Infinity])),prev=new Map(),open=new Set(allowed);d.set(start,0);while(open.size){let v=-1,best=Infinity;for(const i of open)if(d.get(i)<best){best=d.get(i);v=i;}if(v<0)break;open.delete(v);for(const id of nodes[v].edges){const e=edges[id],to=e.a===v?e.b:e.a,value=best+e.length;if(value<d.get(to)){d.set(to,value);prev.set(to,{v,id});}}}let end=start;for(const [i,v]of d)if(Number.isFinite(v)&&v>d.get(end))end=i;return {end,prev};}
 for(const component of graph.components){const a=far(component[0],component).end,b=far(a,component);let v=b.end;while(b.prev.has(v)){const p=b.prev.get(v);longest.add(p.id);v=p.v;}}
 const axis=(node,exclude,preferred=null)=>{const list=nodes[node].edges.filter(id=>id!==exclude&&(!preferred||preferred.has(id))).map(id=>edges[id]).sort((a,b)=>b.length-a.length);if(!list.length)return 0;const e=list[0],path=e.a===node?e.path:[...e.path].reverse();return angle(path[0],path[Math.min(2,path.length-1)]);};
 const cycleGroups=new Map(),seen=new Set();for(const e of edges){if(!e.cycle||seen.has(e.id))continue;const list=[e.id];seen.add(e.id);for(let k=0;k<list.length;k++){const edge=edges[list[k]];for(const v of [edge.a,edge.b])for(const id of nodes[v].edges)if(edges[id].cycle&&!seen.has(id)){seen.add(id);list.push(id);}}const ids=[...new Set(list.flatMap(id=>[edges[id].a,edges[id].b]))].sort((a,b)=>Number(degree(b)>=3)-Number(degree(a)>=3)||nodes[a].y-nodes[b].y||nodes[a].x-nodes[b].x);for(const id of list)cycleGroups.set(id,nodes[ids[0]]);}
 const parts=edges.map(e=>{
  let start=degree(e.a)>degree(e.b)?e.a:degree(e.b)>degree(e.a)?e.b:nodes[e.a].y<=nodes[e.b].y?e.a:e.b;
  if(rule===1)start=degree(e.a)<degree(e.b)?e.a:degree(e.b)<degree(e.a)?e.b:start;
  if(rule===3||rule===4||rule===7){const fixed=rule===3?junctionLinks:rule===4?longest:new Set(edges.filter(x=>x.cycle).map(x=>x.id));const score=v=>nodes[v].edges.filter(id=>fixed.has(id)).length;if(score(e.b)>score(e.a))start=e.b;else if(score(e.a)>score(e.b))start=e.a;}
  const path=e.a===start?e.path:[...e.path].reverse(),pivot=nodes[start],base=angle(path[0],path[Math.min(2,path.length-1)]);
  let target=axis(start,e.id),fixed=false,mode='rotate';
  if(rule===0){const longest=nodes[start].edges.map(id=>edges[id]).sort((a,b)=>b.length-a.length)[0];fixed=degree(e.a)>=3&&degree(e.b)>=3||degree(start)>=3&&longest?.id===e.id;}
  if(rule===1){target=axis(start===e.a?e.b:e.a,e.id);fixed=e.cycle;}
  if(rule===2){fixed=e.cycle;mode='tip';}
  if(rule===3){fixed=junctionLinks.has(e.id);target=axis(start,e.id,junctionLinks);}
  if(rule===4){fixed=longest.has(e.id);target=axis(start,e.id,longest);}
  const dx=path.at(-1).x-path[0].x,dy=path.at(-1).y-path[0].y;
  if(rule===5){fixed=Math.abs(dx)>=Math.abs(dy);target=0;}
  if(rule===6){fixed=Math.abs(dy)>Math.abs(dx);target=Math.PI/2;}
  if(rule===7){fixed=!hasLoop||e.cycle;target=axis(start,e.id,new Set(edges.filter(x=>x.cycle).map(x=>x.id)));}
  if(rule===8){fixed=!e.cycle;if(e.cycle)return {edge:e.id,path,pivot:cycleGroups.get(e.id),theta:Math.PI*.48,mode:'rotate',fixed:false};}
  if(rule===9){fixed=e.cycle;mode='corners';}
  let theta=nearestAxis(base,target);
  return {edge:e.id,path,pivot,theta,mode,fixed};
 });
 const anchors=[];
 for(const part of parts.filter(p=>!p.fixed)){
  if(part.mode==='rotate'){if(Math.abs(part.theta)>.001)anchors.push(part.pivot);continue;}
  const corners=part.path.slice(1,-1).filter((p,i)=>Math.abs(wrap(angle(p,part.path[i+2])-angle(part.path[i],p)))>.30);
  for(const p of part.mode==='tip'?corners.slice(-1):corners)anchors.push({...p,id:`${part.edge}:${p.x}:${p.y}`});
 }
 const notice=rule===7||rule===8?!hasLoop?'閉路なし：線ごとにしなる':'':rule===2||rule===9?!anchors.length?'曲がり角なし：線ごとにしなる':'':rule===0||rule===3?!hasJunction?'交点なし：端点を基準に使用':'':'';
 return {rule,parts,graph,notice,anchors:[...new Map(anchors.map(p=>[p.id,p])).values()]};
}

// Local flex is used only when the selected structural rule would leave a
// whole path stationary. Both ends stay anchored; no component transform.
export function flexPath(path,amount){
 if(amount===0||path.length<2)return path;
 const cumulative=[0];for(let i=1;i<path.length;i++)cumulative.push(cumulative.at(-1)+distance(path[i-1],path[i]));
 const length=cumulative.at(-1);if(length<.01)return path;
 const closed=distance(path[0],path.at(-1))<.01,out=[],amplitude=Math.min(10,length*.08)*smooth(amount);
 for(let i=0;i<path.length-1;i++){
  const a=path[i],b=path[i+1],len=distance(a,b),steps=Math.max(2,Math.ceil(len/3)),nx=-(b.y-a.y)/(len||1),ny=(b.x-a.x)/(len||1);
  for(let j=0;j<steps;j++){const f=j/steps,u=(cumulative[i]+len*f)/length,offset=Math.sin(Math.PI*u*(closed?2:1))*amplitude;out.push({x:a.x+(b.x-a.x)*f+nx*offset,y:a.y+(b.y-a.y)*f+ny*offset});}
 }out.push(path.at(-1));return out;
}
export function posedDots(graph,amount){return graph.nodes.filter(n=>!n.edges.length).map(n=>({...n,y:n.y+10*smooth(amount)}));}

export function posedPaths(strategy,amount){
 const t=smooth(amount);
 const local=strategy.parts.map(part=>{
  if(part.fixed||amount===0)return part.path;
  if(part.mode==='rotate'){const a=part.theta*t,c=Math.cos(a),s=Math.sin(a),o=part.pivot;return part.path.map(p=>({x:o.x+c*(p.x-o.x)-s*(p.y-o.y),y:o.y+s*(p.x-o.x)+c*(p.y-o.y)}));}
  const path=part.path,angles=path.slice(1).map((p,i)=>angle(path[i],p)),lengths=path.slice(1).map((p,i)=>distance(path[i],p)),out=[path[0]];
  const corners=angles.map((a,i)=>i&&Math.abs(wrap(a-angles[i-1]))>.30?i:-1).filter(i=>i>=0);
  let accumulated=part.mode==='horizontalCorners'?part.theta*(part.sequential?smooth(clamp(1-(1-amount)/.45)):t):0;for(let i=0;i<lengths.length;i++){
   const turn=i?wrap(angles[i]-angles[i-1]):0;
   if(i&&Math.abs(turn)>.30&&(part.mode==='corners'||part.mode==='horizontalCorners'||i===corners.at(-1))){
    const rank=corners.indexOf(i),delay=part.sequential?.35+.35*rank/Math.max(1,corners.length-1):0;
    const fold=part.sequential?smooth(1-clamp(((1-amount)-delay)/(1-delay))):t;
    accumulated+=(Math.sign(turn||1)*Math.PI*.85-turn)*fold;
   }
   const a=angles[i]+accumulated,p=out.at(-1);out.push({x:p.x+Math.cos(a)*lengths[i],y:p.y+Math.sin(a)*lengths[i]});
  }return out;
 });
 return local.map((path,i)=>{
  const original=strategy.parts[i].path;
  const moved=path.some((p,j)=>Math.hypot(p.x-original[j].x,p.y-original[j].y)>.0001);
  return moved||amount===0||strategy.rule>=11?path:flexPath(original,amount);
 });
}


// Arc-length trimming of the already articulated polyline. Renderer independent.
export function trimPath(path,progress){
 if(progress<=0||path.length<2)return [];
 if(progress>=1)return path;
 const lengths=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.y-path[i].y));
 let remaining=lengths.reduce((a,b)=>a+b,0)*progress;
 if(remaining<=0)return [];
 const out=[path[0]];
 for(let i=0;i<lengths.length;i++){
  if(lengths[i]<=remaining){out.push(path[i+1]);remaining-=lengths[i];}
  else{const t=remaining/lengths[i],a=path[i],b=path[i+1];out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});break;}
 }
 return out;
}

// Geometry-based handoff: the rightmost path releases the next glyph when
// its own opening reaches 60%. Left-side paths receive the opening first.
export function relayProfile(strategy){
 const paths=strategy.parts.map(p=>p.path),all=paths.flat();
 if(!all.length)return {delays:[],release:.6,outgoing:-1};
 const lo=Math.min(...all.map(p=>p.x)),hi=Math.max(...all.map(p=>p.x));
 const delays=paths.map(path=>.35*(path[0].x-lo)/Math.max(1,hi-lo));
 let outgoing=0;paths.forEach((p,i)=>{if(Math.max(...p.map(v=>v.x))>Math.max(...paths[outgoing].map(v=>v.x)))outgoing=i;});
 return {delays,outgoing,release:delays[outgoing]+.6*(1-delays[outgoing])};
}
export function relaySchedule(items,duration,stagger=.07){
 let previous=null;return items.map(item=>{
  if(!item.glyph){const born=previous?Math.max(item.born,previous.born+previous.release*duration):item.born;previous={born,release:stagger/duration};return born;}
  const born=previous?Math.max(item.born,previous.born+previous.release*duration):item.born;
  previous={born,release:relayProfile(item.glyph.strategy).release};return born;
 });
}
export function relayPaths(strategy,progress){
 const profile=relayProfile(strategy);
 return strategy.parts.map((part,i)=>posedPaths({...strategy,parts:[part]},1-clamp((progress-profile.delays[i])/(1-profile.delays[i])))[0]);
}
