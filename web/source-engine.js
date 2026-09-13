import {SourceVM,fromAST,list,array,sym} from './source-vm.js';
import {installVectorMath} from './source-fast.js';
import {clamp,smooth} from './fold-core.js';
import {plan,posedPaths,relayPaths,relayProfile} from './structure.js';
export class SourceEngine{
 constructor(program,glyphs,ascii={glyphs:[]}){this.vm=new SourceVM();this.vm.load(program);installVectorMath(this.vm);this.glyphs=new Map(glyphs);this.ascii=new Map(ascii.glyphs.map(row=>[row[0],{paths:row[1],advance:row[2]}]));this.definitions=new Map(glyphs.map(row=>[row[0],row[2]??null]));this.cache=new Map();}
 resolve(text){if(this.ascii.has(text)||this.glyphs.has(text))return text;return null;}
 make(text,rule=10){const cacheKey=rule+':'+text;if(this.cache.has(cacheKey))return this.cache.get(cacheKey);const key=this.resolve(text);if(!key)throw Error(`原典に未収録：${text}`);if(this.ascii.has(key)){const {paths,advance}=this.ascii.get(key),restEntries=paths.map((commands,stroke)=>({stroke,d:commandsToD(commands)})),strokes=paths.map((commands,id)=>({id,type:'outline',ids:[],links:[],motionPath:commandPoints(commands)})),graph={nodes:[],edges:[],components:[],width:256,height:256},strategy={graph,parts:[],anchors:[],notice:null};const g={text,sourceCharacter:key,sourceDefinition:'TrueType outline',skeleton:null,points:[],strokes,strategy,outlineOnly:true,roundStrokes:new Set(),release:0,advance:advance/400,pixelFontSize:400,centerX:.5,centerY:-.4,pointBindings:[],restEntries,rest:restEntries.map(entry=>entry.d)};this.cache.set(cacheKey,g);return g;}const skeleton=fromAST(this.glyphs.get(key)),points=array(skeleton.a).map((p,id)=>({id,x:p.a,y:p.d.a,edges:[]}));
 const strokes=array(skeleton.d.a).map((s,id)=>{const ids=array(s.d.a),attrs=array(s.d.d),links=array(attrs.find(p=>p.a===sym('link'))?.d);for(const i of new Set([...ids,...links]))points[i].edges.push(id);return {id,type:s.a.s,ids,links};});
 // Adapt the source's point references to the same graph consumed by the
 // pre-port B/C motion functions. No bitmap analysis or replacement motion.
 this.addMotionPaths(skeleton,points,strokes);
 const graph=sourceGraph(points,strokes),strategy=plan(graph,rule);
 // On a branching source component, the longest connected route is the
 // load-bearing skeleton. Keeping it in place prevents a long vertical stroke
 // from sweeping sideways merely because its endpoints are vertically aligned;
 // the shorter branches articulate around it instead.
 if(rule>=10){const trunk=plan(graph,4),branching=new Set(graph.components.filter(ids=>ids.some(id=>graph.nodes[id].edges.length>=3)).flat());for(const part of strategy.parts){const edge=graph.edges[part.edge];if(branching.has(edge.a)&&branching.has(edge.b)&&trunk.parts[part.edge].fixed)part.fixed=true;}}
 const g={text,sourceCharacter:key,sourceDefinition:this.definitions.get(key),skeleton,points,strokes,strategy,outlineOnly:strokes.length>0&&strokes.every(stroke=>stroke.type==='outline'),roundStrokes:new Set(strokes.filter(isRoundStroke).map(s=>s.id)),release:relayProfile(strategy).release,advance:1,pixelFontSize:400,centerX:.5,centerY:-.4};
 g.pointBindings=points.map(point=>bindPoint(strategy,point));
 g.restEntries=this.outlineEntries(g,0);g.rest=g.restEntries.map(entry=>entry.d);this.cache.set(cacheKey,g);return g;
 }
 pose(g,amount,relay=false){
  if(amount===0)return g.points.map(p=>({...p}));
  const moved=relay?relayPaths(g.strategy,1-amount):posedPaths(g.strategy,amount);
  return g.points.map((point,i)=>{
   const bindings=g.pointBindings[i];if(!bindings.length)return {...point};let x=0,y=0;
   for(const binding of bindings){const q=mapBinding(g.strategy.parts[binding.part].path,moved[binding.part],binding);x+=q.x;y+=q.y;}
   return {...point,x:x/bindings.length/.64,y:y/bindings.length/.64};
  });
 }

