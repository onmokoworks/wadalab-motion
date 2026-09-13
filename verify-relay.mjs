import test from 'node:test';import assert from 'node:assert/strict';
import {relayProfile,relaySchedule,relayPaths} from './web/structure.js';
const part=(x)=>({path:[{x,y:0},{x:x+10,y:20}],pivot:{x,y:0},theta:.6,mode:'rotate',fixed:false});
const strategy={rule:10,parts:[part(0),part(40)],graph:{nodes:[]}};
test('next glyph waits for outgoing path; spaces break propagation',()=>{const glyph={strategy},items=[{glyph,born:0},{glyph,born:.07},{glyph:null,born:.14},{glyph,born:.21}],times=relaySchedule(items,.35);assert.equal(times[1],relayProfile(strategy).release*.35);assert.equal(times[3],.21);assert.ok(times[1]>.07);});
test('opening travels left to right and ends at the exact rest pose',()=>{const p=relayPaths(strategy,.2);assert.notDeepEqual(p[0],relayPaths(strategy,0)[0]);assert.deepEqual(p[1],relayPaths(strategy,0)[1]);assert.deepEqual(relayPaths(strategy,1),strategy.parts.map(p=>p.path));});
