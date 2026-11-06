export type Person = { id:string; name:string; surname:string; gender:string; birth:string; deceased:boolean; death:string; place:string; note:string; parents:string[]; partners:string[] };
export type Family = { title:string; people:Person[] };
export function todayISO() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Atlantic/Canary',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export function age(p:Pick<Person,'birth'|'death'|'deceased'>, today=todayISO()):number|null {
  if(!p.birth || (p.deceased&&!p.death)) return null;
  const end=p.deceased?p.death:today;
  const [y,m,d]=p.birth.split('-').map(Number),[ey,em,ed]=end.split('-').map(Number);
  return ey-y-(em<m || (em===m&&ed<d)?1:0);
}
export const initials=(p:Person)=>((p.name[0]||'')+(p.surname[0]||'')).toUpperCase();
export function validDate(s:string) { const d=new Date(s+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number(s.slice(0,4))>0&&!Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s; }
export function validateFamily(input:unknown, today=todayISO()): asserts input is Family {
  const f=input as Family;
  if(!f||typeof f.title!=='string'||!f.title.trim()||f.title.length>100||!Array.isArray(f.people)||f.people.length>1000) throw new Error('El archivo no contiene un árbol válido (máximo 1.000 personas).');
  const ids=new Set<string>();
  for(const p of f.people) {
    if(!p||typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)) throw new Error('Cada persona debe tener un identificador único.');
    ids.add(p.id);
    for(const k of ['name','surname','gender','birth','death','place','note'] as const) if(typeof p[k]!=='string'||p[k].length>(k==='note'?10000:200)) throw new Error('Hay un campo de persona no válido.');
    if(!p.name.trim()||!p.surname.trim()) throw new Error('Escribe el nombre y los apellidos.');
    if(!['Mujer','Hombre','No binario','Otro','Sin especificar'].includes(p.gender)||typeof p.deceased!=='boolean') throw new Error('Revisa el género y el estado de la persona.');
    if((p.birth&&(!validDate(p.birth)||p.birth>today))||(p.death&&(!validDate(p.death)||p.death>today))) throw new Error('Las fechas deben ser válidas y no pueden estar en el futuro.');
    if(p.death&&!p.deceased) throw new Error('Una persona con fecha de defunción debe marcarse como fallecida.');
    if(p.death&&p.birth&&p.death<p.birth) throw new Error('La fecha de defunción no puede ser anterior al nacimiento.');
    for(const k of ['parents','partners'] as const) if(!Array.isArray(p[k])||p[k].some(v=>typeof v!=='string')||new Set(p[k]).size!==p[k].length) throw new Error('Hay relaciones duplicadas o no válidas.');
  }
  const map=new Map(f.people.map(p=>[p.id,p]));
  for(const p of f.people) {
    for(const id of [...p.parents,...p.partners]) if(id===p.id||!ids.has(id)) throw new Error('Una relación apunta a una persona no válida.');
    for(const id of p.parents) {const a=map.get(id)!; if(a.birth&&p.birth&&a.birth>=p.birth) throw new Error('Un progenitor debe haber nacido antes que su descendiente.');}
    for(const id of p.partners) if(!map.get(id)!.partners.includes(p.id)) throw new Error('La relación de pareja debe ser recíproca.');
  }
  const visiting=new Set<string>(),done=new Set<string>();
  function visit(id:string) {if(visiting.has(id)) throw new Error('Esta relación crearía un ciclo de ascendencia.');if(done.has(id))return;visiting.add(id);map.get(id)!.parents.forEach(visit);visiting.delete(id);done.add(id);}
  f.people.forEach(p=>visit(p.id));
}

