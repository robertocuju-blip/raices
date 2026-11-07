'use client';
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Sprout,Plus,Download,Upload,Check,Maximize,X,Trash2,ChevronDown,LoaderCircle,Search,Focus,ArrowLeft,ArrowRight} from 'lucide-react';
import {useTreeGestures} from '../hooks/use-tree-gestures';
import {fitTreeZoom} from '../lib/tree-view';
import {routeLanes} from '../lib/lane-routing';
import {familyLine} from '../lib/family-line';
import {loadFamily,saveFamily,STORAGE_KEY} from '../lib/storage';
import {ageRange,dateLabel,dateStart,isYear,initials,isUncertain,markedValue,layout,todayISO,validateFamily,assertHierarchy,isAncestor,searchRelatives,type Family,type Person,type UncertainField,type TreeConnection} from '../lib/family';
const emptyFamily:Family={title:'Mi familia',people:[]};
const blank=():Person=>({id:crypto.randomUUID(),name:'',surname:'',gender:'',birth:'',deceased:false,death:'',place:'',note:'',parents:[],partners:[]});
const full=(p:Person)=>p.name.trim()||p.surname.trim()?`${markedValue(p,'name')} ${markedValue(p,'surname')}`:'Persona sin identificar';
const shownDate=(p:Person,key:'birth'|'death')=>markedValue(p,key,dateLabel(p[key]));
const ageText=(p:Person,compact=false)=>{const range=ageRange(p);if(!range)return '';const estimate=isUncertain(p,'birth')||p.deceased&&isUncertain(p,'death');return `${range.min===range.max?range.min:`${range.min}–${range.max}`} años${p.deceased?' al fallecer':''}${estimate?(compact?'?':' (estimación)'):''}`;};
const nodeDates=(p:Person)=>p.deceased?`${shownDate(p,'birth')} — ${shownDate(p,'death')}`:[shownDate(p,'birth'),ageText(p,true)].filter(Boolean).join(' · ');
const charts=new WeakMap<Person[],{graph:ReturnType<typeof layout>;drawing:ReturnType<typeof routeLanes>}>();
function chartFor(people:Person[]){const cached=charts.get(people);if(cached)return cached;const graph=layout(people),value={graph,drawing:routeLanes(graph)};charts.set(people,value);return value;}
type Editor={person:Person;mode:string;relative?:string};
export default function FamilyApp(){
 const [family,setFamily]=useState<Family>(emptyFamily),[ready,setReady]=useState(false),[revision,setRevision]=useState(0),[zoom,setZoom]=useState(1),[editor,setEditor]=useState<Editor|null>(null),[confirmation,setConfirmation]=useState<'delete'|'import'|null>(null),[pendingImport,setPendingImport]=useState<Family|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [lineId,setLineId]=useState<string|null>(null),[searchOpen,setSearchOpen]=useState(false),[selectedId,setSelectedId]=useState<string|null>(null);
 const importer=useRef<HTMLInputElement>(null),viewport=useRef<HTMLDivElement>(null),previousFocus=useRef<HTMLElement|null>(null);
 const profileScroll=useRef<HTMLDivElement>(null),profileHeading=useRef<HTMLHeadingElement>(null);
 const returnToTree=useRef<{viewId:string|null;left:number;top:number;personId?:string}|null>(null);
 const focused=family.people.find(person=>person.id===lineId),viewId=focused?.id??null;
 const visiblePeople=useMemo(()=>viewId===null?family.people:familyLine(family.people,viewId),[family.people,viewId]);
 const {graph,drawing}=useMemo(()=>chartFor(visiblePeople),[visiblePeople]),maskPrefix=useId();
 const maskIds=useMemo(()=>new Map([...drawing.cuts.keys()].map((id,i)=>[id,`${maskPrefix}-${i}`])),[drawing,maskPrefix]);
 const selected=visiblePeople.find(person=>person.id===selectedId);
 const spotlight=useMemo(()=>{
  if(!selected)return null;
  const branch=familyLine(visiblePeople,selected.id),byId=new Map(branch.map(p=>[p.id,p]));
  const routes=graph.routes.filter(route=>route.children.some(child=>route.parents.every(id=>byId.get(child.id)?.parents.includes(id))));
  const keys=new Set(routes.map(route=>route.key));
  const pairKeys=new Set<string>();const addPair=(a:string,b:string)=>pairKeys.add(JSON.stringify([a,b].sort()));
  for(const person of branch)for(const partner of person.partners)addPair(person.id,partner);
  for(const route of routes)route.parents.forEach((a,i)=>route.parents.slice(i+1).forEach(b=>addPair(a,b)));
  return {keys,pairKeys,people:byId};
 },[selected,visiblePeople,graph.routes]);
 function branchClass(line:Pick<TreeConnection,'familyKey'|'people'>){
  if(!spotlight)return '';
  const related=line.familyKey?spotlight.keys.has(line.familyKey):!!line.people&&spotlight.pairKeys.has(JSON.stringify([...line.people].sort()));
  return related?' branch-active':' branch-muted';
 }
 const fittedLine=useRef<string|null|undefined>(undefined);
 const [fitRequest,setFitRequest]=useState(0),lastFitRequest=useRef(0);
 function fitTree(){const el=viewport.current;if(!el)return;const inner=el.querySelector<HTMLElement>('.canvas-inner');if(!inner)return;const style=getComputedStyle(inner);const horizontal=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),vertical=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);setZoom(fitTreeZoom(graph.width,graph.height,el.clientWidth-horizontal-2,el.clientHeight-vertical-2));setFitRequest(n=>n+1);}
 useLayoutEffect(()=>{if(fitRequest===lastFitRequest.current)return;lastFitRequest.current=fitRequest;const el=viewport.current;if(el)el.scrollTo({left:Math.max(0,(el.scrollWidth-el.clientWidth)/2),top:Math.max(0,(el.scrollHeight-el.clientHeight)/2),behavior:'instant'});},[zoom,fitRequest]);
 const profileOpen=!!editor,dialogOpen=!!confirmation||searchOpen;
 const treeBlocked=profileOpen||dialogOpen;
 const gestures=useTreeGestures(viewport,zoom,setZoom,ready&&family.people.length>0&&!treeBlocked);
 function applyStored(saved:ReturnType<typeof loadFamily>){const next=saved?.tree??emptyFamily;setFamily(current=>JSON.stringify(current)===JSON.stringify(next)?current:next);setRevision(saved?.revision??0);}
 useEffect(()=>{try{applyStored(loadFamily(localStorage));setReady(true);}catch(e){setError(e instanceof Error?e.message:'El navegador no permite guardar datos. Habilita el almacenamiento para utilizar Raíces.');}},[]);
 useEffect(()=>{if(!ready||treeBlocked)return;const sync=()=>{try{applyStored(loadFamily(localStorage));}catch(e){setError(e instanceof Error?e.message:'No se pudo leer el árbol.');}};const listener=(e:StorageEvent)=>{if(e.key===STORAGE_KEY||e.key===null)sync();};sync();window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener);},[treeBlocked,ready]);
 useLayoutEffect(()=>{if(profileOpen)return;if(!ready||!visiblePeople.length){fittedLine.current=undefined;return;}if(fittedLine.current===viewId)return;fittedLine.current=viewId;fitTree();},[profileOpen,ready,viewId,graph.width,graph.height,visiblePeople.length]);
 useLayoutEffect(()=>{if(profileOpen||!viewport.current)return;const saved=returnToTree.current;returnToTree.current=null;if(!saved||saved.viewId!==viewId)return;const canvas=viewport.current;canvas.scrollTo({left:saved.left,top:saved.top,behavior:'instant'});const card=[...canvas.querySelectorAll<HTMLButtonElement>('[data-person-id]')].find(node=>node.dataset.personId===saved.personId);card?.focus({preventScroll:true});},[profileOpen,viewId]);
 useLayoutEffect(()=>{if(!editor?.person.id)return;profileScroll.current?.scrollTo({top:0,behavior:'instant'});profileHeading.current?.focus({preventScroll:true});},[editor?.person.id]);
 useEffect(()=>{if(!profileOpen||dialogOpen)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){setEditor(null);setError('');}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[profileOpen,dialogOpen,busy]);
 useEffect(()=>{if(!dialogOpen)return;previousFocus.current=document.activeElement as HTMLElement;const el=document.querySelector<HTMLElement>('[role="dialog"]');(el?.querySelector<HTMLElement>('[data-initial-focus]')??el?.querySelector<HTMLElement>('input,button'))?.focus();const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){setEditor(null);setConfirmation(null);setSearchOpen(false);setError('');}if(e.key==='Tab'){const all=Array.from(el?.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]')??[]).filter(x=>!x.hasAttribute('disabled')&&x.offsetParent!==null);const first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}}};document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);previousFocus.current?.focus({preventScroll:true});};},[dialogOpen,busy,confirmation,editor?.person.id,searchOpen]);
 useEffect(()=>{if(treeBlocked||!selected)return;const clear=(event:KeyboardEvent)=>{if(event.key==='Escape')setSelectedId(null);};document.addEventListener('keydown',clear);return()=>document.removeEventListener('keydown',clear);},[treeBlocked,selected]);
 async function persist(next:Family){validateFamily(next);assertHierarchy(next.people);if(!ready)throw new Error('El almacenamiento del navegador no está disponible.');setBusy(true);setError('');try{const save=()=>saveFamily(localStorage,next,revision);const result=navigator.locks?await navigator.locks.request('raices-save',save):save();setFamily(result.tree);setRevision(result.revision);}finally{setBusy(false);}}
 function attempt(next:Family,after:()=>void){persist(next).then(after).catch(e=>setError(e instanceof Error?e.message:'No se pudo guardar.'));}
 function openProfile(next:Editor){const canvas=viewport.current;if(canvas)returnToTree.current={viewId,left:canvas.scrollLeft,top:canvas.scrollTop,personId:next.mode==='edit'?next.person.id:undefined};setError('');setEditor(next);}
 function add(mode='new',relative?:string){const person=blank();if(mode==='child'&&relative)person.parents=[relative];if(mode==='partner'&&relative)person.partners=[relative];openProfile({person,mode,relative});}
 function savePerson(person:Person){if(!['Mujer','Hombre'].includes(person.gender)){setError('Elige Mujer u Hombre.');return;}const current=editor!;let people=family.people.map(p=>({...p,parents:[...p.parents],partners:p.partners.filter(id=>id!==person.id)}));const existing=people.findIndex(p=>p.id===person.id);if(existing>=0)people[existing]=person;else people.push(person);if(current.mode==='parent'&&current.relative)people=people.map(p=>p.id===current.relative?{...p,parents:[...p.parents,person.id]}:p);people=people.map(p=>p.id!==person.id&&person.partners.includes(p.id)?{...p,partners:[...p.partners,person.id]}:p);attempt({...family,people},()=>{setEditor(null);if(viewId&&existing<0&&!familyLine(people,viewId).some(p=>p.id===person.id))setLineId(null);});}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify({format:'raices-v1',tree:family},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='raices-'+todayISO()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function importFile(file?:File){if(!file)return;try{if(file.size>2000000)throw new Error('La copia es demasiado grande (máximo 2 MB).');const data=JSON.parse(await file.text());validateFamily(data.tree);setPendingImport(data.tree);setError('');setConfirmation('import');}catch(e){setError(e instanceof Error?e.message:'No se pudo abrir la copia.');}if(importer.current)importer.current.value='';}
 function removePerson(){if(!editor)return;const id=editor.person.id;attempt({...family,people:family.people.filter(p=>p.id!==id).map(p=>({...p,parents:p.parents.filter(x=>x!==id),partners:p.partners.filter(x=>x!==id)}))},()=>{if(lineId===id)setLineId(null);setConfirmation(null);setEditor(null);});}
 function showLine(id:string){setLineId(id);setSelectedId(null);setSearchOpen(false);setEditor(null);setError('');}
 function tapPerson(id:string){if(id!==selectedId){setSelectedId(id);return;}const person=family.people.find(p=>p.id===id);if(person)openProfile({person:{...person},mode:'edit'});}
 const close=()=>{if(busy)return;setEditor(null);setConfirmation(null);setError('');};
 return <div className="tree-app">
  {!editor&&<>
  <header className="app-bar">
   <a href="./" className="brand" aria-label="Raíces, inicio"><Sprout size={29} strokeWidth={1.5}/><span>raíces.</span></a>
   <div className="backup-actions"><button className="toolbar-button" onClick={download} disabled={!ready} aria-label="Crear copia de seguridad" title="Crear copia de seguridad"><Download size={17}/><span>Crear copia de seguridad</span></button><button className="toolbar-button" onClick={()=>importer.current?.click()} disabled={!ready||busy} aria-label="Importar copia de seguridad" title="Importar copia de seguridad"><Upload size={17}/><span>Importar copia de seguridad</span></button></div>
   <input hidden ref={importer} type="file" accept=".json,application/json" onChange={e=>importFile(e.target.files?.[0])}/>
  </header>
  <main className={'tree-workspace'+(focused?' has-line':'')} aria-label="Árbol genealógico">
   {focused&&<div className="line-bar"><div className="line-title" role="status"><span>Línea de</span><strong>{full(focused)}</strong></div><button className="line-back" onClick={()=>{setLineId(null);setSelectedId(null);}}><ArrowLeft size={15}/>Árbol completo</button></div>}
   {error&&!dialogOpen&&<div className="error-toast" role="alert"><span>{error}</span><button aria-label="Cerrar aviso" onClick={()=>setError('')}><X size={16}/></button></div>}
   <div ref={viewport} className="tree-canvas" {...gestures} onClick={event=>{if(!(event.target as Element).closest('button'))setSelectedId(null);}}>
    {!ready?<div className="empty-state"><LoaderCircle size={22} className="spin" aria-label="Cargando árbol"/></div>:family.people.length===0?<div className="empty-state"><Sprout size={42} strokeWidth={1.2}/><h1>Tu árbol empieza aquí.</h1><button className="primary" onClick={()=>add()}><Plus size={16}/>Añadir primera persona</button></div>:<div className="canvas-inner"><div className="graph-space" style={{width:graph.width*zoom,height:graph.height*zoom}}><div className="graph" style={{width:graph.width,height:graph.height,transform:`scale(${zoom})`}}>
     <svg width={graph.width} height={graph.height} className="connections" aria-hidden="true">
      {drawing.cuts.size>0&&<defs>{[...drawing.cuts].map(([id,cuts])=><mask key={id} id={maskIds.get(id)} maskUnits="userSpaceOnUse" x={0} y={0} width={graph.width} height={graph.height}><rect width={graph.width} height={graph.height} fill="white"/>{cuts.map((area,i)=><rect key={i} {...area} fill="black"/>)}</mask>)}</defs>}
      {drawing.lines.map(line=><path key={line.id} data-connection={line.kind} className={(line.kind==='couple'?'couple-brace':'family-brace')+branchClass(line)} d={line.d} mask={maskIds.has(line.id)?`url(#${maskIds.get(line.id)})`:undefined}/>)}
      {drawing.bridges.map(bridge=><path key={bridge.id} className={'line-bridge'+(bridge.over.kind==='couple'?' couple-brace':'')+branchClass(bridge.over)} d={bridge.d}/>)}
      {graph.junctions.map(junction=><circle key={junction.id} className={'family-junction'+branchClass(junction)} cx={junction.x} cy={junction.y} r={2.5}/>)}</svg>
     {visiblePeople.map(p=>{const pos=graph.positions.get(p.id)!,picked=p.id===selected?.id;
      const muted=spotlight!==null&&!spotlight.people.has(p.id);
      return <button key={p.id} data-person-id={p.id} className={'person-node '+(p.gender==='Mujer'?'female':p.gender==='Hombre'?'male':'unspecified')+(picked||!selected&&p.id===viewId?' line-person':'')+(muted?' card-muted':'')} title={markedValue(p,'gender')} aria-current={picked||p.id===viewId?'true':undefined} style={{left:pos.x,top:pos.y}} onClick={()=>tapPerson(p.id)} aria-label={`${picked?'Editar a':'Resaltar la línea de'} ${full(p)}${isUncertain(p,'gender')?', género dudoso':''}`}><span className={'avatar '+(p.gender==='Hombre'?'blue':p.gender==='Mujer'?'pink':'neutral')}>{initials(p)}{isUncertain(p,'gender')&&<span className="gender-doubt" aria-hidden="true">?</span>}{p.deceased&&<span className="deceased-mark" aria-label="Fallecido/a">✧</span>}</span><span className="node-name">{markedValue(p,'name')}</span><span className="node-surname">{markedValue(p,'surname')}</span><span className="node-dates">{nodeDates(p)}</span></button>;})}
    </div></div></div>}
   </div>
   {family.people.length>0&&<><div className="tree-tools"><button className="fit-tree" aria-label={focused?'Encuadrar línea familiar':'Ver árbol completo'} title={focused?'Encuadrar línea familiar':'Ver árbol completo'} onClick={fitTree}><Maximize size={17}/></button><button className="fit-tree" aria-label="Buscar persona" title="Buscar persona" onClick={()=>setSearchOpen(true)}><Search size={17}/></button></div><button className="add-person" aria-label="Añadir persona" title="Añadir persona" onClick={()=>add()} disabled={!ready||busy}><Plus size={23}/></button></>}
   {selected&&<p className="branch-hint" role="status">Línea resaltada. Toca otra vez la ficha para editar.</p>}
  </main>
  </>}
  {editor&&<main className="profile-screen" aria-labelledby="profile-title" inert={!!confirmation}>
   <header className="profile-bar"><div className="profile-bar-inner"><button className="profile-back" disabled={busy} onClick={close}><ArrowLeft size={18}/>Volver al árbol</button><Sprout size={25} strokeWidth={1.5} aria-hidden="true"/></div></header>
   <div ref={profileScroll} className="profile-scroll"><div className="profile-content">
    {editor.mode==='edit'&&<p className="profile-kicker">Ficha familiar</p>}
    <h1 id="profile-title" tabIndex={-1} ref={profileHeading}>{editor.mode==='edit'?full(editor.person):editor.mode==='parent'?'Añadir progenitor/a':editor.mode==='child'?'Añadir descendiente':editor.mode==='partner'?'Añadir pareja':'Añadir persona'}</h1>
    <PersonForm key={editor.person.id} person={editor.person} people={family.people} busy={busy} error={error} onSave={savePerson} onCancel={close} onShowLine={editor.mode==='edit'&&editor.person.id!==viewId?()=>showLine(editor.person.id):undefined}/>
    {editor.mode==='edit'&&<div className="family-actions profile-family-actions"><div className="relative-actions"><button onClick={()=>add('parent',editor.person.id)} disabled={busy}><Plus size={14}/>Progenitor/a</button><button onClick={()=>add('child',editor.person.id)} disabled={busy}><Plus size={14}/>Descendiente</button><button onClick={()=>add('partner',editor.person.id)} disabled={busy}><Plus size={14}/>Pareja</button></div><button className="delete-button" onClick={()=>{setError('');setConfirmation('delete');}} disabled={busy}><Trash2 size={14}/>Eliminar persona</button></div>}
   </div></div>
  </main>}
  {searchOpen&&<LinePicker people={family.people} onClose={()=>setSearchOpen(false)} onSelect={showLine}/>}
  {confirmation&&<div className="modal-backdrop"><section className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirmation-title"><h2 id="confirmation-title">{confirmation==='delete'?'¿Eliminar a este familiar?':'¿Importar esta copia?'}</h2><p>{confirmation==='delete'?`Se eliminará la ficha de ${editor?full(editor.person):''} y sus vínculos. Los demás familiares se conservarán.`:'Esta copia sustituirá el árbol de este navegador. Puedes descargar una copia del actual antes de continuar.'}</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="outline" disabled={busy} onClick={()=>{setConfirmation(null);setError('');}}>Cancelar</button>{confirmation==='import'&&<button className="outline" onClick={download}>Descargar actual</button>}<button className="primary" disabled={busy} onClick={()=>confirmation==='delete'?removePerson():pendingImport&&attempt(pendingImport,()=>{setLineId(null);setConfirmation(null);})}>{busy?<LoaderCircle size={16} className="spin"/>:confirmation==='delete'?'Eliminar persona':'Importar y guardar'}</button></div></section></div>}
 </div>;
}

function PersonChoice({person,label,onClick}:{person:Person;label:string;onClick:()=>void}){
 return <button type="button" aria-label={label} onClick={onClick}><span className={'result-dot '+(person.gender==='Mujer'?'pink':'blue')}/><span>{full(person)}{person.birth&&<small>{shownDate(person,'birth')}</small>}</span><ArrowRight size={15}/></button>;
}
function LinePicker({people,onClose,onSelect}:{people:Person[];onClose:()=>void;onSelect:(id:string)=>void}){
 const [query,setQuery]=useState(''),{matches,total}=useMemo(()=>searchRelatives(people,query),[people,query]);
 return <div className="modal-backdrop"><section className="modal chart-picker" role="dialog" aria-modal="true" aria-labelledby="line-picker-title"><div className="modal-header"><h2 id="line-picker-title">Buscar persona</h2><button className="icon-button" aria-label="Cerrar búsqueda" onClick={onClose}><X size={20}/></button></div><div className="chart-picker-body"><p>Elige a alguien para ver su línea familiar.</p><label className="relative-search-input"><Search size={17}/><input data-initial-focus type="search" aria-label="Nombre o apellidos" placeholder="Nombre o apellidos…" value={query} onChange={e=>setQuery(e.target.value)} autoComplete="off"/></label>
 {query.trim().length<2?<p className="search-hint">Escribe al menos 2 caracteres.</p>:!matches.length?<p className="search-hint" role="status">No hay coincidencias.</p>:<div className="relative-results" aria-label="Resultados de personas">{matches.map(person=><PersonChoice key={person.id} person={person} label={`Ver línea de ${full(person)}`} onClick={()=>onSelect(person.id)}/>)}{total>matches.length&&<p className="search-hint" role="status">Mostrando {matches.length} de {total}. Escribe más para afinar la búsqueda.</p>}</div>}</div></section></div>;
}
function DoubtButton({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}){
 return <button type="button" className="doubt-button" aria-label={`Duda sobre ${label}`} aria-pressed={active} title={active?'Quitar marca de duda':'Marcar como dudoso'} onClick={onClick}>?</button>;
}
function PersonForm({person,people,busy,error,onSave,onCancel,onShowLine}:{person:Person;people:Person[];busy:boolean;error:string;onSave:(p:Person)=>void;onCancel:()=>void;onShowLine?:()=>void}){
 const [p,setP]=useState({...person,gender:['Mujer','Hombre'].includes(person.gender)?person.gender:''});const update=(key:string,value:unknown)=>setP(x=>({...x,[key]:value}));
 const initial=useRef(p),fieldPrefix=useId(),dirty=JSON.stringify(initial.current)!==JSON.stringify(p);
 function toggleDoubt(field:UncertainField){setP(current=>{const uncertain=isUncertain(current,field)?current.uncertain!.filter(value=>value!==field):[...(current.uncertain??[]),field];return {...current,uncertain:uncertain.length?uncertain:undefined};});}
 const doubt=(field:UncertainField,label:string)=><DoubtButton label={label} active={isUncertain(p,field)} onClick={()=>toggleDoubt(field)}/>;
 const parentCandidates=useMemo(()=>people.filter(x=>x.id!==p.id&&!p.partners.includes(x.id)&&!isAncestor(people,p.id,x.id)),[people,p.id,p.partners]);
 const partnerCandidates=useMemo(()=>people.filter(x=>x.id!==p.id&&!p.parents.includes(x.id)&&!isAncestor(people,p.id,x.id)&&!isAncestor(people,x.id,p.id)),[people,p.id,p.parents]);
 return <form onSubmit={e=>{e.preventDefault();onSave({...p,name:p.name.trim(),surname:p.surname.trim()});}}><div className="profile-fields">{onShowLine&&<button type="button" className="line-action" disabled={busy||dirty} title={dirty?'Guarda o cancela los cambios para cambiar de vista':undefined} onClick={onShowLine}><Focus size={17}/>Ver su línea</button>}<p className="doubt-hint">Deja en blanco lo que no sepas. Usa «?» para los datos dudosos.</p><div className="form-grid">
  <div className="field"><div className="field-heading"><label htmlFor={`${fieldPrefix}-name`}>Nombre</label>{doubt('name','el nombre')}</div><input id={`${fieldPrefix}-name`} maxLength={200} placeholder="Desconocido" value={p.name} onChange={e=>update('name',e.target.value)} autoComplete="off"/></div>
  <div className="field"><div className="field-heading"><label htmlFor={`${fieldPrefix}-surname`}>Apellidos</label>{doubt('surname','los apellidos')}</div><input id={`${fieldPrefix}-surname`} maxLength={200} placeholder="Desconocidos" value={p.surname} onChange={e=>update('surname',e.target.value)} autoComplete="off"/></div>
 </div>
 <fieldset className="gender-field"><legend>Género <span>*</span> {doubt('gender','el género')}</legend><div className="gender-options"><label className={'gender-choice female '+(p.gender==='Mujer'?'chosen':'')}><input type="radio" required name="gender" value="Mujer" checked={p.gender==='Mujer'} onChange={()=>update('gender','Mujer')}/>Mujer</label><label className={'gender-choice male '+(p.gender==='Hombre'?'chosen':'')}><input type="radio" required name="gender" value="Hombre" checked={p.gender==='Hombre'} onChange={()=>update('gender','Hombre')}/>Hombre</label></div></fieldset>
 <label className="checkbox-label"><input type="checkbox" checked={p.deceased} onChange={e=>setP({...p,deceased:e.target.checked,death:e.target.checked?p.death:'',uncertain:e.target.checked?p.uncertain:p.uncertain?.filter(field=>field!=='death')})}/>Esta persona ha fallecido</label>
 <div className="form-grid dates-grid"><DateField kind="nacimiento" value={p.birth} doubt={doubt('birth','el nacimiento')} onChange={value=>update('birth',value)}/>{p.deceased&&<DateField kind="defunción" value={p.death} min={dateStart(p.birth)||undefined} doubt={doubt('death','la defunción')} onChange={value=>update('death',value)}/>}</div>
 <p className="date-hint">Las fechas en blanco se muestran como «¿?».</p>
 {ageText(p)&&<p className="age-preview">{ageText(p)}</p>}
 {people.some(x=>x.id!==p.id)&&<details className="form-relations" open={p.parents.length>0||p.partners.length>0}><summary>Vínculos familiares<ChevronDown size={15}/></summary><RelationPicker label="Progenitores" placeholder="Buscar progenitor/a" people={people} candidates={parentCandidates} selected={p.parents} onChange={ids=>update('parents',ids)}/><RelationPicker label="Parejas" placeholder="Buscar pareja" people={people} candidates={partnerCandidates} selected={p.partners} onChange={ids=>update('partners',ids)}/></details>}
 {error&&<p role="alert" className="form-error">{error}</p>}</div><div className="profile-form-actions"><button type="button" className="outline" disabled={busy} onClick={onCancel}>Cancelar</button><button className="primary" disabled={busy}>{busy?<><LoaderCircle size={16} className="spin"/>Guardando…</>:<><Check size={16}/>Guardar familiar</>}</button></div></form>;
}
function DateField({kind,value,min,doubt,onChange}:{kind:'nacimiento'|'defunción';value:string;min?:string;doubt:ReactNode;onChange:(value:string)=>void}){
 const [yearOnly,setYearOnly]=useState(isYear(value)),id=useId();
 return <div className="date-field"><div className="field"><div className="field-heading"><label htmlFor={id}>{yearOnly?'Año':'Fecha'} de {kind}</label>{doubt}</div>{yearOnly?<input id={id} type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="AAAA" value={value} onChange={e=>onChange(e.target.value.replace(/[^0-9]/g,''))}/>:<input id={id} type="date" max={todayISO()} min={min?.length===10?min:undefined} value={value} onInput={e=>onChange(e.currentTarget.value)} onChange={e=>onChange(e.target.value)}/>}</div><button type="button" className="date-mode" aria-label={yearOnly?`Introducir fecha completa de ${kind}`:`Indicar solo el año de ${kind}`} onClick={()=>{setYearOnly(!yearOnly);onChange(yearOnly?'':value.slice(0,4));}}>{yearOnly?'Fecha completa':'Solo sé el año'}</button></div>;
}
function RelationPicker({label,placeholder,people,candidates,selected,onChange}:{label:string;placeholder:string;people:Person[];candidates:Person[];selected:string[];onChange:(ids:string[])=>void}){
 const [query,setQuery]=useState('');const {matches,total}=useMemo(()=>searchRelatives(candidates,query,selected),[candidates,query,selected]);
 return <section className="relation-search" aria-label={label}><h3>{label}</h3>{selected.length>0&&<div className="selected-relations">{selected.map(id=>{const person=people.find(p=>p.id===id);return person&&<span className="relation-chip" key={id}>{full(person)}<button type="button" aria-label={'Quitar vínculo con '+full(person)} onClick={()=>onChange(selected.filter(x=>x!==id))}><X size={12}/></button></span>;})}</div>}
 <label className="relative-search-input"><Search size={15}/><input aria-label={placeholder} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={placeholder+'…'} autoComplete="off"/></label>
 {query.trim().length<2?<p className="search-hint">Escribe al menos 2 caracteres para buscar.</p>:matches.length===0?<p className="search-hint" role="status">No hay coincidencias.</p>:<div className="relative-results" aria-label={'Resultados de '+label.toLowerCase()}>{matches.map(person=><button key={person.id} type="button" aria-label={'Vincular a '+full(person)} onClick={()=>{onChange([...selected,person.id]);setQuery('');}}><span className={'result-dot '+(person.gender==='Mujer'?'pink':'blue')}/><span>{full(person)}</span><Plus size={14}/></button>)}{total>matches.length&&<p className="search-hint" role="status">Mostrando {matches.length} de {total}. Escribe más para afinar la búsqueda.</p>}</div>}
 </section>;
}
