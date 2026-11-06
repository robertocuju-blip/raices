import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync('app/globals.css','utf8');
const luminance=hex=>{const rgb=hex.match(/[a-f\d]{2}/gi).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const [background,texts] of [['f5c8d9',['502037','633047','73374f']],['bcd8f2',['173e61','254c6c','305676']]])for(const color of texts){const value=contrast(background,color);assert.ok(value>=4.5);assert.ok(css.includes('#'+background)&&css.includes('#'+color));console.log('Contraste de ficha '+value.toFixed(2)+':1');}
