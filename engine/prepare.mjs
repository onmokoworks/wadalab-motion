// Preserve original EUC-JP symbol semantics when reading the UTF-8 mirror in Unicode Lisp.
// CL uppercases ASCII identifiers; Japanese/fullwidth identifiers must retain their case.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
export function preserveSymbols(text){
 let result='',i=0;
 while(i<text.length){const c=text[i];
  if(c===';'){const j=text.indexOf('\n',i);if(j<0){result+=text.slice(i);break;}result+=text.slice(i,j+1);i=j+1;continue;}
  if(text.startsWith('#|',i)){let j=i+2,depth=1;while(j<text.length&&depth){if(text.startsWith('#|',j)){depth++;j+=2;}else if(text.startsWith('|#',j)){depth--;j+=2;}else j++;}result+=text.slice(i,j);i=j;continue;}
  if(c==='"'||c==='|'){let j=i+1;for(;j<text.length;j++){if(text[j]==='\\'){j++;continue;}if(text[j]===c){j++;break;}}result+=text.slice(i,j);i=j;continue;}
  if(/[\s()'`,]/.test(c)){result+=c;i++;continue;}
  let j=i+1;while(j<text.length&&!/[\s()'`,;"|]/.test(text[j]))j++;
  const token=text.slice(i,j);result+=/[^\x00-\x7f]/.test(token)&&!token.startsWith('#\\')?'|'+token.replace(/[a-z]/g,c=>c.toUpperCase())+'|':token;i=j;
 }return result;
}
async function walk(dir){for(const entry of await readdir(path.join(root,'clwfk',dir),{withFileTypes:true})){const rel=path.join(dir,entry.name);if(entry.isDirectory()){await walk(rel);continue;}if(!entry.name.endsWith('.l'))continue;const out=path.join(root,'compatible',rel);await mkdir(path.dirname(out),{recursive:true});await writeFile(out,preserveSymbols(await readFile(path.join(root,'clwfk',rel),'utf8')));}}
await walk('');