 addMotionPaths(skeleton,points,strokes){
  const names=['gothicwidth','minchowidth','local_gothicwidth','local_minchowidth','hirawidth','*default-hirawidth*'],saved=names.map(n=>this.vm.global.values.get(n));
  const norm=this.vm.functions.get('normlen2'),curve2=this.vm.functions.get('curve2'),gothicCurve=this.vm.functions.get('gothiccurve');
  this.vm.functions.set('normlen2',(v,p)=>v===0?list(0,0):norm(v,p));
  this.vm.functions.set('curve2',(a,b,c,d,w0,w1,w2,w3,tail=list(null,null))=>{if(w0||w1||w2||w3)return curve2(a,b,c,d,w0,w1,w2,w3,tail);const path=()=>[list(sym('angle'),a.a,a.d.a),list(sym('bezier'),b.a,b.d.a),list(sym('bezier'),c.a,c.d.a),list(sym('angle'),d.a,d.d.a)];return list(list(...path(),...array(tail.a)),list(...path(),...array(tail.d.a)));});
  this.vm.functions.set('gothiccurve',(a,b,c,w,f=.6666666666)=>{if(w!==0)return gothicCurve(a,b,c,w,f);const mix=(p,q)=>list(p.a*(1-f)+q.a*f,p.d.a*(1-f)+q.d.a*f),path=list(list(sym('angle'),a.a,a.d.a),list(sym('bezier'),...array(mix(a,b))),list(sym('bezier'),...array(mix(c,b))),list(sym('angle'),c.a,c.d.a));return list(path,this.vm.call('copy-tree',[path]));});
  try{
   for(const n of names)this.vm.global.values.set(n,0);
   const sourceStrokes=array(skeleton.d.a);
   strokes.forEach((stroke,index)=>{
    const source=sourceStrokes[index],fn=this.vm.call('get-def',[source.a,sym('maru')])??this.vm.props.get(source.a)?.get(sym('mincho'));
    if(!fn||stroke.type==='outline'){stroke.motionPath=stroke.ids.map(id=>({x:points[id].x,y:points[id].y}));return;}
    const control=list(...stroke.ids.map(id=>list(points[id].x,points[id].y))),sides=this.vm.call(fn,[control,source.d.d]),tagged=array(sides.a);
    stroke.motionPath=flattenTagged(tagged);
    if(stroke.motionPath.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))stroke.motionPath=stroke.ids.map(id=>({x:points[id].x,y:points[id].y}));
   });
  }finally{names.forEach((n,i)=>this.vm.global.values.set(n,saved[i]));this.vm.functions.set('normlen2',norm);this.vm.functions.set('curve2',curve2);this.vm.functions.set('gothiccurve',gothicCurve);}
 }

 outlineEntries(g,amount,relay=false){
  const points=this.pose(g,amount,relay),originalPoints=array(g.skeleton.a),sourceStrokes=array(g.skeleton.d.a),out=[];
  for(const [index,source] of sourceStrokes.entries()){
   const posed=list(...points.map((p,i)=>list(p.x,p.y,...array(originalPoints[i].d.d))));
   const mini=list(posed,list(this.vm.call('copy-tree',[source])));
   this.vm.global.values.set('local_gothicwidth',8);this.vm.global.values.set('local_minchowidth',8);
   const raw=this.vm.call('skeleton2list',[mini,sym('maru')]);
   for(const contour of array(raw)){
    const path=array(contour);if(!path.length)continue;
    let d=`M${path[0].d.a} ${path[0].d.d.a}`;
    for(let i=1;i<path.length;){const p=path[i];if(p.a===sym('angle')){d+=`L${p.d.a} ${p.d.d.a}`;i++;}else{const b=path[i+1],end=path[i+2]??path[0];d+=`C${p.d.a} ${p.d.d.a} ${b.d.a} ${b.d.d.a} ${end.d.a} ${end.d.d.a}`;i+=3;}}
    if(/NaN|Infinity/.test(d))throw Error(`原典の画生成が不定：${g.text}/${g.strokes[index]?.type}`);out.push({d:d+'Z',stroke:index});
   }
  }
  return out;
 }

 outline(g,amount,relay=false){return this.outlineEntries(g,amount,relay).map(entry=>entry.d);}

 motionStrokePaths(g,amount,relay=false,strategy=g.strategy){
  const moved=relay?relayPaths(strategy,1-amount):posedPaths(strategy,amount);
  return strategy.parts.map((part,index)=>{const edge=strategy.graph.edges[part.edge],original=edge.path,path=moved[index];const forward=Math.hypot(part.path[0].x-original[0].x,part.path[0].y-original[0].y)<=Math.hypot(part.path[0].x-original.at(-1).x,part.path[0].y-original.at(-1).y);return {stroke:edge.sourceStroke,order:edge.sourceOrder,pivot:{x:part.pivot.x/.64,y:part.pivot.y/.64},fixed:part.fixed,path:(forward?path:[...path].reverse()).map(p=>({x:p.x/.64,y:p.y/.64}))};});
 }

 cPlusStrokePaths(g,amount){
  const straight=g.strokes.filter(stroke=>!g.roundStrokes.has(stroke.id)).map(stroke=>{const path=stroke.motionPath,length=path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.y-path[i].y),0),chord=Math.hypot(path.at(-1).x-path[0].x,path.at(-1).y-path[0].y);return {id:stroke.id,length,straightness:chord/(length||1)};}).filter(row=>row.straightness>.95).sort((a,b)=>b.length-a.length),mainAxis=straight[0]?.id;
  const moving=this.motionStrokePaths(g,amount),rest=this.motionStrokePaths(g,0),growth=smooth(clamp((1-amount)/.28)),emittedRounds=new Set(),result=[];
  for(const [index,piece] of moving.entries()){
   if(g.roundStrokes.has(piece.stroke)){if(emittedRounds.has(piece.stroke))continue;emittedRounds.add(piece.stroke);const source=g.strokes[piece.stroke];result.push({...piece,order:0,path:source.motionPath.map(point=>({x:point.x,y:point.y}))});continue;}
   const base=piece.stroke===mainAxis?rest[index]:piece;result.push({...piece,path:base.path.map(point=>({...point}))});
  }
  return mergeStrokePieces(result).map(piece=>{if(g.roundStrokes.has(piece.stroke))return piece;const pivot=piece.pivot;return {...piece,path:piece.path.map(point=>({x:pivot.x+(point.x-pivot.x)*growth,y:pivot.y+(point.y-pivot.y)*growth}))};});
 }

}

