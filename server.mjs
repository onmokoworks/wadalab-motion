import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const port=4184;
const files={'/source-vm.js':'web/source-vm.js','/source-fast.js':'web/source-fast.js','/source-engine.js':'web/source-engine.js','/native-renderer.js':'web/native-renderer.js','/deletion-schedule.js':'web/deletion-schedule.js','/playback-control.js':'web/playback-control.js','/source-program.json':'web/source-program.json','/source-glyphs.json':'web/source-glyphs.json','/SOURCE-LICENSE.txt':'web/SOURCE-LICENSE.txt','/structure.js':'web/structure.js','/single':'web/single.html','/single-app.js':'web/single-app.js','/single-style.css':'web/single-style.css','/clock':'web/clock.html','/clock.html':'web/clock.html','/clock-app.js':'web/clock-app.js','/clock-core.js':'web/clock-core.js','/clock.css':'web/clock.css','/font/clock-skeletons.json':'web/font/clock-skeletons.json','/qa':'../../work/fold-qa.html','/':'web/index.html','/app.js':'web/app.js','/style.css':'web/style.css','/font-support.js':'web/font-support.js','/fold-core.js':'web/fold-core.js','/renderer.js':'web/renderer.js','/motion-config.js':'web/motion-config.js','/export-rig.js':'web/export-rig.js','/font/wlmaru2004emoji.ttf':'web/font/wlmaru2004emoji.ttf','/font/ascii-outlines.json':'web/font/ascii-outlines.json','/font/metadata.json':'web/font/metadata.json','/LICENSE.txt':'web/SOURCE-LICENSE.txt'};
const compressed=new Map();
files['/motion-library.js']='web/motion-library.js';
files['/wadamotion-1/']='web/wadamotion-1.html';
files['/wadamotion-2/']='web/wadamotion-2.html';
files['/wadamotion-3/']='web/wadamotion-3.html';
files['/PROJECT-LICENSE.txt']='LICENSE';
files['/font/LICENSE.txt']='web/font/LICENSE.txt';
files['/alpha-motion.js']='web/alpha-motion.js';
files['/font/alpha-centerlines.json']='web/font/alpha-centerlines.json';
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');
 // Cloudflare quick tunnels preserve the request Host, so the public tunnel
 // hostname must be accepted alongside direct local requests.
 const path=new URL(req.url,'http://127.0.0.1').pathname,file=files[path];
 if(req.method!=='GET'||!file){res.writeHead(404);res.end();return;}
 try{const info=await stat(file),etag=`W/"${info.size}-${Math.trunc(info.mtimeMs)}"`;if(req.headers['if-none-match']===etag){res.writeHead(304,{ETag:etag});res.end();return;}const b=await readFile(file),ext=file.split('.').pop(),headers={'Content-Type':({'js':'text/javascript','css':'text/css','html':'text/html','json':'application/json','ttf':'font/ttf','txt':'text/plain'}[ext]??'application/octet-stream')+'; charset=utf-8',ETag:etag};if(/gzip/.test(req.headers['accept-encoding']??'')&&b.length>1024&&ext!=='ttf'){let cached=compressed.get(file);if(!cached||cached.etag!==etag){cached={etag,data:gzipSync(b,{level:6})};compressed.set(file,cached);}headers['Content-Encoding']='gzip';headers.Vary='Accept-Encoding';res.writeHead(200,headers);res.end(cached.data);}else{res.writeHead(200,headers);res.end(b);}}catch{res.writeHead(500);res.end('File unavailable');}
});
server.listen(port,'127.0.0.1',()=>{console.log(`http://127.0.0.1:${port}`);if(process.argv.includes('--open'))spawn('cmd.exe',['/c','start','',`http://127.0.0.1:${port}`],{windowsHide:true,stdio:'ignore'}).on('error',console.error);});
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>server.close(()=>process.exit(0)));




