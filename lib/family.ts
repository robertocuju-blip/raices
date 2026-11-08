import {compactLayout} from './compact-layout.ts';
import {orderFamilyRows} from './branch-order.ts';

export const UNCERTAIN_FIELDS=['name','surname','gender','birth','death'] as const;
export type UncertainField=typeof UNCERTAIN_FIELDS[number];
export type Person = { id:string; name:string; surname:string; gender:string; birth:string; deceased:boolean; death:string; place:string; note:string; parents:string[]; partners:string[]; uncertain?:UncertainField[] };
export type Family = { title:string; people:Person[] };
export function todayISO() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Atlantic/Canary',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export const isYear=(value:string)=>/^\d{4}$/.test(value);
export const dateStart=(value:string)=>isYear(value)?value+'-01-01':value;
const dateEnd=(value:string)=>isYear(value)?value+'-12-31':value;
const recordedDate=(value:string)=>isYear(value)?Number(value)>0:validDate(value);
export function dateLabel(value:string){
 if(!value)return '¿?';
 if(isYear(value))return `??/??/${value}`;
 const [year,month,day]=value.split('-');
 return `${day}/${month}/${year}`;
}
function ageOn(birth:string,end:string){
  const [y,m,d]=birth.split('-').map(Number),[ey,em,ed]=end.split('-').map(Number);
  return ey-y-(em<m || (em===m&&ed<d)?1:0);
}
export function ageRange(p:Pick<Person,'birth'|'death'|'deceased'>,today=todayISO()){
  const end=p.deceased?p.death:today;
  if(!recordedDate(p.birth)||!recordedDate(end))return null;
  const earliestBirth=dateStart(p.birth),latestEnd=dateEnd(end)<today?dateEnd(end):today;
  if(earliestBirth>latestEnd||dateStart(end)>today)return null;
  return {min:Math.max(0,ageOn(dateEnd(p.birth),dateStart(end))),max:ageOn(earliestBirth,latestEnd)};
}
export function age(p:Pick<Person,'birth'|'death'|'deceased'>,today=todayISO()):number|null {
  const range=ageRange(p,today);return range&&range.min===range.max?range.min:null;
}
export const initials=(p:Person)=>((p.name.trim()[0]||'')+(p.surname.trim()[0]||'')).toUpperCase()||'?';
export const isUncertain=(p:Person,field:UncertainField)=>p.uncertain?.includes(field)??false;
export const markedValue=(p:Person,field:UncertainField,value=p[field])=>!value.trim()?'¿?':value+(isUncertain(p,field)&&value!=='¿?'?'?':'');
export function validDate(s:string) { const d=new Date(s+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number(s.slice(0,4))>0&&!Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s; }
export function validateFamily(input:unknown, today=todayISO()): asserts input is Family {
  const f=input as Family;
  if(!f||typeof f.title!=='string'||!f.title.trim()||f.title.length>100||!Array.isArray(f.people)||f.people.length>1000) throw new Error('El archivo no contiene un árbol válido (máximo 1.000 personas).');
  const ids=new Set<string>();
  for(const p of f.people) {
    if(!p||typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)) throw new Error('Cada persona debe tener un identificador único.');
    ids.add(p.id);
    for(const k of ['name','surname','gender','birth','death','place','note'] as const) if(typeof p[k]!=='string'||p[k].length>(k==='note'?10000:200)) throw new Error('Hay un campo de persona no válido.');
    if(p.uncertain!==undefined&&(!Array.isArray(p.uncertain)||p.uncertain.some(field=>!UNCERTAIN_FIELDS.includes(field))||new Set(p.uncertain).size!==p.uncertain.length))throw new Error('Hay marcas de duda no válidas.');
    if(!['Mujer','Hombre','No binario','Otro','Sin especificar'].includes(p.gender)||typeof p.deceased!=='boolean') throw new Error('Revisa el género y el estado de la persona.');
    if((p.birth&&(!recordedDate(p.birth)||dateStart(p.birth)>today))||(p.death&&(!recordedDate(p.death)||dateStart(p.death)>today))) throw new Error('Las fechas deben ser válidas y no pueden estar en el futuro.');
    if(p.death&&!p.deceased) throw new Error('Una persona con fecha de defunción debe marcarse como fallecida.');
    if(p.death&&p.birth&&dateEnd(p.death)<dateStart(p.birth)) throw new Error('La fecha de defunción no puede ser anterior al nacimiento.');
    for(const k of ['parents','partners'] as const) if(!Array.isArray(p[k])||p[k].some(v=>typeof v!=='string')||new Set(p[k]).size!==p[k].length) throw new Error('Hay relaciones duplicadas o no válidas.');
  }
  const map=new Map(f.people.map(p=>[p.id,p]));
  for(const p of f.people) {
    for(const id of [...p.parents,...p.partners]) if(id===p.id||!ids.has(id)) throw new Error('Una relación apunta a una persona no válida.');
    for(const id of p.parents) {const a=map.get(id)!; if(a.birth&&p.birth&&dateStart(a.birth)>=dateEnd(p.birth)) throw new Error('Un progenitor debe haber nacido antes que su descendiente.');}
    for(const id of p.partners) if(!map.get(id)!.partners.includes(p.id)) throw new Error('La relación de pareja debe ser recíproca.');
  }
  const visiting=new Set<string>(),done=new Set<string>();
  function visit(id:string) {if(visiting.has(id)) throw new Error('Esta relación crearía un ciclo de ascendencia.');if(done.has(id))return;visiting.add(id);map.get(id)!.parents.forEach(visit);visiting.delete(id);done.add(id);}
  f.people.forEach(p=>visit(p.id));
}