function pointOf(p){return {x:p.d.a,y:p.d.d.a};}
function commandsToD(commands){return commands.map(command=>command[0]==='Z'?'Z':command[0]+command.slice(1).join(' ')).join(' ');}
function commandPoints(commands){const points=[];for(const command of commands){if(command[0]==='M'||command[0]==='L')points.push({x:command[1],y:command[2]});else if(command[0]==='Q')points.push({x:command[3],y:command[4]});}return points;}
function flattenTagged(tagged){
 if(!tagged.length)return [];
 const out=[pointOf(tagged[0])];let previous=out[0];
 for(let i=1;i<tagged.length;){
  if(tagged[i].a===sym('angle')){const p=pointOf(tagged[i++]);if(Math.hypot(p.x-previous.x,p.y-previous.y)>.001)out.push(p);previous=p;continue;}
  const c1=pointOf(tagged[i]),c2=pointOf(tagged[i+1]),end=pointOf(tagged[i+2]??tagged[0]),steps=8;
  for(let step=1;step<=steps;step++){const t=step/steps,u=1-t;out.push({x:u*u*u*previous.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x,y:u*u*u*previous.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*end.y});}
  previous=end;i+=3;
 }
 return out;
}

function isRoundStroke(stroke){
 const path=stroke.motionPath;if(path.length<4)return false;const angles=path.slice(1).map((p,i)=>Math.atan2(p.y-path[i].y,p.x-path[i].x));let signed=0,absolute=0;for(let i=1;i<angles.length;i++){const turn=Math.atan2(Math.sin(angles[i]-angles[i-1]),Math.cos(angles[i]-angles[i-1]));signed+=turn;absolute+=Math.abs(turn);}const length=path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.y-path[i].y),0),chord=Math.hypot(path.at(-1).x-path[0].x,path.at(-1).y-path[0].y);return absolute>Math.PI*1.45&&Math.abs(signed)/(absolute||1)>.72&&chord/(length||1)<.62;
}

