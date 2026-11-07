import type {TreeConnection} from './family.ts';

type Point={x:number;y:number};
export type Crossing={point:Point;over:TreeConnection};
const midpoint=(a:Point,b:Point)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const distanceSquared=(a:Point,b:Point)=>(a.x-b.x)**2+(a.y-b.y)**2;
function distanceToSegment(p:Point,a:Point,b:Point){
 const length=distanceSquared(a,b);
 if(!length)return distanceSquared(p,a);
 const t=Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/length));
 return distanceSquared(p,{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});
}
function outline(d:string){
 // These are the three commands emitted by the tree renderer: M, H and C.
 const tokens=d.match(/[MHC]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)??[];
 let i=1;const point=()=>({x:Number(tokens[i++]),y:Number(tokens[i++])});
 const points=[point()];
 function append(a:Point,b:Point,c:Point,d:Point,depth=0){
  if(depth===12||Math.max(distanceToSegment(b,a,d),distanceToSegment(c,a,d))<=.0625){points.push(d);return;}
  const ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,d),abc=midpoint(ab,bc),bcd=midpoint(bc,cd),mid=midpoint(abc,bcd);
  append(a,ab,abc,mid,depth+1);append(mid,bcd,cd,d,depth+1);
 }
 while(i<tokens.length){
  const command=tokens[i++],start=points.at(-1)!;
  if(command==='H')points.push({x:Number(tokens[i++]),y:start.y});
  else if(command==='C')append(start,point(),point(),point());
 }
 return points;
}
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
function intersection(a:Point,b:Point,c:Point,d:Point):Point|null{
 const u={x:b.x-a.x,y:b.y-a.y},v={x:d.x-c.x,y:d.y-c.y},w={x:c.x-a.x,y:c.y-a.y},den=cross(u,v);
 if(Math.abs(den)<1e-8)return null;
 const t=cross(w,v)/den,s=cross(w,u)/den;
 if(t<0||t>1||s<0||s>1)return null;
 return {x:a.x+t*u.x,y:a.y+t*u.y};
}

// Draw a short overpass only at actual crossings, not at joined endpoints.
export function connectionCrossings(connections:TreeConnection[]):Crossing[]{
 const paths=connections.map((connection,order)=>{
  const points=outline(connection.d),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  return {connection,order,points,ends:[points[0],points.at(-1)!],left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
 }).sort((a,b)=>a.left-b.left);
 const marks:{point:Point;order:number;over:TreeConnection}[]=[];
 for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){
  const a=paths[i],b=paths[j];
  if(b.left>a.right)break;
  if(a.bottom<b.top||b.bottom<a.top||a.connection.familyKey&&a.connection.familyKey===b.connection.familyKey)continue;
  const over=a.connection.kind!==b.connection.kind?(a.connection.kind==='couple'?a:b):(a.order>b.order?a:b);
  for(let k=1;k<a.points.length;k++)for(let l=1;l<b.points.length;l++){
   const point=intersection(a.points[k-1],a.points[k],b.points[l-1],b.points[l]);
   if(!point||[...a.ends,...b.ends].some(end=>distanceSquared(end,point)<1))continue;
   if(!marks.some(mark=>mark.over===over.connection&&distanceSquared(mark.point,point)<1))marks.push({point,order:over.order,over:over.connection});
  }
 }
 return marks.sort((a,b)=>a.order-b.order).map(({point,over})=>({point,over}));
}
