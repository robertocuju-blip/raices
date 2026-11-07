import assert from 'node:assert/strict';
import {loadFamily,saveFamily,STORAGE_KEY} from './lib/storage.ts';
import {demo} from './lib/family.ts';
class MemoryStorage { items=new Map();getItem(k){return this.items.get(k)??null;}setItem(k,v){this.items.set(k,v);} }
const storage=new MemoryStorage();assert.equal(loadFamily(storage),null);
const first=saveFamily(storage,demo,0);assert.equal(first.revision,1);assert.deepEqual(loadFamily(storage).tree,demo);
assert.throws(()=>saveFamily(storage,{...demo,title:'Stale'},0),/otra pestaña/);
assert.equal(loadFamily(storage).tree.title,demo.title);
const restored=JSON.parse(JSON.stringify({format:'raices-v1',tree:demo}));
const second=saveFamily(storage,{...restored.tree,title:'Árbol recuperado'},1);assert.equal(second.revision,2);assert.equal(loadFamily(storage).tree.title,'Árbol recuperado');
assert.throws(()=>saveFamily(storage,{title:'Roto',people:[{}]},2));assert.equal(loadFamily(storage).revision,2);
const full={getItem:k=>storage.getItem(k),setItem(){throw new Error('QuotaExceeded');}};assert.throws(()=>saveFamily(full,demo,2),/no ha podido guardar/);assert.equal(loadFamily(storage).revision,2);
const other=new MemoryStorage();assert.equal(loadFamily(other),null);
const corrupt=new MemoryStorage();corrupt.setItem(STORAGE_KEY,'not-json');assert.throws(()=>loadFamily(corrupt));
const uncertain=structuredClone(demo);uncertain.people[0].name='';uncertain.people[0].uncertain=['surname','birth'];
saveFamily(other,uncertain,0);assert.deepEqual(loadFamily(other).tree,uncertain);
console.log('Guardado, recarga, importación, aislamiento y conservación de datos dudosos comprobados.');
