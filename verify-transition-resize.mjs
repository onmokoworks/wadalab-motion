import fs from 'node:fs/promises';
const noop=()=>{},ctx=new Proxy({}, {get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)}),canvas={style:{},getContext:()=>ctx,addEventListener:noop,setAttribute:noop};
let frame;const handlers={};
Object.assign(globalThis,{innerWidth:1920,innerHeight:1080,devicePixelRatio:1,scrollY:0,location:{search:''},Path2D:class {moveTo(){}lineTo(){}ellipse(){}},document:{hidden:false,querySelector:()=>canvas,createElement:()=>canvas,body:{append:noop}},addEventListener:(k,f)=>handlers[k]=f,matchMedia:()=>({matches:false}),requestAnimationFrame:f=>frame=f,fetch:async u=>({ok:true,json:async()=>JSON.parse(await fs.readFile(u,'utf8'))})});
const url=new URL('./web/motion-4.js',import.meta.url);
let source=await fs.readFile(url,'utf8');source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${new URL(p,url)}'`).replaceAll('import.meta.url',JSON.stringify(url.href));
source+='\nexport const state=()=>({active,time,width,scale,drift,rows,getGlyph});';
const {state}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let total=0;
for(let f=0;f<24000;f++){
 if(process.argv.includes('--resize')&&f===16400){innerWidth=3840;innerHeight=2160;handlers.resize();}
 frame(1+f*1000/60);if(f%6)continue;
 const s=state();if(s.active.length<2)continue;
 for(let r=0;r<s.rows.length;r++){
  const factor=s.scale*s.rows[r][0],shift=-s.drift*s.rows[r][1],items=[];
  s.active.forEach((sentence,id)=>{
   const timing=sentence.timing[r],period=(sentence.width+180)*factor,offset=((shift%period)+period)%period;
   sentence.characters.forEach((c,i)=>{
    if(s.time<=timing.births[i]||s.time>=timing.out+i*.1+.48)return;
    const g=s.getGlyph(c),l=(sentence.positions[i]+g.minX)*factor+offset,h=(sentence.positions[i]+g.maxX)*factor+offset;
    for(let k=Math.ceil(-h/period);k<=Math.floor((s.width-l)/period);k++)items.push({l:l+k*period,h:h+k*period,id,c});
   });
  });
  for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){const x=items[a],y=items[b];if(x.id!==y.id&&x.l<y.h&&x.h>y.l){console.log(JSON.stringify({frame:f,time:s.time,row:r,x,y,phrases:s.active.map(p=>p.characters.join(''))}));process.exit(1);}}
 }
 total++;
}
console.log('No overlapping sentences in '+total+' transition frames');
