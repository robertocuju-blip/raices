import assert from 'node:assert/strict';
import {layout,demo,NODE_WIDTH,NODE_HEIGHT} from './lib/family.ts';
const p=(id,parents=[],partners=[])=>({id,name:id,surname:'Prueba',gender:'Hombre',birth:'',death:'',deceased:false,place:'',note:'',parents,partners});
const endpoints=d=>{const n=d.match(/-?\d+(?:\.\d+)?/g).map(Number);return [{x:n[0],y:n[1]},d.includes(' H ')?{x:n.at(-1),y:n[1]}:{x:n.at(-2),y:n.at(-1)}];};
const near=(a,b)=>Math.abs(a.x-b.x)<=.6&&Math.abs(a.y-b.y)<=.6;
function check(people){
 const g=layout(people);const ends=g.connections.flatMap(c=>endpoints(c.d));
 for(const person of people){const box=g.positions.get(person.id);if(person.parents.length)assert.ok(ends.some(e=>near(e,{x:box.x+NODE_WIDTH/2,y:box.y})),person.id+' must touch its parent branch at its top edge');
  for(const id of person.partners){const line=g.connections.find(c=>c.id==='couple-'+[person.id,id].sort().join('|'));assert.ok(line);assert.match(line.d,/^M [-\d.]+ [-\d.]+ H [-\d.]+$/);const [a,b]=endpoints(line.d);const partner=g.positions.get(id);const left=box.x<partner.x?box:partner,right=box.x<partner.x?partner:box;assert.ok(near(a,{x:left.x+NODE_WIDTH,y:left.y+NODE_HEIGHT/2}));assert.ok(near(b,{x:right.x,y:right.y+NODE_HEIGHT/2}));}
 }
 for(const stem of g.connections.filter(c=>c.id.startsWith('stem-'))){const [a,b]=endpoints(stem.d);const onBox=[...g.positions.values()].some(box=>near(a,{x:box.x+NODE_WIDTH/2,y:box.y+NODE_HEIGHT}));const onUnion=g.junctions.some(j=>near(a,j));assert.ok(onBox||onUnion,'Every descent must start at a box or its couple union');const brace=g.connections.find(c=>c.id==='children-'+stem.id.slice(5));if(brace){const n=brace.d.match(/-?\d+(?:\.\d+)?/g).map(Number);assert.ok(near(b,{x:n[6],y:n[7]}),'The family trunk must meet the brace');}}
 for(const j of g.junctions){assert.ok(![...g.positions.values()].some(box=>j.x>box.x&&j.x<box.x+NODE_WIDTH&&j.y>box.y&&j.y<box.y+NODE_HEIGHT),'Couple junctions must remain in the gap between cards');}
}
check(demo.people);
check([p('a'),p('child',['a'])]);
check([p('a'),p('b'),...['x','y','z','w','v'].map(id=>p(id,['a','b']))]);
check([p('a',[],['b','c']),p('b',[],['a']),p('c',[],['a']),p('kid1',['a','b']),p('kid2',['a','c'])]);
const large=[];for(let i=0;i<100;i++)large.push(p('a'+i,[],['b'+i]),p('b'+i,[],['a'+i]),p('c'+i,['a'+i,'b'+i]));check(large);
console.log('Conexiones comprobadas: parejas rectas entre bordes, ramas hasta las cajas y uniones sin huecos, incluidos 300 familiares.');
