import assert from 'node:assert/strict';
import {layout,demo,NODE_WIDTH} from './lib/family.ts';
import {routeLanes} from './lib/lane-routing.ts';

const ordinary=layout(demo.people),plan=routeLanes(ordinary);
assert.equal(plan.bridges.length,0);
for(const route of ordinary.routes){
 const paths=plan.lines.filter(path=>path.familyKey===route.key);
 assert.ok(paths.some(path=>path.axis==='v'&&Math.abs(path.fixed-route.origin.x)<.06&&Math.abs(path.min-route.origin.y)<.06));
 for(const child of route.children)assert.ok(paths.some(path=>path.axis==='v'&&Math.abs(path.fixed-child.x)<.06&&Math.abs(path.max-child.y)<.06),'The line must reach the child card');
}
const crossing={width:880,connections:[],positions:new Map([['a',{x:32,y:48}],['b',{x:440,y:48}]]),routes:[
 {key:'left',origin:{x:118,y:155.5},parents:['a'],children:[{id:'a1',x:118,y:244.5},{id:'a2',x:526,y:244.5}]},
 {key:'right',origin:{x:526,y:155.5},parents:['b'],children:[{id:'b1',x:322,y:244.5},{id:'b2',x:730,y:244.5}]}
]};
const crossed=routeLanes(crossing),rails=crossed.lines.filter(line=>line.axis==='h');
assert.notEqual(rails[0].fixed,rails[1].fixed,'Overlapping sibling groups need separate horizontal lanes');
assert.equal(crossed.bridges.length,1,'A residual crossing is drawn as one bridge');
assert.equal(crossed.cuts.size,2,'Both crossing segments receive a local gap');
assert.equal(crossed.lines.filter(line=>line.id.includes(':child-')).length,4,'Every child stays connected to its family');
assert.ok(crossed.lines.every(line=>/ [HV] /.test(line.d)));

const skip={width:700,connections:[],positions:new Map([['root',{x:32,y:48}],['other',{x:32,y:244}],['child',{x:32,y:440}]]),routes:[{key:'skip',origin:{x:118,y:155.5},parents:['root'],children:[{id:'child',x:118,y:440.5}]}]};
const detour=routeLanes(skip).lines.find(line=>line.id==='skip:feed');
assert.ok(detour.fixed<=32-8||detour.fixed>=32+NODE_WIDTH+8,'A link spanning generations must avoid intermediate cards');
console.log('Carriles rectos, puentes locales y conexiones completas a las fichas comprobados.');
