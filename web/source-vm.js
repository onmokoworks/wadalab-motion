export class Pair{constructor(a,d=null){this.a=a;this.d=d;}}
const symbols=new Map();export const sym=n=>{n=n.toLowerCase();if(n==='nil')return null;if(!symbols.has(n))symbols.set(n,{s:n});return symbols.get(n);};
const car=x=>x?.a??null,cdr=x=>x?.d??null;
export const list=(...a)=>a.reduceRight((d,x)=>new Pair(x,d),null);
export const array=x=>{const a=[];while(x instanceof Pair){a.push(x.a);x=x.d;}return a;};
export function fromAST(x){if(x==null)return null;if(Array.isArray(x))return list(...x.map(fromAST));if(x.s)return sym(x.s);if(x.head)return x.head.map(fromAST).reduceRight((d,a)=>new Pair(a,d),fromAST(x.tail));if(x.vector)return (x.vector??[]).map(fromAST);return x;}
const name=x=>x?.s,truth=x=>x!==null&&x!==false;
const equal=(a,b)=>a===b||(a instanceof Pair&&b instanceof Pair&&equal(a.a,b.a)&&equal(a.d,b.d));
class Env{constructor(parent=null){this.parent=parent;this.values=new Map();}find(n){return this.values.has(n)?this:this.parent?.find(n);}get(n){const e=this.find(n);if(!e)throw Error('Unbound '+n);return e.values.get(n);}set(n,v){(this.find(n)??this).values.set(n,v);return v;}}
export class SourceVM{
 constructor(){this.global=new Env();this.dynamic=new Env();this.special=new Set();this.functions=new Map();this.props=new Map();this.steps=0;this.compiled=new WeakMap();this.install();}
 value(n,e){if(n==='t'||n.startsWith(':'))return sym(n);return this.special.has(n)?(this.dynamic.find(n)??this.global).values.get(n):e.get(n);}
 set(n,v,e){return this.special.has(n)?(this.dynamic.find(n)?this.dynamic.set(n,v):this.global.set(n,v)):e.set(n,v);}
 bind(n,v,e){e.values.set(n,v);if(this.special.has(n))this.dynamic.values.set(n,v);}
 block(forms,e){let v=null;for(const f of forms){if(typeof f==='string')continue;v=this.eval(f,e);}return v;}
 fn(params,body,closure,blockName=null){
  const bindings=[];let mode='required';for(const p of params){if(name(p)?.startsWith('&')){mode=name(p);continue;}const pa=Array.isArray(p)?p:[p];bindings.push({n:name(pa[0]),mode,init:this.compile(pa[1]??null)});}
  const forms=body.filter(f=>typeof f!=='string').map(f=>this.compile(f));
  return (...args)=>{const env=new Env(closure),old=this.dynamic;this.dynamic=bindings.some(p=>this.special.has(p.n))?new Env(old):old;try{let i=0;for(const p of bindings){let v;if(p.mode==='&rest'||p.mode==='&body'){v=list(...args.slice(i));i=args.length;}else if(p.mode==='&aux')v=p.init(env);else v=i<args.length?args[i++]:p.init(env);this.bind(p.n,v,env);}try{let v=null;for(const f of forms)v=f(env);return v;}catch(ex){if(ex?.returnBlock===blockName)return ex.value;throw ex;}}finally{this.dynamic=old;}};
 }
 call(f,args){const fn=typeof f==='function'?f:this.functions.get(typeof f==='string'?f:name(f));if(!fn)throw Error('Missing function '+(name(f)??f));try{return fn(...args);}catch(e){if(e instanceof Error)e.message+=' <- '+(typeof f==='string'?f:name(f)??'lambda');throw e;}}
 eval(x,e=this.global){return this.compile(x)(e);}
 compile(x){
  if(x==null||typeof x==='number'||typeof x==='string')return ()=>x;
  if(this.compiled.has(x))return this.compiled.get(x);
  let f;
  if(x.s)f=e=>this.value(x.s,e);
  else if(!Array.isArray(x)) {const v=fromAST(x);f=()=>v;}
  else {const op=name(x[0]),a=x.slice(1),c=a.map(v=>this.compile(v));
   if(op==='quote'){const v=fromAST(a[0]);f=()=>v;}
   else if(op==='if')f=e=>truth(c[0](e))?c[1](e):(c[2]?.(e)??null);
   else if(op==='and')f=e=>{let v=sym('t');for(const q of c){v=q(e);if(!truth(v))return null;}return v;};
   else if(op==='or')f=e=>{for(const q of c){const v=q(e);if(truth(v))return v;}return null;};
   else if(op==='cond'){const clauses=a.map(row=>row.map(v=>this.compile(v)));f=e=>{for(const row of clauses){const v=row[0](e);if(truth(v)){if(row.length===1)return v;let r=null;for(const q of row.slice(1))r=q(e);return r;}}return null;};}
   else if(op==='let'||op==='let*'){const bindings=(a[0]??[]).map(b=>Array.isArray(b)?[name(b[0]),this.compile(b[1]??null)]:[name(b),()=>null]),body=a.slice(1).map(v=>this.compile(v));f=e=>{const old=this.dynamic,env=new Env(e);this.dynamic=bindings.some(b=>this.special.has(b[0]))?new Env(old):old;try{for(const [n,q] of bindings)this.bind(n,q(op==='let'?e:env),env);let v=null;for(const q of body)v=q(env);return v;}finally{this.dynamic=old;}};}
   else if(op==='do'||op==='do*'){const bindings=(a[0]??[]).map(b=>Array.isArray(b)?[name(b[0]),this.compile(b[1]??null),b.length>2?this.compile(b[2]):null]:[name(b),()=>null,null]),end=(a[1]??[]).map(v=>this.compile(v)),body=a.slice(2).map(v=>this.compile(v));f=e=>{const old=this.dynamic,env=new Env(e);this.dynamic=bindings.some(b=>this.special.has(b[0]))?new Env(old):old;try{for(const [n,q] of bindings)this.bind(n,q(op==='do'?e:env),env);try{for(let guard=0;guard<100000;guard++){if(truth(end[0](env))){let v=null;for(const q of end.slice(1))v=q(env);return v;}for(const q of body)q(env);const updates=[];for(const [n,,q] of bindings)if(q){const v=q(env);if(op==='do*')this.set(n,v,env);else updates.push([n,v]);}for(const [n,v] of updates)this.set(n,v,env);}throw Error('Loop limit');}catch(ex){if(ex?.returnBlock===null)return ex.value;throw ex;}}finally{this.dynamic=old;}};}
   else if(op==='setq')f=e=>{let v=null;for(let i=0;i<a.length;i+=2)v=this.set(name(a[i]),c[i+1](e),e);return v;};
   else if(op&& !['declare','declaim','function','lambda','defun','defvar','defparameter','when','unless','progn','prog1','prog2','cond','case','ecase','setf','incf','decf','push','pop','let','let*','do','do*','dolist','dotimes','loop','return','return-from','block'].includes(op)){if(c.length===0)f=e=>this.functions.get(op)();else if(c.length===1)f=e=>this.functions.get(op)(c[0](e));else if(c.length===2)f=e=>this.functions.get(op)(c[0](e),c[1](e));else if(c.length===3)f=e=>this.functions.get(op)(c[0](e),c[1](e),c[2](e));else if(c.length===4)f=e=>this.functions.get(op)(c[0](e),c[1](e),c[2](e),c[3](e));else f=e=>this.functions.get(op)(...c.map(q=>q(e)));}
   else f=e=>this.slowEval(x,e);
  }
  this.compiled.set(x,f);return f;
 }
 slowEval(x,e=this.global){if(x==null||typeof x==='number'||typeof x==='string')return x;if(x.s)return this.value(x.s,e);if(!Array.isArray(x))return fromAST(x);if(!x.length)return null;const op=name(x[0]),a=x.slice(1),ev=v=>this.eval(v,e),seq=v=>this.block(v,e);
 switch(op){
 case 'quote':return fromAST(a[0]);case 'declare':case 'declaim':return null;
 case 'function':return Array.isArray(a[0])?this.fn(a[0][1]??[],a[0].slice(2),e):sym(name(a[0]));
 case 'lambda':return this.fn(a[0]??[],a.slice(1),e);
 case 'defun':{const n=name(a[0]);this.functions.set(n,this.fn(a[1]??[],a.slice(2),e,n));return sym(n);}
 case 'defvar':case 'defparameter':{const n=name(a[0]);this.special.add(n);if(op==='defparameter'||!this.global.find(n))this.global.values.set(n,ev(a[1]??null));return sym(n);}
 case 'if':return truth(ev(a[0]))?ev(a[1]):ev(a[2]??null);
 case 'when':return truth(ev(a[0]))?seq(a.slice(1)):null;case 'unless':return !truth(ev(a[0]))?seq(a.slice(1)):null;
 case 'progn':return seq(a);case 'prog1':{const v=ev(a[0]);seq(a.slice(1));return v;}case 'prog2':ev(a[0]);{const v=ev(a[1]);seq(a.slice(2));return v;}
 case 'and':{let v=sym('t');for(const f of a){v=ev(f);if(!truth(v))return null;}return v;}case 'or':for(const f of a){const v=ev(f);if(truth(v))return v;}return null;
 case 'cond':for(const c of a){const v=ev(c[0]);if(truth(v))return c.length===1?v:seq(c.slice(1));}return null;
 case 'case':case 'ecase':{const v=ev(a[0]);for(const c of a.slice(1)){const keys=Array.isArray(c[0])?c[0]:[c[0]];if(keys.some(k=>['t','otherwise'].includes(name(k))||equal(fromAST(k),v)))return seq(c.slice(1));}return null;}
 case 'setq':{let v=null;for(let i=0;i<a.length;i+=2)v=this.set(name(a[i]),ev(a[i+1]),e);return v;}
 case 'setf':{let v;for(let i=0;i<a.length;i+=2){v=ev(a[i+1]);this.place(a[i],v,e);}return v;}
 case 'incf':case 'decf':{const v=ev(a[0])+(op==='incf'?1:-1)*(a.length>1?ev(a[1]):1);this.place(a[0],v,e);return v;}
 case 'push':{const v=new Pair(ev(a[0]),ev(a[1]));this.place(a[1],v,e);return v;}
 case 'pop':{const v=ev(a[0]);this.place(a[0],cdr(v),e);return car(v);}
 case 'let':case 'let*':{const old=this.dynamic,env=new Env(e);this.dynamic=new Env(old);try{for(const b of a[0]??[]){const pair=Array.isArray(b)?b:[b];this.bind(name(pair[0]),this.eval(pair[1]??null,op==='let'?e:env),env);}return this.block(a.slice(1),env);}finally{this.dynamic=old;}}
 case 'do':case 'do*':{const old=this.dynamic,env=new Env(e),bindings=(a[0]??[]).map(b=>Array.isArray(b)?b:[b]);this.dynamic=new Env(old);try{for(const b of bindings)this.bind(name(b[0]),this.eval(b[1]??null,op==='do'?e:env),env);try{for(let guard=0;guard<100000;guard++){if(truth(this.eval(a[1][0],env)))return this.block(a[1].slice(1),env);this.block(a.slice(2),env);const updates=[];for(const b of bindings)if(b.length>2){const v=this.eval(b[2],env);if(op==='do*')this.set(name(b[0]),v,env);else updates.push([name(b[0]),v]);}for(const [n,v] of updates)this.set(n,v,env);}throw Error('Loop limit');}catch(ex){if(ex?.returnBlock===null)return ex.value;throw ex;}}finally{this.dynamic=old;}}
 case 'dolist':case 'dotimes':{const old=this.dynamic,env=new Env(e);this.dynamic=new Env(old);try{const values=op==='dolist'?array(ev(a[0][1])):Array.from({length:ev(a[0][1])},(_,i)=>i);this.bind(name(a[0][0]),null,env);try{for(const v of values){this.set(name(a[0][0]),v,env);this.block(a.slice(1),env);}return this.eval(a[0][2]??null,env);}catch(ex){if(ex?.returnBlock===null)return ex.value;throw ex;}}finally{this.dynamic=old;}}
 case 'loop':try{for(let guard=0;guard<100000;guard++)seq(a);throw Error('Loop limit');}catch(ex){if(ex?.returnBlock===null)return ex.value;throw ex;}
 case 'return':throw {returnBlock:null,value:ev(a[0]??null)};case 'return-from':throw {returnBlock:name(a[0]),value:ev(a[1]??null)};
 case 'block':try{return seq(a.slice(1));}catch(ex){if(ex?.returnBlock===name(a[0]))return ex.value;throw ex;}
 default:return this.call(op??ev(x[0]),a.map(ev));
 }}
 place(p,v,e){if(p.s)return this.set(p.s,v,e);const op=name(p[0]),args=p.slice(1).map(x=>this.eval(x,e));if(op==='car'){args[0].a=v;return;}if(op==='cdr'){args[0].d=v;return;}if(op==='nth'){let q=args[1];for(let i=0;i<args[0];i++)q=q.d;q.a=v;return;}if(['svref','aref'].includes(op)){args[0][args[1]]=v;return;}if(op==='get'){this.put(args[0],args[1],v);return;}throw Error('Unsupported place '+op);}
 put(s,k,v){if(!this.props.has(s))this.props.set(s,new Map());this.props.get(s).set(k,v);return v;}
 install(){const add=(n,f)=>this.functions.set(n,f),bool=v=>v?sym('t'):null;const copy=x=>x instanceof Pair?new Pair(copy(x.a),copy(x.d)):x;
 for(const [n,f] of Object.entries({'+':(...a)=>a.reduce((x,y)=>x+y,0),'-':(x,...a)=>a.length?a.reduce((x,y)=>x-y,x):-x,'*':(...a)=>a.reduce((x,y)=>x*y,1),'/':(x,...a)=>a.length?a.reduce((x,y)=>x/y,x):1/x,abs:Math.abs,sqrt:Math.sqrt,exp:Math.exp,log:Math.log,expt:Math.pow,sin:Math.sin,cos:Math.cos,tan:Math.tan,atan:(y,x)=>x===undefined?Math.atan(y):Math.atan2(y,x),acos:Math.acos,min:Math.min,max:Math.max,truncate:(a,b=1)=>Math.trunc(a/b),floor:(a,b=1)=>Math.floor(a/b),ceiling:(a,b=1)=>Math.ceil(a/b),round:(a,b=1)=>{const v=a/b,n=Math.floor(v);return v-n===.5?(n%2===0?n:n+1):Math.round(v)},float:x=>x,coerce:x=>x,'1+':x=>x+1,'1-':x=>x-1,minus:x=>-x,plus:x=>x}))add(n,f);
 for(const [n,f] of Object.entries({'=':(a,b)=>a===b,'/=':(a,b)=>a!==b,'<':(a,b)=>a<b,'>':(a,b)=>a>b,'<=':(a,b)=>a<=b,'>=':(a,b)=>a>=b}))add(n,(...a)=>bool(a.slice(1).every((v,i)=>f(a[i],v))));
 add('not',x=>bool(!truth(x)));add('null',x=>bool(x===null));add('atom',x=>bool(!(x instanceof Pair)));add('consp',x=>bool(x instanceof Pair));add('listp',x=>bool(x===null||x instanceof Pair));add('numberp',x=>bool(typeof x==='number'));add('integerp',x=>bool(Number.isInteger(x)));add('symbolp',x=>bool(x===null||!!x?.s));add('stringp',x=>bool(typeof x==='string'));add('eq',(a,b)=>bool(a===b));add('eql',(a,b)=>bool(a===b));add('equal',(a,b)=>bool(equal(a,b)));add('zerop',x=>bool(x===0));add('plusp',x=>bool(x>0));add('minusp',x=>bool(x<0));add('oddp',x=>bool(x%2!==0));
 add('cons',(a,d)=>new Pair(a,d));add('list',(...a)=>list(...a));add('list*',(...a)=>a.slice(0,-1).reduceRight((d,x)=>new Pair(x,d),a.at(-1)));add('car',car);add('cdr',cdr);
 for(let len=2;len<=4;len++)for(let mask=0;mask<2**len;mask++){const ops=Array.from({length:len},(_,i)=>mask>>i&1?'a':'d').join('');const access=ops.split('').reverse();add('c'+ops+'r',x=>{for(const op of access)x=op==='a'?car(x):cdr(x);return x;});}
 for(const [i,n] of ['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'].entries())add(n,x=>{for(let k=0;k<i;k++)x=cdr(x);return car(x);});
 add('nth',(n,x)=>{while(n-->0)x=cdr(x);return car(x);});add('nthcdr',(n,x)=>{while(n-->0)x=cdr(x);return x;});add('length',x=>x instanceof Pair?array(x).length:x?.length??0);add('last',x=>{while(cdr(x))x=cdr(x);return x;});add('butlast',x=>list(...array(x).slice(0,-1)));add('reverse',x=>list(...array(x).reverse()));add('nreverse',x=>{let out=null;while(x){const next=x.d;x.d=out;out=x;x=next;}return out;});add('copy-tree',copy);add('copy-list',x=>list(...array(x)));
 add('append',(...xs)=>{let out=xs.at(-1)??null;for(let i=xs.length-2;i>=0;i--)out=array(xs[i]).reduceRight((d,a)=>new Pair(a,d),out);return out;});add('nconc',(...xs)=>{let out=null,last=null;for(const x of xs){if(!x)continue;if(last)last.d=x;else out=x;last=x;while(last instanceof Pair&&last.d)last=last.d;}return out;});add('rplaca',(x,v)=>(x.a=v,x));add('rplacd',(x,v)=>(x.d=v,x));
 add('member',(v,x,...opts)=>{const t=opts.indexOf(sym(':test')),f=t>=0?opts[t+1]:sym('eql');while(x){if(truth(this.call(f,[v,x.a])))return x;x=x.d;}return null;});add('assoc',(v,x)=>array(x).find(p=>equal(v,car(p)))??null);add('assq',(v,x)=>array(x).find(p=>v===car(p))??null);
 add('remove',(v,x)=>list(...array(x).filter(a=>!equal(v,a))));add('remove-if',(f,x)=>list(...array(x).filter(a=>!truth(this.call(f,[a])))));add('remove-if-not',(f,x)=>list(...array(x).filter(a=>truth(this.call(f,[a])))));add('delete',(v,x)=>list(...array(x).filter(a=>!equal(v,a))));
 add('mapcar',(f,...xs)=>{const out=[];while(xs.every(x=>x instanceof Pair)){out.push(this.call(f,xs.map(x=>x.a)));xs=xs.map(x=>x.d);}return list(...out);});add('mapc',(f,...xs)=>{const first=xs[0];while(xs.every(x=>x instanceof Pair)){this.call(f,xs.map(x=>x.a));xs=xs.map(x=>x.d);}return first;});add('mapcan',(f,x)=>this.call('append',array(x).map(v=>this.call(f,[v]))));add('reduce',(f,x)=>array(x).reduce((a,b)=>this.call(f,[a,b])));add('every',(f,x)=>bool(array(x).every(v=>truth(this.call(f,[v])))));add('some',(f,x)=>{for(const v of array(x)){const r=this.call(f,[v]);if(truth(r))return r;}return null;});
 add('funcall',(f,...a)=>this.call(f,a));add('apply',(f,...a)=>this.call(f,[...a.slice(0,-1),...array(a.at(-1))]));add('identity',x=>x);add('get',(s,k)=>this.props.get(s)?.get(k)??null);add('putprop',(s,v,k)=>this.put(s,k,v));add('set',(s,v)=>this.global.set(name(s),v));add('eval',s=>this.global.get(name(s)));add('boundp',s=>bool(!!this.global.find(name(s))));
 add('vector',(...a)=>a);add('make-array',(n,...args)=>{const i=args.indexOf(sym(':initial-element'));return Array(n).fill(i<0?null:args[i+1]);});add('svref',(a,i)=>a[i]);add('aref',(a,i)=>a[i]);add('sort',(x,f)=>list(...array(x).sort((a,b)=>truth(this.call(f,[a,b]))?-1:1)));add('gensym',()=>sym('js-g'+this.steps++));add('symbol-name',s=>name(s));add('intern',s=>sym(s));add('error',(...a)=>{throw Error(a.map(String).join(' '));});add('format',()=>null);add('print',x=>x);add('pprint',x=>x);
 for(const n of ['list','list*','append','nconc','cons'])add('backq-'+n,(...a)=>this.call(n,a));
 add('memq',(...a)=>this.call('member',a));add('remq',(...a)=>this.call('remove',a));add('ncons',x=>list(x));
 add('copy-seq',x=>x instanceof Pair?list(...array(x)):x.slice());add('maplist',(f,x)=>{const out=[];while(x){out.push(this.call(f,[x]));x=cdr(x);}return list(...out);});add('find',(v,x)=>array(x).find(a=>equal(a,v))??null);add('position',(v,x)=>{const i=array(x).findIndex(a=>equal(a,v));return i<0?null:i;});
 add('union',(a,b)=>list(...[...array(a),...array(b)].filter((v,i,x)=>x.findIndex(w=>equal(w,v))===i)));add('intersection',(a,b)=>list(...array(a).filter(v=>array(b).some(w=>equal(v,w)))));add('set-difference',(a,b)=>list(...array(a).filter(v=>!array(b).some(w=>equal(v,w)))));add('delete-duplicates',a=>list(...array(a).filter((v,i,x)=>x.findIndex(w=>equal(w,v))===i)));add('logand',(...a)=>a.reduce((x,y)=>x&y));add('logior',(...a)=>a.reduce((x,y)=>x|y));
 add('rem',(x,y)=>x%y);add('mod',(x,y)=>((x%y)+y)%y);
 this.global.values.set('pi',Math.PI);
 }
 load(program){for(const f of program)this.eval(f);for(const [n,v] of Object.entries({gothicwidth:8,minchowidth:8,local_gothicwidth:8,local_minchowidth:8,hirawidth:.4,'*default-hirawidth*':8,tateyokoratio:.4,tatekazari:1.5,tomeheight:1.8,kazariheight:1.4,meshsize:.01}))this.global.values.set(n,v);}
}
