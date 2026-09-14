export function textThrough(items,sourceIndex){
 return items.slice(0,Math.max(0,sourceIndex+1)).map(item=>item.segment).join('');
}