export const NODE_WIDTH=172, NODE_HEIGHT=108, COLUMN_STEP=204, GENERATION_STEP=196;
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
 const matches=people.filter(p=>!blocked.has(p.id)&&searchKey((p.name.trim()||'Sin nombre')+' '+(p.surname.trim()||'Sin apellidos')).includes(key));return {matches:matches.slice(0,limit),total:matches.length};
}
export type TreeConnection={id:string;kind:'family'|'couple';d:string;familyKey?:string;people?:string[]};
export type FamilyRoute={key:string;origin:{x:number;y:number};parents:string[];children:{id:string;x:number;y:number}[]};
export function layout(people:Person[]){
 const links=new Map(people.map(p=>[p.id,new Set([...p.parents,...p.partners])]));
 for(const [id,neighbours] of links)for(const other of neighbours)links.get(other)?.add(id);
 const componentOf=new Map<string,number>(),components:Person[][]=[];
 for(const person of people){
  if(componentOf.has(person.id))continue;
  const index=components.length,queue=[person.id];components.push([]);componentOf.set(person.id,index);
  for(let i=0;i<queue.length;i++)for(const next of links.get(queue[i])??[]){
   if(!links.has(next)||componentOf.has(next))continue;componentOf.set(next,index);queue.push(next);
  }
 }
 if(components.length<=1)return layoutComponent(people);
 // Keep unrelated family lines in separate horizontal areas. They still
 // share one canvas, and joining them through a new relationship recombines them.
 for(const person of people)components[componentOf.get(person.id)!].push(person);
 const result=layoutComponent(components[0]);
 for(const component of components.slice(1)){
  const next=layoutComponent(component,result.width);
  for(const [id,pos] of next.positions)result.positions.set(id,pos);
  result.connections.push(...next.connections);result.junctions.push(...next.junctions);result.routes.push(...next.routes);
  result.width+=next.width;result.height=Math.max(result.height,next.height);result.generations=Math.max(result.generations,next.generations);
  result.centeringError=Math.max(result.centeringError,next.centeringError);result.hierarchyError||=next.hierarchyError;
 }
 return result;
}

