// Both sentences share the same row velocity. Their relative x positions are
// constant; compare every repeat that can enter the viewport before departure.
export function scheduleLetters({bounds,period,old,width,shift,travel,start,stagger,gap=3}) {
 const copies=(left,right,repeat)=>{
  const result=[];
  const first=Math.ceil((-shift-right-gap)/repeat);
  const last=Math.floor((width+travel-shift-left+gap)/repeat);
  for(let k=first;k<=last;k++)result.push([left+k*repeat,right+k*repeat]);
  return result;
 };
 const occupied=old.flatMap(sentence=>sentence.bounds.flatMap((b,i)=>
  copies(b[0],b[1],sentence.period).map(([left,right])=>({left,right,end:sentence.ends[i]}))));
 let previous=start-stagger;
 return bounds.map(([left,right])=>{
  let born=Math.max(start,previous+stagger);
  for(const [l,r] of copies(left,right,period))for(const item of occupied){
   if(l<item.right+gap&&r>item.left-gap)born=Math.max(born,item.end+.015);
  }
  previous=born;return born;
 });
}
