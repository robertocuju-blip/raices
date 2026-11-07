import assert from 'node:assert/strict';
import {fitTreeZoom} from './lib/tree-view.ts';
import {clampZoom,pinchScale} from './lib/gestures.ts';
for(const [width,height] of [[256,220],[2200,700],[220000,4000],[800,100000]]){
 for(const [availableWidth,availableHeight] of [[350,620],[1100,600],[200,180]]){
  const zoom=fitTreeZoom(width,height,availableWidth,availableHeight);
  assert.ok(width*zoom<=availableWidth+.001);
  assert.ok(height*zoom<=availableHeight+.001);
  assert.equal(clampZoom(zoom),zoom,'Pinching must preserve full-tree scales');
  assert.equal(pinchScale(zoom,100,200),zoom*2);
 }
}
console.log('Encuadre completo en móvil y escritorio, incluidos árboles que necesitan una escala inferior al 10 %.');
