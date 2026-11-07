import assert from 'node:assert/strict';
import {familyLine} from './lib/family-line.ts';
import {layout,validateFamily} from './lib/family.ts';

const p=(id,parents=[],partners=[])=>({id,name:id,surname:'Ejemplo',gender:'Hombre',birth:'',death:'',deceased:false,place:'',note:'',parents,partners});
const people=[p('abuela'),p('madre',['abuela'],['padre']),p('padre',[],['madre']),p('tia',['abuela']),p('prima',['tia','pareja-tia']),p('pareja-tia'),p('persona',['madre','padre'],['pareja']),p('hermana',['madre','padre']),p('pareja',['suegro'],['persona']),p('suegro'),p('hija',['persona','coprogenitor']),p('coprogenitor',['abuelo-de-hija']),p('abuelo-de-hija'),p('nieta',['hija']),p('hijo-de-pareja',['pareja']),p('rama-aparte')];
const original=structuredClone(people),line=familyLine(people,'persona');
assert.deepEqual(line.map(p=>p.id),['abuela','madre','padre','tia','prima','pareja-tia','persona','hermana','pareja','hija','coprogenitor','nieta']);
assert.deepEqual(line.find(p=>p.id==='hija').parents,['persona','coprogenitor']);
assert.deepEqual(line.find(p=>p.id==='pareja').parents,[],'The partner’s unrelated lineage is hidden');
validateFamily({title:'Línea familiar',people:line});
assert.equal(layout(line).positions.size,line.length);
assert.deepEqual(people,original,'Filtering must not change the full saved tree');
assert.deepEqual(familyLine(people,'rama-aparte').map(p=>p.id),['rama-aparte']);
console.log('Línea familiar: ascendientes, descendientes, parientes con ascendencia común y parejas pertinentes.');
