import assert from 'node:assert/strict';
import {layout,assertHierarchy,validateFamily,isAncestor,searchRelatives,GENERATION_STEP} from './lib/family.ts';
const p=(id,gender='Hombre',parents=[],partners=[])=>({id,name:'Persona '+id,surname:'Familia',gender,birth:'',deceased:false,death:'',place:'',note:'',parents,partners});
const people=[p('g','Hombre',[],['gm']),p('gm','Mujer',[],['g']),p('f','Hombre',['g','gm'],['m']),p('m','Mujer',[],['f']),p('c','Mujer',['f','m'])];
validateFamily({title:'Fechas desconocidas',people});assertHierarchy(people);
let graph=layout(people);const y=id=>graph.positions.get(id).y;
assert.equal(y('g'),y('gm'));assert.equal(y('f'),y('m'));assert.equal(y('f')-y('g'),GENERATION_STEP);assert.equal(y('c')-y('m'),GENERATION_STEP);
const extended=[...people,p('s','Hombre',['s1'],['c']),p('s1','Mujer')].map(x=>x.id==='c'?{...x,partners:['s']}:x);validateFamily({title:'Ramas desiguales',people:extended});graph=layout(extended);assert.equal(graph.positions.get('c').y,graph.positions.get('s').y);assert.equal(graph.positions.get('s').y-graph.positions.get('s1').y,GENERATION_STEP);
const siblings=[p('a','Hombre',[],['b']),p('b','Mujer',[],['a']),...['x','y','z'].map(id=>p(id,'Mujer',['a','b']))];graph=layout(siblings);assert.equal(graph.connections.filter(c=>c.id.startsWith('children-')).length,1);assert.equal(graph.connections.filter(c=>c.id.startsWith('child-')).length,1);assert.ok(graph.connections.every(c=>c.d.includes(' C ')));
const coparents=[p('a'),p('b','Mujer'),p('c','Mujer',['a','b'])];graph=layout(coparents);assert.equal(graph.positions.get('a').y,graph.positions.get('b').y);
assert.equal(isAncestor(people,'g','c'),true);assert.equal(isAncestor(people,'c','g'),false);
const impossible=people.map(x=>x.id==='g'?{...x,partners:['gm','c']}:x.id==='c'?{...x,partners:['g']}:x);assert.throws(()=>assertHierarchy(impossible),/generaciones incompatibles/);
const large=[];for(let i=0;i<100;i++){large.push(p('a'+i,'Hombre',[],['b'+i]),p('b'+i,'Mujer',[],['a'+i]),p('c'+i,'Mujer',['a'+i,'b'+i]));}
const start=performance.now();graph=layout(large);const elapsed=performance.now()-start;assert.equal(graph.positions.size,300);for(const person of large){for(const partner of person.partners)assert.equal(graph.positions.get(person.id).y,graph.positions.get(partner).y);for(const parent of person.parents)assert.equal(graph.positions.get(person.id).y-graph.positions.get(parent).y,GENERATION_STEP);}
for(const [id,a] of graph.positions)for(const [other,b] of graph.positions)if(id!==other&&a.y===b.y)assert.ok(Math.abs(a.x-b.x)>=172);
const results=searchRelatives(large,'Familia');assert.equal(results.total,300);assert.equal(results.matches.length,8);assert.equal(searchRelatives(large,'F').matches.length,0);assert.equal(searchRelatives([{...p('l'),name:'Lucía',surname:'Muñoz'}],'lucia').matches.length,1);assert.equal(searchRelatives(large,'Familia',['a0']).total,299);
const unknown={title:'Sin nacimiento',people:[{...p('d','Mujer'),deceased:true,death:'2020-01-01'}]};validateFamily(unknown);assert.equal(layout(unknown.people).positions.size,1);
console.log('Jerarquía, parejas, fechas desconocidas, llaves y búsqueda comprobadas. Árbol de 300 personas: '+elapsed.toFixed(1)+' ms.');
