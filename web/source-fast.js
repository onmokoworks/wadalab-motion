// Direct translations of CLWFK lib.l vector arithmetic; same equations.
// Copyright Wada Laboratory 1990-2003, /efont/ 2003-2006; see /SOURCE-LICENSE.txt.
import {list,array,Pair,sym} from './source-vm.js';
export function installVectorMath(vm){
 installGeometryMath(vm);
 const x=p=>p.a,y=p=>p.d.a,add=(n,f)=>vm.functions.set(n,f);
 add('length2',p=>Math.hypot(x(p),y(p)));add('times2',(v,p)=>list(v*x(p),v*y(p)));
 add('plus2',(...p)=>list(p.reduce((s,p)=>s+x(p),0),p.reduce((s,p)=>s+y(p),0)));
 add('_plus2',(a,b)=>list(x(a)+x(b),y(a)+y(b)));add('diff2',(a,b)=>list(x(a)-x(b),y(a)-y(b)));
 add('mul2',(a,b)=>x(a)*x(b)+y(a)*y(b));add('metric2',(a,b)=>Math.hypot(x(a)-x(b),y(a)-y(b)));
 add('normlen2',(v,p)=>{const r=v/Math.hypot(x(p),y(p));return list(r*x(p),r*y(p));});
 add('norm2',p=>{const r=1/Math.hypot(x(p),y(p));return list(r*x(p),r*y(p));});
 add('rot90',p=>list(y(p),-x(p)));add('rot270',p=>list(-y(p),x(p)));
 add('inter2',(a,b,t)=>list(x(a)*(1-t)+x(b)*t,y(a)*(1-t)+y(b)*t));
}
// Hot helpers translated directly from lib.l, limit.l, skel2list.l, unit.l,
// yokosort.l and compat.l. Keep source branch order and floating-point equations.
export function installGeometryMath(vm){
 const add=(n,f)=>vm.functions.set(n,f),T=sym('t'),star=sym('*'),link=sym('link');
 const member=(v,p)=>{for(;p instanceof Pair;p=p.d)if(p.a===v)return p;return null;};
 const nth=(n,p)=>{while(n-->0)p=p?.d;return p?.a??null;};
 const links=e=>{for(let p=e.d.d;p instanceof Pair;p=p.d)if(p.a?.a===link)return p.a.d;return null;};
 const rmat=m=>{const e=1/(m[0]*m[3]-m[1]*m[2]);return [e*m[3],e*-1*m[1],e*-1*m[2],e*m[0]];};
 const affine=(p,m)=>list(m[4]+p.a*m[0]+p.d.a*m[2],m[5]+p.a*m[1]+p.d.a*m[3]);
 add('rmat',rmat);add('affine',affine);add('memeq',member);
 add('eq_member',(a,p)=>p===star?T:p instanceof Pair?member(a,p):a===p?T:null);
 add('vset',(v,i,x)=>(v[i]=x));
 add('inlink',(a,b)=>{const ls=links(b);for(let p=a.d.a;p instanceof Pair;p=p.d)if(member(p.a,ls))return T;return null;});
 add('line-cross',(a0,a1,b0,b1)=>{const m=[b0.a-b1.a,b0.d.a-b1.d.a,a1.a-a0.a,a1.d.a-a0.d.a],det=m[0]*m[3]-m[1]*m[2];if(Math.abs(det)<1e-7)return null;const r=rmat(m),dx=a1.a-b1.a,dy=a1.d.a-b1.d.a,t=dx*r[0]+dy*r[2],s=dx*r[1]+dy*r[3],delta=vm.value('delta',vm.global);return -delta<=t&&t<=1+delta&&-delta<=s&&s<=1+delta?T:null;});
 add('linecross',(a,b)=>{const two=a?.d instanceof Pair&&!(a.d.d instanceof Pair),l0=two?a:b;let l1=two?b:a;const ax=l0.a.d.a,ay=l0.a.d.d.a,bx=l0.d.a.d.a-ax,by=l0.d.a.d.d.a-ay;
  for(;l1?.d instanceof Pair;l1=l1.d){const cx=l1.a.d.a,cy=l1.a.d.d.a,dx=l1.d.a.d.a-cx,dy=l1.d.a.d.d.a-cy;
   if(bx*dy-by*dx===0){if((cx-ax)*by-(cy-ay)*bx===0)return list(ax,ay);}
   else{const m=rmat([bx,by,-dx,-dy]),s=m[1]*(cx-ax)+m[3]*(cy-ay);if(!(l1.d.d instanceof Pair)||(s>0&&s<1))return list(cx+s*dx,cy+s*dy);}
  }return null;
 });
 add('ely2x',(e,points,y)=>{let ids=e.d.a,p0=nth(ids.a,points);for(;ids.d instanceof Pair;ids=ids.d){const p1=nth(ids.d.a,points),x0=p0.a,y0=p0.d.a,x1=p1.a,y1=p1.d.a;if(y0===y&&y===y1)return .5*(x0+x1);if(y0<=y&&y<=y1){const s=(y-y0)/(y1-y0);return (1-s)*x0+s*x1;}if(y1<=y&&y<=y0){const s=(y-y1)/(y0-y1);return (1-s)*x1+s*x0;}p0=p1;}throw Error('Fatal error in ely2x');});
 add('yoko-other',(a,b,points)=>{const ai=a.d.a,bi=b.d.a,as=ai.a,ae=ai.d.a,bs=bi.a;let tail=bi;while(tail.d instanceof Pair)tail=tail.d;const be=tail.a,al=links(a),bl=links(b);
  if(as===bs)return sym('leftupper');if(as===be)return sym('leftdown');if(ae===bs)return sym('rightupper');if(ae===be)return sym('rightdown');
  if(member(as,bl))return sym('yokostart');if(member(ae,bl))return sym('yokoend');if(member(bs,al))return sym('otherstart');if(member(be,al))return sym('otherend');
  const p0=nth(as,points),p1=nth(ae,points),x0=p0.a,y=p0.d.a,x1=p1.a;let state=null;
  for(let l=bi;l.d instanceof Pair;l=l.d){const p2=nth(l.a,points),p3=nth(l.d.a,points),x2=p2.a,y2=p2.d.a,x3=p3.a,y3=p3.d.a,in2=x0<x2&&x2<x1,in3=x0<x3&&x3<x1;
   if(in2&&in3&&((y2<y&&y<y3)||(y3<y&&y<y2)))return sym('cross');if((in3||in2)&&y3<y)state=sym('up');else if((in3||in2)&&y<y2)state=sym('down');
  }return state;
 });
}