function mergeStrokePieces(pieces){
 const groups=new Map();for(const piece of [...pieces].sort((a,b)=>a.stroke-b.stroke||a.order-b.order)){let merged=groups.get(piece.stroke);if(!merged){merged={...piece,path:piece.path.map(point=>({...point}))};groups.set(piece.stroke,merged);continue;}const last=merged.path.at(-1),first=piece.path[0],start=Math.hypot(last.x-first.x,last.y-first.y)<1e-7?1:0;for(let i=start;i<piece.path.length;i++)merged.path.push({...piece.path[i]});
 }
 return [...groups.values()];
}

function bindPoint(strategy,point){
 const wanted=new Set(point.edges),byStroke=new Map(),x=point.x*.64,y=point.y*.64;
 strategy.parts.forEach((part,index)=>{
  const stroke=strategy.graph.edges[part.edge].sourceStroke;if(wanted.size&&!wanted.has(stroke))return;
  for(let k=0;k<part.path.length-1;k++){const a=part.path[k],b=part.path[k+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-8)continue;const u=clamp(((x-a.x)*dx+(y-a.y)*dy)/(len*len)),distance=(x-a.x-u*dx)**2+(y-a.y-u*dy)**2,normal=((y-a.y)*dx-(x-a.x)*dy)/len,binding={part:index,segment:k,u,normal,distance};if(!byStroke.has(stroke)||distance<byStroke.get(stroke).distance)byStroke.set(stroke,binding);}
 });
 return [...byStroke.values()];
}

function mapBinding(original,moved,binding){
 let a,b,u=binding.u;
 if(original.length===moved.length){a=moved[binding.segment];b=moved[binding.segment+1];}
 else{let offset=0;for(let k=0;k<binding.segment;k++)offset+=Math.max(2,Math.ceil(Math.hypot(original[k+1].x-original[k].x,original[k+1].y-original[k].y)/3));const steps=Math.max(2,Math.ceil(Math.hypot(original[binding.segment+1].x-original[binding.segment].x,original[binding.segment+1].y-original[binding.segment].y)/3)),v=u*steps,sub=Math.min(steps-1,Math.floor(v));a=moved[offset+sub];b=moved[offset+sub+1];u=v-sub;}
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;return {x:a.x+u*dx-binding.normal*dy/len,y:a.y+u*dy+binding.normal*dx/len};
}

