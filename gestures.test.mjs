import assert from 'node:assert/strict';
import {TreeGesture,pinchScale,treePoint,anchorDelta} from './lib/gestures.ts';
const context={zoom:1,left:100,top:200,graphLeft:20,graphTop:30};
assert.equal(pinchScale(1,100,150),1.5);assert.equal(pinchScale(1,100,50),.5);assert.equal(pinchScale(1,0,50),1);assert.equal(pinchScale(1,100,1000),3);
const gesture=new TreeGesture();gesture.begin(1,{x:100,y:200},context);assert.equal(gesture.move(1,{x:102,y:202},context),null);assert.equal(gesture.moved,false);assert.deepEqual(gesture.move(1,{x:130,y:240},context),{kind:'pan',left:70,top:160});assert.equal(gesture.moved,true);gesture.end(1,context);
gesture.begin(1,{x:100,y:200},context);assert.equal(gesture.moved,false);gesture.begin(2,{x:200,y:200},context);const pinch=gesture.move(2,{x:300,y:200},context);assert.equal(pinch.kind,'zoom');assert.equal(pinch.zoom,2);assert.deepEqual(pinch.anchor,treePoint({x:150,y:200},context));assert.deepEqual(pinch.target,{x:200,y:200});assert.equal(gesture.moved,true);
const delta=anchorDelta(pinch.anchor,pinch.target,20,30,pinch.zoom);assert.equal(20+pinch.anchor.x*pinch.zoom-delta.x,pinch.target.x);assert.equal(30+pinch.anchor.y*pinch.zoom-delta.y,pinch.target.y);
gesture.end(2,{...context,left:170,top:260,zoom:2});assert.deepEqual(gesture.move(1,{x:110,y:220},{...context,left:170,top:260,zoom:2}),{kind:'pan',left:160,top:240});gesture.end(1,context);assert.equal(gesture.points.size,0);
console.log('Pellizco, límites de escala, punto de anclaje, arrastre y transición entre uno y dos dedos comprobados.');
