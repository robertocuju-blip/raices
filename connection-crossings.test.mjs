import assert from 'node:assert/strict';
import {connectionCrossings} from './lib/connection-crossings.ts';
import {demo,layout} from './lib/family.ts';

const descendant={id:'stem',kind:'family',familyKey:'f1',d:'M 50 0 C 50 30 50 70 50 100'};
const couple={id:'couple',kind:'couple',d:'M 0 50 H 100'};
assert.deepEqual(connectionCrossings([couple,descendant]),[{point:{x:50,y:50},over:couple}],'A crossing is marked without breaking the couple line');
const branch={id:'brace',kind:'family',familyKey:'f2',d:'M 0 0 C 30 30 70 70 100 100'};
assert.deepEqual(connectionCrossings([branch,descendant]),[{point:{x:50,y:50},over:descendant}]);
assert.deepEqual(connectionCrossings([{...branch,familyKey:'f1'},descendant]),[],'Branches of the same family are continuous at their junction');
assert.deepEqual(connectionCrossings([couple,{...descendant,d:'M 50 50 C 50 70 50 80 50 100'}]),[],'A line joining the couple is not an overpass');
assert.deepEqual(connectionCrossings(layout(demo.people).connections),[],'A planar tree needs no overpasses');
console.log('Pasos por encima solo en cruces reales; las uniones familiares siguen conectadas.');