export function sourceGraph(points,strokes){
 const nodes=[],edges=[],segments=[];
 const nodeAt=(x,y)=>{let n=nodes.find(p=>Math.hypot(p.x-x,p.y-y)<.25);if(!n){n={id:nodes.length,x,y,edges:[]};nodes.push(n);}return n.id;};
 for(const stroke of strokes){const path=stroke.motionPath.map(p=>({x:p.x*.64,y:p.y*.64}));for(let k=0;k<path.length-1;k++)segments.push({stroke:stroke.id,k,a:path[k],b:path[k+1],cuts:[]});}
 // LINK is the source format's explicit statement that several strokes meet at
 // this design point. Use it as a shared joint even when the generated centre
 // curves do not cross at exactly the same coordinate.
 for(const point of points){
  const joined=[...new Set(point.edges)];if(joined.length<2)continue;
  const x=point.x*.64,y=point.y*.64,id=nodeAt(x,y);
  for(const strokeId of joined){
   let best=null;
   for(const seg of segments){if(seg.stroke!==strokeId)continue;const dx=seg.b.x-seg.a.x,dy=seg.b.y-seg.a.y,len2=dx*dx+dy*dy;if(len2<1e-12)continue;const t=clamp(((x-seg.a.x)*dx+(y-seg.a.y)*dy)/len2),distance=(x-seg.a.x-t*dx)**2+(y-seg.a.y-t*dy)**2;if(!best||distance<best.distance)best={seg,t,distance};}
   if(best&&!best.seg.cuts.some(c=>c.id===id))best.seg.cuts.push({t:best.t,x,y,id,sourceLink:true});
  }
 }
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const a=segments[i],b=segments[j];if(a.stroke===b.stroke&&Math.abs(a.k-b.k)<=1)continue;const dx=a.b.x-a.a.x,dy=a.b.y-a.a.y,ex=b.b.x-b.a.x,ey=b.b.y-b.a.y,det=dx*ey-dy*ex;if(Math.abs(det)<1e-8)continue;const rx=b.a.x-a.a.x,ry=b.a.y-a.a.y,t=(rx*ey-ry*ex)/det,u=(rx*dy-ry*dx)/det;if(t<=.001||t>=.999||u<=.001||u>=.999)continue;const x=a.a.x+t*dx,y=a.a.y+t*dy,id=nodeAt(x,y);a.cuts.push({t,x,y,id});b.cuts.push({t:u,x,y,id});
 }
 for(const stroke of strokes){const own=segments.filter(s=>s.stroke===stroke.id),expanded=[];
  own.forEach((seg,k)=>{if(k===0)expanded.push({...seg.a,id:null});for(const cut of seg.cuts.sort((a,b)=>a.t-b.t)){const last=expanded[expanded.length-1];if(cut.t<.001&&last){last.x=cut.x;last.y=cut.y;last.id=cut.id;}else expanded.push(cut);}expanded.push({...seg.b,id:null});});
  // A cut on the end of one sampled segment belongs to the next segment's
  // starting sample. Collapse those duplicates before making graph edges.
  for(let j=1;j<expanded.length;j++){const a=expanded[j-1],b=expanded[j];if(Math.hypot(a.x-b.x,a.y-b.y)<.001){if(a.id===null)a.id=b.id;expanded.splice(j,1);j--;}}
  if(expanded[0].id===null)expanded[0].id=nodeAt(expanded[0].x,expanded[0].y);const last=expanded[expanded.length-1];if(last.id===null)last.id=nodeAt(last.x,last.y);
  let start=0;for(let j=1;j<expanded.length;j++){if(expanded[j].id===null)continue;const path=expanded.slice(start,j+1).map(p=>({x:p.x,y:p.y})),a=expanded[start].id,b=expanded[j].id,length=path.slice(1).reduce((n,p,k)=>n+Math.hypot(p.x-path[k].x,p.y-path[k].y),0);if(length>.001){const id=edges.length;edges.push({id,a,b,path,sourceStroke:stroke.id,sourceOrder:start,length,cycle:false});nodes[a].edges.push(id);nodes[b].edges.push(id);}start=j;}
 }
 // Mark cycles from source connectivity (parallel edges included).
 const tin=nodes.map(()=>-1),low=nodes.map(()=>0);let tick=0;
 function visit(v,parent=-1){tin[v]=low[v]=tick++;for(const id of nodes[v].edges){if(id===parent)continue;const e=edges[id],to=e.a===v?e.b:e.a;if(tin[to]<0){visit(to,id);low[v]=Math.min(low[v],low[to]);e.cycle=low[to]<=tin[v];}else{low[v]=Math.min(low[v],tin[to]);if(tin[to]<=tin[v])e.cycle=true;}}}
 for(const n of nodes)if(tin[n.id]<0)visit(n.id);
 const components=[],seen=new Set();for(const n of nodes){if(seen.has(n.id))continue;const ids=[n.id];seen.add(n.id);for(let i=0;i<ids.length;i++)for(const id of nodes[ids[i]].edges){const e=edges[id],to=e.a===ids[i]?e.b:e.a;if(!seen.has(to)){seen.add(to);ids.push(to);}}components.push(ids);}
 return {nodes,edges,components,width:256,height:256};
}

let engine;
export async function loadSourceEngine(){if(engine)return engine;const [program,glyphs,ascii]=await Promise.all(['/source-program.json','/source-glyphs.json','/font/ascii-outlines.json'].map(url=>fetch(url).then(r=>{if(!r.ok)throw Error('原典データを読み込めません');return r.json();})));return engine=new SourceEngine(program,glyphs,ascii);}
export const getSourceEngine=()=>engine;