function layoutComponent(people:Person[],offsetX=0){

 const g=generationGroups(people),byId=new Map(people.map(p=>[p.id,p]));
 const rowGroups=new Map<number,string[]>();for(const id of g.members.keys()){const level=g.levels.get(id)!;rowGroups.set(level,[...(rowGroups.get(level)??[]),id]);}
 // Only reserve occupied space on each generation. A wide descendant row must
 // not add empty margins around every ancestor's couple.
 const xs=new Map<string,number>(),rows:{level:number;ids:string[]}[]=[];
 const groupCenters=new Map<string,number>();
 for(const [level,groups] of [...rowGroups].sort((a,b)=>a[0]-b[0])){
  const preference=(id:string)=>{const ps=[...g.parents.get(id)!].filter(p=>groupCenters.has(p));return ps.length?ps.reduce((n,p)=>n+groupCenters.get(p)!,0)/ps.length:Infinity;};groups.sort((a,b)=>preference(a)-preference(b));
  const ids:string[]=[];for(const id of groups){const members=[...g.members.get(id)!];members.sort((a,b)=>{const average=(p:Person)=>p.parents.length?p.parents.reduce((n,parent)=>n+(xs.get(parent)??0),0)/p.parents.length:Infinity;return average(a)-average(b);});const neighbours=new Map(members.map(p=>[p.id,new Set(p.partners.filter(id=>members.some(q=>q.id===id)))]));for(const p of people){const same=p.parents.filter(id=>neighbours.has(id));for(const a of same)for(const b of same)if(a!==b)neighbours.get(a)!.add(b);}const available=new Set(members.map(p=>p.id)),ordered:string[]=[];while(available.size){const previous=ordered.at(-1);const next=members.find(p=>available.has(p.id)&&previous&&neighbours.get(previous)!.has(p.id))??members.find(p=>available.has(p.id)&&neighbours.get(p.id)!.size<=1)??members.find(p=>available.has(p.id))!;available.delete(next.id);ordered.push(next.id);}ids.push(...ordered);}
  const cursor=ids.length*COLUMN_STEP;ids.forEach((id,i)=>xs.set(id,(i+.5)*COLUMN_STEP));
  const shift=cursor/2;ids.forEach(id=>xs.set(id,xs.get(id)!-shift));for(const id of groups){const members=g.members.get(id)!;groupCenters.set(id,members.reduce((n,p)=>n+xs.get(p.id)!,0)/members.length);}
  rows.push({level,ids});
 }
 const families=new Map<string,{parents:string[];children:string[]}>();
 for(const p of people){if(!p.parents.length)continue;const parents=[...p.parents].sort();const key=parents.join('|')+'@'+g.levels.get(g.groupOf(p.id));const f=families.get(key)??{parents,children:[]};f.children.push(p.id);families.set(key,f);}
 if(!g.hierarchyError)orderFamilyRows(rows,[...families.values()],g.groupOf);
 for(const row of rows)row.ids.forEach((id,i)=>xs.set(id,(i-(row.ids.length-1)/2)*COLUMN_STEP));
 // The order of each row determines which cards define a family's centre.
 const centres=[...families.values()].map(f=>{
  const parents=[...f.parents].sort((a,b)=>xs.get(a)!-xs.get(b)!);
  const children=[...f.children].sort((a,b)=>xs.get(a)!-xs.get(b)!);
  const coefficients=new Map<string,number>();
  for(const [id,weight] of [[parents[0],.5],[parents.at(-1)!,.5],[children[0],-.5],[children.at(-1)!,-.5]] as [string,number][]){
   coefficients.set(id,(coefficients.get(id)??0)+weight);
  }
  return [...coefficients].filter(([,weight])=>weight!==0);
 });
 const couples=rows.flatMap(row=>row.ids.slice(1).flatMap((right,i)=>{
  const left=row.ids[i],group=g.groupOf(left);
  if(group!==g.groupOf(right)||g.members.get(group)!.length!==2)return [];
  const limit=COLUMN_STEP*(byId.get(left)!.parents.length&&byId.get(right)!.parents.length?2:1);
  return [{left,right,limit}];
 }));
 if(people.length&&!g.hierarchyError){
  const compact=compactLayout(rows.map(row=>row.ids),centres,couples,COLUMN_STEP);
  if(compact)for(const [id,x] of compact)xs.set(id,x);
 }
 const centeringError=centres.reduce((max,terms)=>Math.max(max,Math.abs(terms.reduce((sum,[id,weight])=>sum+xs.get(id)!*weight,0))),0);
 const minX=people.length?Math.min(...people.map(p=>xs.get(p.id)!-NODE_WIDTH/2)):0;
 const positions=new Map<string,{x:number;y:number}>();for(const p of people)positions.set(p.id,{x:offsetX+xs.get(p.id)!-minX+32-NODE_WIDTH/2,y:48+g.levels.get(g.groupOf(p.id))!*GENERATION_STEP});
 const width=Math.max(256,...[...positions.values()].map(p=>p.x-offsetX+NODE_WIDTH+32));
 const connections:TreeConnection[]=[],junctions:{id:string;x:number;y:number;people:string[]}[]=[],routes:FamilyRoute[]=[];
 const unions=new Map<string,{x:number;y:number}>();
 const pairKey=(a:string,b:string)=>[a,b].sort().join('|');
 function connectPair(aId:string,bId:string,kind:'family'|'couple'){
  const key=pairKey(aId,bId);const existing=unions.get(key);if(existing)return existing;
  let a=positions.get(aId)!,b=positions.get(bId)!;if(a.x>b.x)[a,b]=[b,a];
  const left=a.x+NODE_WIDTH-.5,right=b.x+.5,y=a.y+NODE_HEIGHT/2;
  // Anchor the descent in an actual gap, including families with several partners.
  const row=[...positions.values()].filter(p=>p.y===a.y&&p.x>=a.x&&p.x<=b.x).sort((x,z)=>x.x-z.x);
  const target=(left+right)/2;const gaps=row.slice(0,-1).map((p,i)=>(p.x+NODE_WIDTH+row[i+1].x)/2);gaps.sort((x,z)=>Math.abs(x-target)-Math.abs(z-target));
  const anchor={x:gaps[0]??target,y};
  connections.push({id:(kind==='couple'?'couple-':'coparents-')+key,kind,people:[aId,bId],d:'M '+left+' '+y+' H '+right});
  junctions.push({id:'union-'+key,...anchor,people:[aId,bId]});unions.set(key,anchor);return anchor;
 }
 // Couples meet side-to-side, at the vertical centre of their cards.
 for(const p of people)for(const id of p.partners)connectPair(p.id,id,'couple');
 const brace=(left:number,right:number,y:number,direction:number)=>{const mid=(left+right)/2;return 'M '+left+' '+y+' C '+left+' '+(y+22*direction)+' '+(mid-16)+' '+(y+5*direction)+' '+mid+' '+(y+30*direction)+' C '+(mid+16)+' '+(y+5*direction)+' '+right+' '+(y+22*direction)+' '+right+' '+y;};
 const childFamilies=new Map<string,{parents:string[];children:Person[]}>();
 for(const p of people){if(!p.parents.length)continue;const parents=[...p.parents].sort();const y=positions.get(p.id)!.y;const key=parents.join('|')+'@'+y;const family=childFamilies.get(key)??{parents,children:[]};family.children.push(p);childFamilies.set(key,family);}
 for(const [key,family] of childFamilies){
  const parents=[...family.parents].sort((a,b)=>positions.get(a)!.x-positions.get(b)!.x),kids=family.children.map(p=>positions.get(p.id)!).sort((a,b)=>a.x-b.x);
  const childY=kids[0].y+.5,leftKid=kids[0].x+NODE_WIDTH/2,rightKid=kids.at(-1)!.x+NODE_WIDTH/2,endX=(leftKid+rightKid)/2,endY=kids.length>1?childY-30:childY;
  let startX:number,startY:number;
  if(parents.length===1){const p=positions.get(parents[0])!;startX=p.x+NODE_WIDTH/2;startY=p.y+NODE_HEIGHT-.5;}
  else{const anchors=parents.slice(0,-1).map((id,i)=>connectPair(id,parents[i+1],'family'));anchors.sort((a,b)=>Math.abs(a.x-endX)-Math.abs(b.x-endX));startX=anchors[0].x;startY=anchors[0].y;}
  routes.push({key,origin:{x:startX,y:startY},parents,children:family.children.map(person=>({id:person.id,x:positions.get(person.id)!.x+NODE_WIDTH/2,y:childY})).sort((a,b)=>a.x-b.x)});
  const midY=(startY+endY)/2;connections.push({id:'stem-'+key,kind:'family',familyKey:key,d:'M '+startX+' '+startY+' C '+startX+' '+midY+' '+endX+' '+midY+' '+endX+' '+endY});
  if(kids.length>1){connections.push({id:'children-'+key,kind:'family',familyKey:key,d:brace(leftKid,rightKid,childY,-1)});
   for(const kid of kids.slice(1,-1)){
    const x=kid.x+NODE_WIDTH/2,mid=(leftKid+rightKid)/2;const control=x<=mid?[leftKid,leftKid,mid-16,mid]:[mid,mid+16,rightKid,rightKid];const ys=x<=mid?[childY,childY-22,childY-5,childY-30]:[childY-30,childY-5,childY-22,childY];
    const cubic=(a:number[],t:number)=>a[0]*(1-t)**3+3*a[1]*(1-t)**2*t+3*a[2]*(1-t)*t*t+a[3]*t**3;let low=0,high=1;for(let i=0;i<24;i++){const t=(low+high)/2;if(cubic(control,t)<x)low=t;else high=t;}const y=cubic(ys,(low+high)/2);connections.push({id:'child-'+key+'-'+x,kind:'family',familyKey:key,d:'M '+x+' '+y+' C '+x+' '+(y+10)+' '+x+' '+(childY-10)+' '+x+' '+childY});
   }
  }
 }
 const generations=people.length?Math.max(...g.levels.values())+1:0;
 return {positions,connections,junctions,routes,centeringError,width,height:Math.max(220,generations*GENERATION_STEP+48),generations,hierarchyError:g.hierarchyError};
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