export const NODE_WIDTH=172, NODE_HEIGHT=108, COLUMN_STEP=216, GENERATION_STEP=220;
function generationGroups(people:Person[]){
 const roots=new Map(people.map(p=>[p.id,p.id]));
 function root(id:string):string{const parent=roots.get(id)!;if(parent===id)return id;const result=root(parent);roots.set(id,result);return result;}
 function unite(a:string,b:string){if(roots.has(a)&&roots.has(b))roots.set(root(b),root(a));}
 for(const p of people){p.partners.forEach(id=>unite(p.id,id));for(let i=1;i<p.parents.length;i++)unite(p.parents[0],p.parents[i]);}
 const members=new Map<string,Person[]>();for(const p of people){const id=root(p.id);members.set(id,[...(members.get(id)??[]),p]);}
 const parents=new Map([...members.keys()].map(id=>[id,new Set<string>()]));
 const children=new Map([...members.keys()].map(id=>[id,new Set<string>()]));
 let hierarchyError=false;
 for(const p of people)for(const id of p.parents){const a=root(id),b=root(p.id);if(a===b){hierarchyError=true;continue;}parents.get(b)!.add(a);children.get(a)!.add(b);}
 const indegrees=new Map([...parents].map(([id,ps])=>[id,ps.size]));const queue=[...members.keys()].filter(id=>!indegrees.get(id));const longest=new Map([...members.keys()].map(id=>[id,0]));
 for(let i=0;i<queue.length;i++){const id=queue[i];for(const child of children.get(id)!){longest.set(child,Math.max(longest.get(child)!,longest.get(id)!+1));indegrees.set(child,indegrees.get(child)!-1);if(!indegrees.get(child))queue.push(child);}}
 if(queue.length!==members.size)hierarchyError=true;
 const levels=new Map<string,number>();
 for(const start of members.keys()){
  if(levels.has(start))continue;const component=[start],values=new Map([[start,0]]);let exact=true;
  for(let i=0;i<component.length;i++){const id=component[i],value=values.get(id)!;const neighbours=[...[...children.get(id)!].map(next=>({next,level:value+1})),...[...parents.get(id)!].map(next=>({next,level:value-1}))];for(const n of neighbours){if(values.has(n.next)){if(values.get(n.next)!==n.level)exact=false;}else{values.set(n.next,n.level);component.push(n.next);}}}
  const min=Math.min(...values.values());for(const id of component)levels.set(id,exact?values.get(id)!-min:longest.get(id)!);
 }
 return {members,groupOf:root,levels,parents,children,hierarchyError};
}
export function assertHierarchy(people:Person[]){if(generationGroups(people).hierarchyError)throw new Error('Este vínculo mezcla generaciones incompatibles. Una persona no puede ser pareja de su propio ascendiente o descendiente. Revisa los vínculos familiares.');}
export function isAncestor(people:Person[],ancestorId:string,descendantId:string){
 const map=new Map(people.map(p=>[p.id,p]));const pending=[...(map.get(descendantId)?.parents??[])],seen=new Set<string>();
 while(pending.length){const id=pending.pop()!;if(id===ancestorId)return true;if(seen.has(id))continue;seen.add(id);pending.push(...(map.get(id)?.parents??[]));}return false;
}
const searchKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export function searchRelatives(people:Person[],query:string,exclude:string[]=[],limit=8){
 const key=searchKey(query),blocked=new Set(exclude);if(key.length<2)return {matches:[] as Person[],total:0};
 const matches=people.filter(p=>!blocked.has(p.id)&&searchKey(p.name+' '+p.surname).includes(key));return {matches:matches.slice(0,limit),total:matches.length};
}
export type TreeConnection={id:string;kind:'family'|'couple';d:string};
export function layout(people:Person[]){
 const g=generationGroups(people);const rowGroups=new Map<number,string[]>();for(const id of g.members.keys()){const level=g.levels.get(id)!;rowGroups.set(level,[...(rowGroups.get(level)??[]),id]);}
 const width=Math.max(256,...[...rowGroups.values()].map(ids=>ids.reduce((n,id)=>n+g.members.get(id)!.length*COLUMN_STEP,0)+64));
 const positions=new Map<string,{x:number;y:number}>(),centers=new Map<string,number>();
 const orderedRows=[...rowGroups].sort((a,b)=>a[0]-b[0]);
 for(const [level,ids] of orderedRows){
  const order=(id:string)=>{const ps=[...g.parents.get(id)!].filter(p=>centers.has(p));return ps.length?ps.reduce((sum,p)=>sum+centers.get(p)!,0)/ps.length:Infinity;};ids.sort((a,b)=>order(a)-order(b));
  const rowWidth=ids.reduce((n,id)=>n+g.members.get(id)!.length*COLUMN_STEP,0);let cursor=(width-rowWidth)/2;
  for(const id of ids){const members=g.members.get(id)!;const remaining=new Set(members.map(p=>p.id)),ordered:Person[]=[];while(remaining.size){let next=members.find(p=>remaining.has(p.id)&&ordered.at(-1)?.partners.includes(p.id));next??=members.find(p=>remaining.has(p.id));remaining.delete(next!.id);ordered.push(next!);}for(let j=0;j<ordered.length;j++)positions.set(ordered[j].id,{x:cursor+j*COLUMN_STEP+(COLUMN_STEP-NODE_WIDTH)/2,y:48+level*GENERATION_STEP});centers.set(id,cursor+members.length*COLUMN_STEP/2);cursor+=members.length*COLUMN_STEP;}
 }
 const connections:TreeConnection[]=[];const usedCouples=new Set<string>();
 const brace=(left:number,right:number,y:number,direction:number)=>{const mid=(left+right)/2;return 'M '+left+' '+y+' C '+left+' '+(y+22*direction)+' '+(mid-16)+' '+(y+5*direction)+' '+mid+' '+(y+30*direction)+' C '+(mid+16)+' '+(y+5*direction)+' '+right+' '+(y+22*direction)+' '+right+' '+y;};
 const childFamilies=new Map<string,{parents:string[];children:Person[]}>();
 for(const p of people){if(!p.parents.length)continue;const parents=[...p.parents].sort();const y=positions.get(p.id)!.y;const key=parents.join('|')+'@'+y;const family=childFamilies.get(key)??{parents,children:[]};family.children.push(p);childFamilies.set(key,family);}
 for(const [key,family] of childFamilies){
  const ps=family.parents.map(id=>positions.get(id)!),kids=family.children.map(p=>positions.get(p.id)!).sort((a,b)=>a.x-b.x);
  const left=Math.min(...ps.map(p=>p.x+NODE_WIDTH/2)),right=Math.max(...ps.map(p=>p.x+NODE_WIDTH/2)),parentY=Math.max(...ps.map(p=>p.y))+NODE_HEIGHT;
  let startX=(left+right)/2,startY=parentY;
  if(ps.length>1){connections.push({id:'parents-'+key,kind:'family',d:brace(left,right,parentY+7,1)});startY=parentY+37;if(family.parents.length===2)usedCouples.add(family.parents.join('|'));}
  const childY=kids[0].y,leftKid=kids[0].x+NODE_WIDTH/2,rightKid=kids.at(-1)!.x+NODE_WIDTH/2,endX=(leftKid+rightKid)/2,endY=kids.length>1?childY-30:childY;
  const midY=(startY+endY)/2;connections.push({id:'stem-'+key,kind:'family',d:'M '+startX+' '+startY+' C '+(startX+5)+' '+midY+' '+(endX-5)+' '+midY+' '+endX+' '+endY});
  if(kids.length>1){connections.push({id:'children-'+key,kind:'family',d:brace(leftKid,rightKid,childY,-1)});
   for(const kid of kids.slice(1,-1)){
    const x=kid.x+NODE_WIDTH/2,mid=(leftKid+rightKid)/2;const control=x<=mid?[leftKid,leftKid,mid-16,mid]:[mid,mid+16,rightKid,rightKid];const ys=x<=mid?[childY,childY-22,childY-5,childY-30]:[childY-30,childY-5,childY-22,childY];
    const cubic=(a:number[],t:number)=>a[0]*(1-t)**3+3*a[1]*(1-t)**2*t+3*a[2]*(1-t)*t*t+a[3]*t**3;let low=0,high=1;for(let i=0;i<24;i++){const t=(low+high)/2;if(cubic(control,t)<x)low=t;else high=t;}const y=cubic(ys,(low+high)/2);connections.push({id:'child-'+key+'-'+x,kind:'family',d:'M '+x+' '+y+' C '+(x-3)+' '+(y+10)+' '+(x+3)+' '+(childY-10)+' '+x+' '+childY});
   }
  }
 }
 for(const p of people)for(const id of p.partners){const key=[p.id,id].sort().join('|');if(usedCouples.has(key))continue;usedCouples.add(key);const a=positions.get(p.id)!,b=positions.get(id)!;connections.push({id:'couple-'+key,kind:'couple',d:brace(Math.min(a.x,b.x)+NODE_WIDTH/2,Math.max(a.x,b.x)+NODE_WIDTH/2,Math.max(a.y,b.y)+NODE_HEIGHT+7,1)});}
 const generations=people.length?Math.max(...g.levels.values())+1:0;
 return {positions,connections,width,height:Math.max(220,generations*GENERATION_STEP+48),generations,hierarchyError:g.hierarchyError};
}
export const demo:Family={title:'Familia García',people:[
  {id:'1',name:'Antonio',surname:'García López',gender:'Hombre',birth:'1932-04-16',deceased:true,death:'2016-08-21',place:'Granada, España',note:'Siempre tenía una historia que contar y tiempo para escuchar. Su jardín era el punto de encuentro de toda la familia.',parents:[],partners:['2']},
  {id:'2',name:'Carmen',surname:'Ruiz Martín',gender:'Mujer',birth:'1936-09-02',deceased:false,death:'',place:'Granada, España',note:'La memoria de nuestra familia. Sus recetas y sus historias han pasado de generación en generación.',parents:[],partners:['1']},
  {id:'3',name:'Manuel',surname:'Moreno Díaz',gender:'Hombre',birth:'1934-02-08',deceased:true,death:'2020-01-12',place:'Córdoba, España',note:'Amante de los libros y de los paseos al atardecer.',parents:[],partners:['4']},
  {id:'4',name:'Isabel',surname:'Romero Vega',gender:'Mujer',birth:'1938-07-22',deceased:false,death:'',place:'Córdoba, España',note:'Su casa siempre ha sido un lugar al que volver.',parents:[],partners:['3']},
  {id:'5',name:'Javier',surname:'García Ruiz',gender:'Hombre',birth:'1964-03-12',deceased:false,death:'',place:'Granada, España',note:'Nos enseñó a disfrutar de las pequeñas cosas.',parents:['1','2'],partners:['6']},
  {id:'6',name:'Lucía',surname:'Moreno Romero',gender:'Mujer',birth:'1967-11-19',deceased:false,death:'',place:'Córdoba, España',note:'El corazón de cada reunión familiar.',parents:['3','4'],partners:['5']},
  {id:'7',name:'Elena',surname:'García Moreno',gender:'Mujer',birth:'1993-05-24',deceased:false,death:'',place:'Madrid, España',note:'Me gusta pensar que somos un poco de todas las personas que nos precedieron. Este árbol es mi manera de guardar sus historias.',parents:['5','6'],partners:[]},
  {id:'8',name:'Pablo',surname:'García Moreno',gender:'Hombre',birth:'1996-08-10',deceased:false,death:'',place:'Madrid, España',note:'Siempre encuentra una excusa para reunirnos.',parents:['5','6'],partners:[]}
]};

