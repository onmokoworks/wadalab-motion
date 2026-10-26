// Opt-in Motion-4 rendering A/B diagnostics, loaded only for ?diag=all.
// The metric helpers are pure; the DOM is touched only by mountDiagnostics().
// requestAnimationFrame cadence is a proxy for frame production, not the
// frame rate the GPU actually presented.
export const MODES=['idle','clear','sprites','live','full'];
export const WARMUP_MS=2000,SAMPLE_MS=10000;

export function summarize(values){
 if(!values.length)return {mean:null,p50:null,p95:null};
 const sorted=[...values].sort((a,b)=>a-b),pick=p=>sorted[Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1)];
 return {mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,p50:pick(.5),p95:pick(.95)};
}

export function phaseMetrics({mode,intervals,draws,sprites,sampleStart,sampleEnd}){
 const elapsed=intervals.reduce((a,b)=>a+b,0),{mean,p95}=summarize(draws);
 return {mode,frames:intervals.length,rafIntervalMs:summarize(intervals),rafRatePerSec:elapsed?intervals.length*1000/elapsed:null,
  jsDrawMs:{mean,p95},spriteCreations:sprites,spriteCreationsPerSec:elapsed?sprites*1000/elapsed:null,sampleWindow:[sampleStart,sampleEnd]};
}

// Each phase: the first frame restarts the story, warm-up frames are discarded,
// then intervals ending inside the sample window are kept.
export function createRun({modes=MODES,warmupMs=WARMUP_MS,sampleMs=SAMPLE_MS}={}){
 let index=0,phase=null,previous=0,sampling=false;
 const run={status:'running',reason:null,phases:[],
  frame(now){
   if(run.status!=='running')return {mode:null,reset:false};
   if(phase&&now>=phase.sampleEnd){
    run.phases.push(phaseMetrics(phase));phase=null;sampling=false;
    if(++index>=modes.length){run.status='done';return {mode:null,reset:false};}
   }
   if(!phase){phase={mode:modes[index],sampleStart:now+warmupMs,sampleEnd:now+warmupMs+sampleMs,intervals:[],draws:[],sprites:0};previous=now;return {mode:phase.mode,reset:true};}
   sampling=now>=phase.sampleStart;if(sampling)phase.intervals.push(now-previous);previous=now;
   return {mode:phase.mode,reset:false};
  },
  draw(ms){if(sampling)phase.draws.push(ms);},
  spriteCreated(){if(sampling)phase.sprites++;},
  invalidate(reason){if(run.status==='running'){run.status='invalid';run.reason=reason;sampling=false;}}
 };
 return run;
}

export const sameViewport=(a,b)=>['cssWidth','cssHeight','devicePixelRatio','backingWidth','backingHeight','scrollY'].every(key=>a[key]===b[key]);

export function attributeLongFrames([from,to],entries){
 const hits=entries.filter(entry=>entry.startTime>=from&&entry.startTime<to);
 return {count:hits.length,durationMs:hits.reduce((n,e)=>n+e.duration,0),blockingMs:hits.reduce((n,e)=>n+(e.blockingDuration??0),0)};
}

export function buildReport({phases,viewport,longFrames=null,userAgent=''}){
 return {note:'rafRatePerSec は requestAnimationFrame 間隔からの推定で、GPU が実際に表示した FPS ではありません。',
  warmupMs:WARMUP_MS,sampleMs:SAMPLE_MS,viewport,userAgent,
  phases:phases.map(phase=>({...phase,longAnimationFrames:longFrames?attributeLongFrames(phase.sampleWindow,longFrames):null}))};
}

const fixed=(value,digits=1)=>value==null?'-':value.toFixed(digits);
export function formatReport(report){
 const v=report.viewport,lines=[
  'Motion-4 診断結果',
  '※ RAF/s は描画要求の周期からの推定です。GPU の表示 FPS ではありません。',
  `表示: CSS ${v.cssWidth}×${v.cssHeight} / backing ${v.backingWidth}×${v.backingHeight} / DPR ${v.devicePixelRatio} / scrollY ${v.scrollY}`,
  '',
  'mode     RAF/s  間隔ms mean/p50/p95   JS ms mean/p95  sprite生成(/s)  LoAF件/ms'];
 for(const p of report.phases){
  const i=p.rafIntervalMs,loaf=p.longAnimationFrames?`${p.longAnimationFrames.count}/${fixed(p.longAnimationFrames.durationMs,0)}`:'非対応';
  lines.push(`${p.mode.padEnd(8)} ${fixed(p.rafRatePerSec).padStart(5)}  ${`${fixed(i.mean)}/${fixed(i.p50)}/${fixed(i.p95)}`.padEnd(20)} ${`${fixed(p.jsDrawMs.mean,2)}/${fixed(p.jsDrawMs.p95,2)}`.padEnd(15)} ${`${p.spriteCreations} (${fixed(p.spriteCreationsPerSec)})`.padEnd(15)} ${loaf}`);
 }
 if(report.phases.find(p=>p.mode==='idle')?.rafRatePerSec<40)lines.push('','注意：描画なしでも更新頻度が低くなっています。前面表示・省電力・ブラウザの制限を含めて確認が必要です。');
 return lines.join('\n');
}

