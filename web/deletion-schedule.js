export function removedIndices(previous,next){
 let prefix=0;
 while(prefix<previous.length&&prefix<next.length&&previous[prefix]===next[prefix])prefix++;
 let suffix=0;
 while(suffix<previous.length-prefix&&suffix<next.length-prefix&&previous[previous.length-1-suffix]===next[next.length-1-suffix])suffix++;
 return Array.from({length:previous.length-prefix-suffix},(_,index)=>prefix+index);
}

export function deletionDelays(count){
 const delays=new Array(count),order=Array.from({length:count},(_,index)=>count-1-index);
 let cursor=0,position=0,batchSize=1,remaining=count;
 while(remaining>3){
  const take=Math.min(batchSize,remaining-3);
  for(let index=0;index<take;index++)delays[order[position++]]=cursor+index*.012;
  remaining-=take;
  cursor+=Math.max(.038,.075-batchSize*.005);
  batchSize++;
 }
 for(let index=0;index<remaining;index++)delays[order[position++]]=cursor+index*.11;
 return delays;
}
