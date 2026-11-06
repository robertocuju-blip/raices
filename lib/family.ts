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
export function layout(people:Person[]) {
  const levels=new Map<string,number>(); const map=new Map(people.map(p=>[p.id,p]));
  function level(id:string):number {if(levels.has(id))return levels.get(id)!;const p=map.get(id)!;const n=p.parents.length?1+Math.max(...p.parents.map(level)):0; levels.set(id,n);return n;}
  people.forEach(p=>level(p.id));
  const rows:Person[][]=[];people.forEach(p=>{const n=levels.get(p.id)!;(rows[n]??=[]).push(p);});
  const width=Math.max(256,...rows.map(r=>r.length*196+64));
  const positions=new Map<string,{x:number,y:number}>();
  rows.forEach((r,i)=>{r.sort((a,b)=>{const px=(p:Person)=>p.parents.length?p.parents.reduce((v,id)=>v+(positions.get(id)?.x??0),0)/p.parents.length:people.indexOf(p)*196;return px(a)-px(b);});r.forEach((p,j)=>positions.set(p.id,{x:(width-r.length*196)/2+j*196+12,y:52+i*177}));});
  return {positions,width,height:Math.max(220,rows.length*177+48),generations:rows.length};
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

