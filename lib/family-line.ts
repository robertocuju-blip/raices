import type {Person} from './family.ts';

export function familyLine(people:Person[],personId:string):Person[]{
 const byId=new Map(people.map(person=>[person.id,person]));
 if(!byId.has(personId))return people;
 const children=new Map<string,string[]>();
 for(const person of people)for(const parent of person.parents){const group=children.get(parent)??[];group.push(person.id);children.set(parent,group);}
 function walk(start:Iterable<string>,links:(id:string)=>readonly string[]){
  const seen=new Set(start),queue=[...seen];
  for(let i=0;i<queue.length;i++)for(const next of links(queue[i]))if(byId.has(next)&&!seen.has(next)){seen.add(next);queue.push(next);}
  return seen;
 }
 const ancestors=walk([personId],id=>byId.get(id)!.parents);
 const relatives=walk(ancestors,id=>children.get(id)??[]);
 const visible=new Set(relatives);
 // Partners and coparents explain the displayed unions. Their unrelated
 // ancestry and children do not expand the selected person's line.
 for(const id of relatives){const person=byId.get(id)!;[...person.parents,...person.partners].forEach(other=>visible.add(other));}
 return people.filter(person=>visible.has(person.id)).map(person=>({
  ...person,
  parents:relatives.has(person.id)?person.parents.filter(id=>visible.has(id)):[],
  partners:person.partners.filter(id=>visible.has(id)&&(relatives.has(person.id)||relatives.has(id)))
 }));
}
