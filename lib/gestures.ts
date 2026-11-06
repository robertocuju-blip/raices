export type Point={x:number;y:number};
export type GestureContext={zoom:number;left:number;top:number;graphLeft:number;graphTop:number};
export type GestureChange={kind:'pan';left:number;top:number}|{kind:'zoom';zoom:number;anchor:Point;target:Point};
export const clampZoom=(zoom:number)=>Math.max(.1,Math.min(3,zoom));
export function pinchScale(zoom:number,startDistance:number,distance:number){return startDistance>0?clampZoom(zoom*distance/startDistance):zoom;}
export function treePoint(screen:Point,context:GestureContext):Point{return {x:(screen.x-context.graphLeft)/context.zoom,y:(screen.y-context.graphTop)/context.zoom};}
export function anchorDelta(anchor:Point,target:Point,left:number,top:number,zoom:number):Point{return {x:left+anchor.x*zoom-target.x,y:top+anchor.y*zoom-target.y};}
export class TreeGesture{
 points=new Map<number,Point>();moved=false;
 private pan:{point:Point;left:number;top:number}|null=null;
 private pinch:{distance:number;zoom:number;anchor:Point}|null=null;
 private rebasePinch(context:GestureContext){const [a,b]=[...this.points.values()];if(!a||!b)return;const distance=Math.hypot(a.x-b.x,a.y-b.y);if(distance<4)return;const target={x:(a.x+b.x)/2,y:(a.y+b.y)/2};this.pinch={distance,zoom:context.zoom,anchor:treePoint(target,context)};}
 begin(id:number,point:Point,context:GestureContext){if(!this.points.size){this.moved=false;this.pinch=null;this.pan={point,left:context.left,top:context.top};}this.points.set(id,point);if(this.points.size>=2){this.moved=true;this.rebasePinch(context);}}
 move(id:number,point:Point,context:GestureContext):GestureChange|null{
  if(!this.points.has(id))return null;this.points.set(id,point);
  if(this.points.size>=2){if(!this.pinch){this.rebasePinch(context);return null;}const [a,b]=[...this.points.values()];return {kind:'zoom',zoom:pinchScale(this.pinch.zoom,this.pinch.distance,Math.hypot(a.x-b.x,a.y-b.y)),anchor:this.pinch.anchor,target:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};}
  if(!this.pan)return null;const dx=point.x-this.pan.point.x,dy=point.y-this.pan.point.y;if(!this.moved&&Math.hypot(dx,dy)<5)return null;this.moved=true;return {kind:'pan',left:this.pan.left-dx,top:this.pan.top-dy};
 }
 end(id:number,context:GestureContext){this.points.delete(id);this.pinch=null;if(this.points.size>=2)this.rebasePinch(context);else if(this.points.size===1)this.pan={point:[...this.points.values()][0],left:context.left,top:context.top};else this.pan=null;}
}
