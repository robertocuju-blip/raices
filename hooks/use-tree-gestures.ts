'use client';
import {useEffect,useLayoutEffect,useRef,type RefObject,type Dispatch,type SetStateAction,type PointerEvent as ReactPointerEvent,type MouseEvent as ReactMouseEvent} from 'react';
import {TreeGesture,anchorDelta,clampZoom,treePoint,type Point,type GestureContext} from '../lib/gestures';
export function useTreeGestures(viewport:RefObject<HTMLDivElement|null>,zoom:number,setZoom:Dispatch<SetStateAction<number>>,enabled:boolean){
 const tracker=useRef(new TreeGesture()),currentZoom=useRef(zoom),pendingAnchor=useRef<{anchor:Point;target:Point}|null>(null);currentZoom.current=zoom;
 const context=():GestureContext=>{const el=viewport.current!,graph=el.querySelector<HTMLElement>('.graph'),rect=(graph??el).getBoundingClientRect();return {zoom:currentZoom.current,left:el.scrollLeft,top:el.scrollTop,graphLeft:rect.left,graphTop:rect.top};};
 const applyAnchor=()=>{const el=viewport.current,anchor=pendingAnchor.current;if(!el||!anchor)return;const rect=el.querySelector<HTMLElement>('.graph')?.getBoundingClientRect();if(!rect)return;const delta=anchorDelta(anchor.anchor,anchor.target,rect.left,rect.top,currentZoom.current);el.scrollLeft+=delta.x;el.scrollTop+=delta.y;pendingAnchor.current=null;};
 const changeZoom=(next:number,anchor:Point,target:Point)=>{pendingAnchor.current={anchor,target};const value=clampZoom(next);if(Math.abs(value-currentZoom.current)<.00001)applyAnchor();else setZoom(value);};
 useLayoutEffect(applyAnchor,[zoom]);
 useEffect(()=>{
  const el=viewport.current;if(!el||!enabled)return;
  const wheel=(e:WheelEvent)=>{if(!e.ctrlKey)return;e.preventDefault();const target={x:e.clientX,y:e.clientY};changeZoom(currentZoom.current*Math.exp(-e.deltaY*.006),treePoint(target,context()),target);};
  let safariZoom:number|null=null;type SafariGesture=Event&{scale?:number;clientX?:number;clientY?:number};
  const gestureStart=(e:SafariGesture)=>{e.preventDefault();safariZoom=currentZoom.current;};
  const gestureChange=(e:SafariGesture)=>{e.preventDefault();if(tracker.current.points.size>=2||safariZoom===null||!e.scale)return;const rect=el.getBoundingClientRect(),target={x:e.clientX??rect.left+rect.width/2,y:e.clientY??rect.top+rect.height/2};changeZoom(safariZoom*e.scale,treePoint(target,context()),target);};
  const gestureEnd=()=>{safariZoom=null;};
  el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('gesturestart',gestureStart,{passive:false});el.addEventListener('gesturechange',gestureChange,{passive:false});el.addEventListener('gestureend',gestureEnd);
  return()=>{el.removeEventListener('wheel',wheel);el.removeEventListener('gesturestart',gestureStart);el.removeEventListener('gesturechange',gestureChange);el.removeEventListener('gestureend',gestureEnd);};
 },[enabled]);
 return {
  onPointerDown:(e:ReactPointerEvent<HTMLDivElement>)=>{if(!enabled||e.button>0)return;tracker.current.begin(e.pointerId,{x:e.clientX,y:e.clientY},context());if(!(e.target as Element).closest('button')||tracker.current.points.size>=2){for(const id of tracker.current.points.keys())try{e.currentTarget.setPointerCapture(id);}catch{}}},
  onPointerMove:(e:ReactPointerEvent<HTMLDivElement>)=>{if(!enabled)return;const result=tracker.current.move(e.pointerId,{x:e.clientX,y:e.clientY},context());if(!result)return;try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}if(result.kind==='pan'){e.currentTarget.scrollLeft=result.left;e.currentTarget.scrollTop=result.top;}else changeZoom(result.zoom,result.anchor,result.target);},
  onPointerUp:(e:ReactPointerEvent<HTMLDivElement>)=>{if(!enabled)return;tracker.current.end(e.pointerId,context());},
  onPointerCancel:(e:ReactPointerEvent<HTMLDivElement>)=>{tracker.current.end(e.pointerId,context());},
  onClickCapture:(e:ReactMouseEvent<HTMLDivElement>)=>{if(tracker.current.moved&&e.detail!==0){e.preventDefault();e.stopPropagation();}},
 };
}
