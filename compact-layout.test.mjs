import assert from 'node:assert/strict';
import {compactLayout} from './lib/compact-layout.ts';

const step = 204;
const link = (parent, child) => [[parent, 1], [child, -1]];
const children = Array.from({length: 10}, (_, index) => 'child-' + index);
const rows = [['left', 'right'], children];
const centres = [link('left', children[0]), link('right', children.at(-1))];
const compact = compactLayout(rows, centres, [], step);
const distance = (positions, a, b) => positions.get(b) - positions.get(a);

// The dense row forces nine pitches. Moving each sparse-row endpoint by
// half a pitch can close its gap by one pitch, which is the feasible limit.
assert.ok(Math.abs(distance(compact, children[0], children.at(-1)) - 9 * step) < .001);
assert.ok(Math.abs(distance(compact, 'left', 'right') - 8 * step) < .001);
assert.deepEqual(compactLayout(rows, centres, [], step), compact);

// Reversed parent/child order makes exact alignment impossible. Use the
// minimum feasible deviation and keep the cards one pitch apart.
const reversedRows = [['a', 'b'], ['c', 'd']];
const reversed = compactLayout(reversedRows, [link('a', 'd'), link('b', 'c')], [], step);
assert.ok(Math.abs(Math.abs(distance(reversed, 'a', 'd')) - step) < .001);
assert.ok(Math.abs(distance(reversed, 'c', 'd') - step) < .001);
console.log('Compactación determinista y límites comprobados con alineación posible e incompatible.');
