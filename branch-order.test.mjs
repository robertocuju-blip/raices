import assert from 'node:assert/strict';
import {layout,COLUMN_STEP,NODE_WIDTH} from './lib/family.ts';

function points(path){
 const n=path.match(/-?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi).map(Number);
 const result=[[n[0],n[1]]];
 if(path.includes(' H '))return [...result,[n[2],n[1]]];
 for(let i=2;i<n.length;i+=6){
  const [x,y]=result.at(-1),[a,b,c,d,e,f]=n.slice(i,i+6);
  for(let j=1;j<=24;j++){const t=j/24,s=1-t;result.push([s**3*x+3*s*s*t*a+3*s*t*t*c+t**3*e,s**3*y+3*s*s*t*b+3*s*t*t*d+t**3*f]);}
 }
 return result;
}
export function crossingPairs(graph){
 const lines=graph.connections.map(line=>points(line.d));
 const familyKeys=graph.connections.map(line=>line.id.match(/^(?:stem|children|child)-(.+@\d+)/)?.[1]);
 const sign=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const cross=(a,b,c,d)=>sign(a,b,c)*sign(a,b,d)<-1e-7&&sign(c,d,a)*sign(c,d,b)<-1e-7;
 const pairs=[];
 for(let i=0;i<lines.length;i++)for(let j=0;j<i;j++){
  if(familyKeys[i]&&familyKeys[i]===familyKeys[j])continue;
  const a=lines[i],b=lines[j];let found=false;
  for(let k=1;k<a.length&&!found;k++)for(let l=1;l<b.length;l++)if(cross(a[k-1],a[k],b[l-1],b[l])){found=true;break;}
  if(found)pairs.push([graph.connections[i].id,graph.connections[j].id]);
 }
 return pairs;
}
const p=(id,gender,parents=[],partners=[])=>({id,name:id,surname:'Ejemplo',gender,birth:'',death:'',deceased:false,place:'',note:'',parents,partners});
const people=[p('abuela','Mujer',['mayor-a','mayor-b'],['abuelo']),p('abuelo','Hombre',[],['abuela']),p('materna','Mujer',['abuelo','abuela'],['materno']),p('materno','Hombre',[],['materna']),p('tio','Hombre',['abuelo','abuela'],['tia']),p('tia','Mujer',[],['tio']),p('prima','Mujer',['tio','tia']),p('madre','Mujer',['materno','materna'],['padre']),p('tia-m','Mujer',['materno','materna']),p('paterno','Hombre',[],['paterna']),p('paterna','Mujer',[],['paterno']),p('padre','Hombre',['paterno','paterna'],['madre']),p('tio-p','Hombre',['paterno','paterna']),p('hija','Mujer',['padre','madre']),p('mayor-a','Hombre',[],['mayor-b']),p('mayor-b','Mujer',[],['mayor-a']),p('hermana-abuela','Mujer',['mayor-a','mayor-b'])];
const graph=layout(people);
assert.deepEqual(crossingPairs(graph),[],'A union between two ancestral branches must not cross adjacent families');
for(const woman of people.filter(person=>person.gender==='Mujer'))for(const id of woman.partners){
 assert.ok(graph.positions.get(id).x<graph.positions.get(woman.id).x,'Men must be on the left in each mixed-gender couple');
 assert.ok(graph.positions.get(woman.id).x-graph.positions.get(id).x<=COLUMN_STEP*2+.1,'Couples should stay close');
}
assert.ok(graph.centeringError<.1);

// Add another partner's ancestry one generation after the first union.
// Resolving the second union used to discard the ordering of the first one.
const growing=[
 p('mat','Hombre',['earlier','earlier-f'],['mat-f']),p('mat-f','Mujer',[],['mat']),
 p('relative-m','Hombre',['mat','mat-f'],['relative-f']),p('relative-f','Mujer',[],['relative-m']),p('cousin','Mujer',['relative-m','relative-f']),
 p('pat','Hombre',[],['pat-f']),p('pat-f','Mujer',[],['pat']),
 p('father','Hombre',['pat','pat-f'],['mother']),p('mother','Mujer',['mat','mat-f'],['father']),
 p('outside-m','Hombre',[],['outside-f']),p('outside-f','Mujer',['pat','pat-f'],['outside-m']),p('other-cousin','Hombre',['outside-m','outside-f']),
 p('child','Hombre',['father','mother'],['partner']),p('partner','Mujer',['incoming','incoming-f'],['child']),
 p('sister','Mujer',['father','mother']),p('brother','Hombre',['father','mother']),p('grandchild','Mujer',['child','partner']),
 p('earlier','Hombre',[],['earlier-f']),p('earlier-f','Mujer',[],['earlier']),
 p('incoming','Hombre',[],['incoming-f']),p('incoming-f','Mujer',[],['incoming']),p('partner-sibling','Hombre',['incoming','incoming-f'])
];
const separateIds=new Set(['incoming','incoming-f','partner-sibling']);
const separate=growing.map(person=>person.id==='partner'?{...person,parents:[]}:person);
const twoTrees=layout(separate),connected=layout(growing);
const leftEdge=Math.min(...[...separateIds].map(id=>twoTrees.positions.get(id).x));
const rightEdge=Math.max(...separate.filter(person=>!separateIds.has(person.id)).map(person=>twoTrees.positions.get(person.id).x+NODE_WIDTH));
assert.ok(leftEdge-rightEdge>=64-.01,'Unconnected lineages must not interleave');
assert.deepEqual(crossingPairs(twoTrees),[]);
assert.deepEqual(crossingPairs(connected),[],'Adding a second ancestral branch must preserve the earlier uncrossed layout');
assert.equal(connected.positions.size,growing.length,'The full tree always keeps every person');
console.log('Árbol completo: ramas independientes separadas, uniones sucesivas sin cruces, parejas juntas y en orden.');
