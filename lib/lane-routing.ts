import {NODE_WIDTH,NODE_HEIGHT,type FamilyRoute,type TreeConnection,type layout} from './family.ts';

type Segment=TreeConnection&{axis:'h'|'v';fixed:number;min:number;max:number};
type Cut={x:number;y:number;width:number;height:number};
type Bridge={id:string;d:string;over:Segment};
const EPS=.06;

function segment(id:string,kind:TreeConnection['kind'],axis:Segment['axis'],fixed:number,a:number,b:number,extra:Partial<TreeConnection>={}):Segment{
 const d=axis==='h'?`M ${a} ${fixed} H ${b}`:`M ${fixed} ${a} V ${b}`;
 return {...extra,id,kind,d,axis,fixed,min:Math.min(a,b),max:Math.max(a,b)};
}
function crossing(a:Segment,b:Segment){
 if(a.axis===b.axis||a.familyKey&&a.familyKey===b.familyKey)return null;
 const h=a.axis==='h'?a:b,v=a.axis==='v'?a:b;
 if(v.fixed<=h.min+EPS||v.fixed>=h.max-EPS||h.fixed<=v.min+EPS||h.fixed>=v.max-EPS)return null;
 return {h,v,x:v.fixed,y:h.fixed};
}
function conflict(a:Segment,b:Segment){
 if(a.axis!==b.axis)return crossing(a,b)?1:0;
 const overlap=Math.min(a.max,b.max)-Math.max(a.min,b.min);
 if(overlap<=EPS)return 0;
 // Parallel lines in the same corridor read as one link. Separate them
 // before trying to eliminate perpendicular crossings.
 return Math.abs(a.fixed-b.fixed)<EPS?1000:0;
}

export function routeLanes(graph:ReturnType<typeof layout>){
 const pairs=graph.connections.filter(line=>!line.familyKey).map(line=>{
  const [x,y,end]=line.d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)!.map(Number);
  return segment(line.id,line.kind,'h',y,x,end,line);
 });
 function corridor(route:FamilyRoute){
  const start=graph.positions.get(route.parents[0])!.y,finish=route.children[0].y;
  const blocked=[...graph.positions.values()].filter(pos=>pos.y>start&&pos.y<finish-1).map(pos=>[pos.x-8,pos.x+NODE_WIDTH+8]);
  if(!blocked.length)return {x:route.origin.x,exit:route.origin.y};
  const open=(x:number)=>!blocked.some(([a,b])=>x>a&&x<b);
  const options=[route.origin.x,16,graph.width-16,...blocked.flat()].filter(open);
  const x=options.sort((a,b)=>Math.abs(a-route.origin.x)-Math.abs(b-route.origin.x))[0]??16;
  return {x,exit:start+NODE_HEIGHT+8};
 }
 const rows=graph.routes.map(route=>{
  const {origin,children,key}=route,{x,exit}=corridor(route),bottom=children[0].y;
  const make=(y:number)=>{
   const lines:Segment[]=[];
   const add=(id:string,axis:Segment['axis'],fixed:number,a:number,b:number)=>{if(Math.abs(a-b)>EPS)lines.push(segment(`${key}:${id}`,'family',axis,fixed,a,b,{familyKey:key}));};
   if(Math.abs(x-origin.x)>EPS){add('exit','v',origin.x,origin.y,exit);add('detour','h',exit,origin.x,x);}
   add('feed','v',x,Math.abs(x-origin.x)>EPS?exit:origin.y,y);
   add('rail','h',y,Math.min(x,...children.map(child=>child.x)),Math.max(x,...children.map(child=>child.x)));
   for(const child of children)add(`child-${child.id}`,'v',child.x,y,child.y);
   return lines;
  };
  if(children.length===1&&Math.abs(x-origin.x)<EPS&&Math.abs(x-children[0].x)<EPS){
   return {route,choices:[{y:bottom,lines:[segment(`${key}:direct`,'family','v',x,origin.y,bottom,{familyKey:key})]}],index:0};
  }
  const choices=[28,36,20,44,52,12,60,68,76].map(offset=>bottom-offset).filter(y=>y>Math.max(origin.y,exit)+3);
  return {route,choices:(choices.length?choices:[(bottom+Math.max(origin.y,exit))/2]).map(y=>({y,lines:make(y)})),index:0};
 });
 // Revisit every family's lane against its neighbours. Prefer the compact
 // position only after counting crossings and overlapping horizontal runs.
 function cost(lines:Segment[],others:Segment[]){let value=0;for(const a of lines)for(const b of others)value+=conflict(a,b);return value;}
 for(let pass=0;pass<4;pass++){
  let changed=false;
  for(const row of pass%2?[...rows].reverse():rows){
   if(row.choices.length<2)continue;
   const others=[...pairs,...rows.filter(other=>other!==row).flatMap(other=>other.choices[other.index].lines)];
   const score=(i:number)=>cost(row.choices[i].lines,others)*100+i;
   let best=row.index,bestScore=score(best);
   row.choices.forEach((_,i)=>{const value=score(i);if(value<bestScore){best=i;bestScore=value;}});
   if(best!==row.index){row.index=best;changed=true;}
  }
  if(!changed)break;
 }
 const lines=[...pairs,...rows.flatMap(row=>row.choices[row.index].lines)],horizontal=lines.filter(line=>line.axis==='h'),vertical=lines.filter(line=>line.axis==='v');
 const intersections=horizontal.flatMap(h=>vertical.flatMap(v=>{const hit=crossing(h,v);return hit?[hit]:[];}));
 const cuts=new Map<string,Cut[]>(),bridges:Bridge[]=[];
 function cut(id:string,area:Cut){const previous=cuts.get(id)??[];previous.push(area);cuts.set(id,previous);}
 for(const {h,v,x,y} of intersections){
  const neighbours=intersections.filter(c=>c.h===h&&Math.abs(c.x-x)>EPS).map(c=>Math.abs(c.x-x)/2-1);
  const radius=Math.min(13,x-h.min,h.max-x,...neighbours);
  if(radius<=EPS)continue;
  const clearance=(direction:number)=>Math.min(15,...horizontal.filter(line=>line!==h&&line.min<x+radius&&line.max>x-radius&&(line.fixed-y)*direction>EPS).map(line=>Math.abs(line.fixed-y)));
  const above=clearance(-1),below=clearance(1),direction=above>=below?-1:1,rise=Math.min(9,radius*.78,(direction<0?above:below)*.65);
  cut(h.id,{x:x-radius,y:y-3,width:radius*2,height:6});
  const endY=y+direction*rise;
  cut(v.id,{x:x-3,y:Math.min(y,endY)-2,width:6,height:rise+4});
  bridges.push({id:`${h.id}:${v.id}`,over:h,d:`M ${x-radius} ${y} C ${x-radius/2} ${y+direction*rise*4/3} ${x+radius/2} ${y+direction*rise*4/3} ${x+radius} ${y}`});
 }
 return {lines,cuts,bridges};
}
