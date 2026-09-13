import assert from 'node:assert/strict';
import {clockMotion,formatClock,transitionProgress} from './web/clock-core.js';

const morning=formatClock(new Date(2020,0,1,7,8,9)),evening=formatClock(new Date(2020,0,1,23,59,58));
assert.deepEqual(morning,{ascii:'07:08:09',display:'07:08:09'});
assert.deepEqual(evening,{ascii:'23:59:58',display:'23:59:58'});
assert.equal(clockMotion.speed,.75);assert.equal(clockMotion.duration,clockMotion.baseDuration/clockMotion.speed);
assert.equal(transitionProgress(10,10),0);assert.equal(transitionProgress(11,10),1);
console.log(JSON.stringify({passed:4,format:evening.display,speed:clockMotion.speed,duration:clockMotion.duration}));
