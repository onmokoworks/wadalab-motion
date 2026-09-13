import {clamp,smooth} from './fold-core.js';

export const clockMotion={baseDuration:.35,speed:.75,duration:.35/.75};
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

export function formatClock(date){
 const ascii=[date.getHours(),date.getMinutes(),date.getSeconds()].map(value=>String(value).padStart(2,'0')).join(':');
 return {ascii,display:ascii};
}

export function transitionProgress(now,started,duration=clockMotion.duration){return Math.max(0,Math.min(1,(now-started)/duration));}

export function strokeVisibility(progress){return smooth(clamp((progress-.08)/.18));}

export function foldStrokePath(path,progress){
 if(progress>=.999999)return path.map(point=>({...point}));if(!path.length)return [];const angles=path.slice(1).map((point,index)=>Math.atan2(point.y-path[index].y,point.x-path[index].x)),lengths=path.slice(1).map((point,index)=>Math.hypot(point.x-path[index].x,point.y-path[index].y));if(!angles.length)return path.map(point=>({...point}));const unfolded=[{...path[0]}];let angle=angles[0];
 for(let i=0;i<angles.length;i++){if(i)angle+=angleDelta(angles[i],angles[i-1])*smooth(clamp(progress*1.25-i/Math.max(1,angles.length-1)*.25));const previous=unfolded.at(-1);unfolded.push({x:previous.x+Math.cos(angle)*lengths[i],y:previous.y+Math.sin(angle)*lengths[i]});}
 const growth=smooth(progress),pivot=path[0];return unfolded.map(point=>({x:pivot.x+(point.x-pivot.x)*growth,y:pivot.y+(point.y-pivot.y)*growth}));
}
