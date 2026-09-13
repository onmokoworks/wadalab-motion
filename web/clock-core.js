export const clockMotion={baseDuration:.35,speed:.75,duration:.35/.75};

const fullwidth='０１２３４５６７８９';
export function formatClock(date){
 const ascii=[date.getHours(),date.getMinutes(),date.getSeconds()].map(value=>String(value).padStart(2,'0')).join(':');
 return {ascii,display:[...ascii].map(character=>character===':'?'：':fullwidth[Number(character)]).join('')};
}

export function transitionProgress(now,started,duration=clockMotion.duration){return Math.max(0,Math.min(1,(now-started)/duration));}
