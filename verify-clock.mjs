import assert from 'node:assert/strict';
import {clockMotion,foldStrokePath,formatClock,strokeVisibility,transitionProgress} from './web/clock-core.js';

const morning=formatClock(new Date(2020,0,1,7,8,9)),evening=formatClock(new Date(2020,0,1,23,59,58));
assert.deepEqual(morning,{ascii:'07:08:09',display:'07:08:09'});
assert.deepEqual(evening,{ascii:'23:59:58',display:'23:59:58'});
assert.equal(clockMotion.speed,.75);assert.equal(clockMotion.duration,clockMotion.baseDuration/clockMotion.speed);
assert.equal(transitionProgress(10,10),0);assert.equal(transitionProgress(11,10),1);
assert.equal(strokeVisibility(0),0);assert.equal(strokeVisibility(1),1);
const stroke=[{x:0,y:0},{x:10,y:0},{x:10,y:10}];assert.deepEqual(foldStrokePath(stroke,0),stroke.map(()=>({x:0,y:0})));assert.deepEqual(foldStrokePath(stroke,1),stroke);
console.log(JSON.stringify({passed:8,format:evening.display,speed:clockMotion.speed,duration:clockMotion.duration,foldsToZero:true,restoresExactPath:true,hiddenAtZero:true}));
