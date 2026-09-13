export function hasCodePoint(metadata, code){
 let lo=0,hi=metadata.ranges.length-1;
 while(lo<=hi){const m=(lo+hi)>>1,[a,b]=metadata.ranges[m];if(code<a)hi=m-1;else if(code>b)lo=m+1;else return true;}
 return false;
}
export function missingCharacters(metadata,text){
 return [...new Set(Array.from(text).filter(c=>!/[\s\p{Default_Ignorable_Code_Point}]/u.test(c)&&!hasCodePoint(metadata,c.codePointAt(0))))];
}
