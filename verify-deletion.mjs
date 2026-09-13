import assert from 'node:assert/strict';
import {deletionDelays,removedIndices} from './web/deletion-schedule.js';

assert.deepEqual(removedIndices([...('和田研究')],[...('和田')]),[2,3]);
assert.deepEqual(removedIndices([...('和田研究')],[...('和研究')]),[1]);

const short=deletionDelays(3);
assert.ok(short[2]<short[1]&&short[1]<short[0]);

const long=deletionDelays(20),chronological=[...long].reverse();
assert.equal(chronological[0],0);
assert.ok(chronological.slice(1,-3).some((delay,index)=>delay-chronological[index]<.02));
assert.ok(chronological.at(-1)-chronological.at(-2)>=.1);
assert.ok(chronological.at(-2)-chronological.at(-3)>=.1);

console.log(JSON.stringify({passed:8,longestDelay:Math.max(...long),acceleratingBatches:true,slowsForFinalThree:true}));