const INTRO=['Motion-4 描画診断（?diag=all）',
 `idle / clear / sprites / live / full の5モードを、各 ${WARMUP_MS/1000}秒の慣らし＋${SAMPLE_MS/1000}秒の計測で順に実行します（約1分）。`,
 '各モードは同じ文・同じ表示位置から始まります。',
 '計測中は操作・スクロール・タブ切替・サイズ変更をしないでください（無効になります）。',
 '開始すると全画面を要求します。失敗した場合は F11 で全画面にしてから開始してください。',
 '結果はどこにも送信されません。'].join('\n');

export function mountDiagnostics({restart,prepare,viewport,isInteracting}){
 const make=(tag,text='')=>{const node=document.createElement(tag);node.textContent=text;return node;};
 const panel=make('section'),message=make('p',INTRO),start=make('button','診断を開始'),copy=make('button','JSONをコピー'),output=make('textarea');
 panel.setAttribute('aria-label','Motion-4 描画診断');
 Object.assign(panel.style,{position:'fixed',top:'12px',right:'12px',zIndex:'10',maxWidth:'min(50rem,calc(100vw - 24px))',maxHeight:'calc(100vh - 24px)',overflow:'auto',padding:'12px 14px',background:'#fff',border:'1px solid #999',font:'12px/1.5 monospace',color:'#111'});
 Object.assign(message.style,{margin:'0 0 8px',whiteSpace:'pre-wrap'});
 Object.assign(output.style,{width:'100%',height:'10em',marginTop:'8px',font:'11px monospace'});
 copy.style.marginLeft='8px';output.readOnly=true;copy.hidden=output.hidden=true;
 panel.append(message,start,copy,output);document.body.append(panel);
 const loafSupported=typeof PerformanceObserver==='function'&&(PerformanceObserver.supportedEntryTypes??[]).includes('long-animation-frame');
 let run=null,baseline=null,entries=[],observer=null;
 function finish(){
  if(observer){entries.push(...observer.takeRecords());observer.disconnect();observer=null;}
  panel.hidden=false;start.disabled=false;start.textContent='再実行';
  if(run.status==='invalid'){message.textContent=`診断は無効になりました：${run.reason}\n条件を戻して再実行してください。`;return;}
  const report=buildReport({phases:run.phases,viewport:baseline,userAgent:globalThis.navigator?.userAgent??'',
   longFrames:loafSupported?entries.map(e=>({startTime:e.startTime,duration:e.duration,blockingDuration:e.blockingDuration})):null});
  message.textContent=formatReport(report);output.value=JSON.stringify(report,null,2);copy.hidden=output.hidden=false;copy.textContent='JSONをコピー';
 }
 start.addEventListener('click',async()=>{
  start.disabled=true;copy.hidden=output.hidden=true;run=null;
  // Must be the first call so it still has the click's user activation.
  try{await document.documentElement.requestFullscreen?.();}catch{}
  await prepare((done,total)=>{message.textContent=`グリフを準備中 ${done}/${total}`;});
  message.textContent='表示の安定を待っています…';
  await new Promise(resolve=>setTimeout(resolve,600));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  baseline=viewport();entries=[];
  if(loafSupported){observer=new PerformanceObserver(list=>entries.push(...list.getEntries()));observer.observe({type:'long-animation-frame'});}
  panel.hidden=true;run=createRun();
 });
 copy.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(output.value);copy.textContent='コピーしました';}
  catch{copy.textContent='コピーできません：下の欄を選択してコピーしてください';output.focus();output.select();}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&run?.status==='running'){run.invalidate('タブが非表示になりました');finish();}});
 return {
  // Returns the render mode for this frame, or null for normal rendering.
  beforeFrame(now){
   if(run?.status!=='running')return null;
   const reason=document.hidden?'タブが非表示になりました':!sameViewport(baseline,viewport())?'表示サイズ・DPR・スクロール位置が変わりました':isInteracting()?'ドラッグ操作がありました':null;
   if(reason){run.invalidate(reason);finish();return null;}
   const step=run.frame(now);
   if(step.reset)restart();
   if(run.status==='done'){finish();return null;}
   return step.mode;
  },
  afterFrame(started){if(run?.status==='running')run.draw(performance.now()-started);},
  spriteCreated(){if(run?.status==='running')run.spriteCreated();}
 };
}
