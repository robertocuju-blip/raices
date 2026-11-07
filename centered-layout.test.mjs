import assert from 'node:assert/strict';
import {layout,demo,NODE_WIDTH} from './lib/family.ts';
const p=(id,parents=[],partners=[])=>({id,name:id,surname:'Prueba',gender:'Hombre',birth:'',death:'',deceased:false,place:'',note:'',parents,partners});
function verify(people){const graph=layout(people);const families=new Map();for(const person of people)if(person.parents.length){const key=person.parents.slice().sort().join('|');const f=families.get(key)??{parents:person.parents,children:[]};f.children.push(person.id);families.set(key,f);}for(const f of families.values()){const px=f.parents.map(id=>graph.positions.get(id).x+NODE_WIDTH/2),cx=f.children.map(id=>graph.positions.get(id).x+NODE_WIDTH/2);assert.ok(Math.abs((Math.min(...px)+Math.max(...px))/2-(Math.min(...cx)+Math.max(...cx))/2)<.1,'Children must be centred under their own parents: '+f.parents);}
 const rows=new Map();for(const [id,pos] of graph.positions){const row=rows.get(pos.y)??[];row.push({...pos,id});rows.set(pos.y,row);}for(const row of rows.values()){row.sort((a,b)=>a.x-b.x);for(let i=1;i<row.length;i++)assert.ok(row[i].x-row[i-1].x>=NODE_WIDTH+30,'Family cards must not overlap');}
 // With a centred trunk the descents no longer drift sideways across other families.
 for(const connection of graph.connections.filter(c=>c.id.startsWith('stem-'))){const n=connection.d.match(/-?\d+(?:\.\d+)?/g).map(Number);assert.ok(Math.abs(n[0]-n.at(-2))<.1,'Family trunk must be vertical');}return graph;}
verify(demo.people);
verify([...demo.people,p('extra',['1','2'])]);
const complex=[p('a',[],['b']),p('b',[],['a']),p('c',['a','b'],['d']),p('d',['e','f'],['c']),p('e',[],['f']),p('f',[],['e']),p('x',['c','d']),p('y',['c','d']),p('sibling',['a','b']),p('grandchild',['x'])];verify(complex);
const large=[];for(let i=0;i<100;i++)large.push(p('a'+i,[],['b'+i]),p('b'+i,[],['a'+i]),p('c'+i,['a'+i,'b'+i]));verify(large);
const branches=[p('root-a',[],['root-b']),p('root-b',[],['root-a'])];for(let i=0;i<3;i++){branches.push(p('parent-'+i,['root-a','root-b'],['spouse-'+i]),p('spouse-'+i,[],['parent-'+i]));for(let j=0;j<[1,6,2][i];j++)branches.push(p('kid-'+i+'-'+j,['parent-'+i,'spouse-'+i]));}const grouped=verify(branches);const intervals=[0,1,2].map(i=>{const x=branches.filter(p=>p.id.startsWith('kid-'+i+'-')).map(p=>grouped.positions.get(p.id).x);return {left:Math.min(...x),right:Math.max(...x)+NODE_WIDTH};}).sort((a,b)=>a.left-b.left);for(let i=1;i<intervals.length;i++)assert.ok(intervals[i].left>intervals[i-1].right,'Descendant branches must occupy disjoint blocks');
assert.ok(grouped.width<1975,'Asymmetric sibling families must not reserve excess ancestral margins');
assert.ok(grouped.height<650,'Generations should use compact vertical spacing');
console.log('Centrado por familia, anchura compacta, troncos verticales y separación de ramas comprobados, incluidos 300 familiares.');
