import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
await import('./engine/prepare.mjs');
const port=4184;
const worker=spawn('java',['-Dfile.encoding=UTF-8','-jar','runtime/abcl.jar','--noinform','--batch','--load','engine/bridge.lisp'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
let ready=false,coverage=0,current=null,stopping=false;const queue=[],cache=new Map();let cachedBytes=0;
function pump(){if(!ready||current||!queue.length)return;current=queue.shift();current.timer=setTimeout(()=>{current?.reject(Error('原典の生成処理が制限時間を超えました。文字数を減らしてください。'));worker.kill();},60000);worker.stdin.write(current.command+'\n');}
readline.createInterface({input:worker.stdout}).on('line',line=>{
 if(line.startsWith('READY ')){ready=true;coverage=Number(line.slice(6));console.log(`和田研フォントキット準備完了 (${coverage} 文字定義)。 http://127.0.0.1:${port}`);pump();}
 else if(line.startsWith('@')&&current){const job=current;clearTimeout(job.timer);current=null;try{job.resolve(JSON.parse(line.slice(1)));}catch(e){job.reject(e);}pump();}
});
worker.stderr.on('data',d=>console.error(String(d).slice(0,1200)));
function fail(e){ready=false;if(current){clearTimeout(current.timer);current.reject(e);current=null;}while(queue.length)queue.shift().reject(e);}
worker.on('error',e=>fail(e));worker.on('exit',()=>{fail(Error('文字生成エンジンが停止しました。起動スクリプトを再実行してください。'));if(!stopping)console.error('文字生成エンジンが停止しました。');});
const styles=['mincho','gothic','maru'];
function point(p){return {kind:p[0],x:p[1],y:p[2]};}
function normalize(raw,text,steps){
 if(raw[0]==='error')throw Error(raw[1]);
 return {source:'CLWFK',revision:'69883aef69f4762a9b3afceb257044c71377499d',text,steps,coordinateSystem:'400x400, +y down',glyphs:raw.map(g=>typeof g[1]==='string'?{character:String.fromCodePoint(g[0]),error:g[1],message:g[2]??'原典に文字定義がありません。'}:{character:String.fromCodePoint(g[0]),sourceCharacter:String.fromCodePoint(g[1]),skeleton:{points:g[2].map(p=>({x:p[0],y:p[1]})),strokes:g[3].map(s=>({type:s[0],indices:s[1]}))},frames:g[4].map((outlines,i)=>({time:i/(steps-1),outlines:outlines.map(p=>({points:p.map(point)}))}))})};
}
const finite=(x,lo,hi,fallback)=>{const n=Number(x??fallback);return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fallback;};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const reply=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));};
 try{
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`)return reply(403,{error:'Local requests only'});
  if(req.headers.origin&&!([`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin)))return reply(403,{error:'Local requests only'});
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/status')return reply(200,{ready,coverage});
  if(url.pathname==='/api/generate'&&req.method==='POST'){
   if(!ready)return reply(503,{error:'文字生成エンジンを準備しています。数秒後に再試行してください。'});
   if(queue.length>=4)return reply(429,{error:'生成中です。少し待って再試行してください。'});
   let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return reply(413,{error:'入力が長すぎます'});}
   const q=JSON.parse(body),text=Array.from(String(q.text??'永').normalize('NFC')).slice(0,12).join('');
   const weight=finite(q.weight,1,20,8),serif=finite(q.serif,.05,1.5,1),contrast=finite(q.contrast,.15,1,.4),steps=Math.round(finite(q.steps,2,60,36));
   const style=Math.max(0,styles.indexOf(q.style??'mincho'));
   const codes=[...new Set(Array.from(text).filter(c=>c.trim()).map(c=>c.codePointAt(0)))];
   const key=JSON.stringify([codes,style,weight,serif,contrast,steps]);let raw=cache.get(key);
   if(!raw){raw=await new Promise((resolve,reject)=>{queue.push({resolve,reject,command:`((${codes.join(' ')}) ${style} ${weight} ${serif} ${contrast} ${steps})`});pump();});const size=JSON.stringify(raw).length;if(cachedBytes+size>32000000){cache.clear();cachedBytes=0;}cache.set(key,raw);cachedBytes+=size;}
   return reply(200,normalize(raw,text,steps));
  }
  const files={'/':'web/index.html','/preview':'web/preview.html','/app.js':'web/app.js','/style.css':'web/style.css','/LICENSE.txt':'engine/clwfk/README'};
  if(req.method!=='GET'||!files[url.pathname])return reply(404,{error:'Not found'});
  const type=url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.txt')?'text/plain':'text/html';
  res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(await readFile(files[url.pathname]));
 }catch(e){reply(500,{error:e.message});}
});
server.on('error',e=>{console.error(e.message);stopping=true;worker.kill();process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{console.log(`ブラウザで http://127.0.0.1:${port} を開いてください。停止は Ctrl+C。`);if(process.argv.includes('--open'))spawn('cmd.exe',['/c','start','',`http://127.0.0.1:${port}`],{windowsHide:true,stdio:'ignore'}).on('error',console.error);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;worker.kill();server.close();process.exit(0);});
process.on('exit',()=>worker.kill());
