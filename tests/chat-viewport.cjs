const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const events={},styles={},classes=new Set(['psl-chat-page']);let frames=[],editing=false;
const on=(name,fn)=>{(events[name]??=[]).push(fn);};
const viewport={height:844,offsetTop:0,scale:1,addEventListener:(name,fn)=>on('vv:'+name,fn)};
const window={innerHeight:844,innerWidth:390,visualViewport:viewport,matchMedia:()=>({matches:window.innerWidth<=760}),addEventListener:on,dispatchEvent:event=>(events[event.type]||[]).forEach(fn=>fn(event))};
const document={body:{classList:{contains:c=>classes.has(c),toggle:(c,value)=>value?classes.add(c):classes.delete(c)}},documentElement:{style:{setProperty:(name,value)=>styles[name]=value}},activeElement:{matches:()=>editing},addEventListener:(name,fn)=>on('doc:'+name,fn)};
const context={window,document,CustomEvent:class{constructor(type,props){this.type=type;this.detail=props.detail;}},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;}};
vm.runInNewContext(fs.readFileSync('frontend/assets/js/site-nav.js','utf8'),context);
function flush(){const batch=frames;frames=[];batch.forEach(fn=>fn());}
function event(type){(events[type]||[]).forEach(fn=>fn());flush();}
flush();assert.equal(styles['--psl-viewport-height'],'844px');assert(!classes.has('psl-keyboard-open'));
editing=true;viewport.height=480;viewport.offsetTop=12;event('vv:resize');assert(classes.has('psl-keyboard-open'));assert.equal(styles['--psl-viewport-top'],'12px');
editing=false;event('doc:focusout');assert(classes.has('psl-keyboard-open'),'dock must not flash during keyboard dismissal');
viewport.height=844;viewport.offsetTop=0;event('vv:resize');assert(!classes.has('psl-keyboard-open'));
editing=true;window.innerHeight=480;viewport.height=480;event('resize');assert(classes.has('psl-keyboard-open'),'Android resize-content keyboard');
editing=false;window.innerHeight=844;viewport.height=844;event('resize');assert(!classes.has('psl-keyboard-open'));
viewport.scale=1.5;viewport.height=400;event('vv:resize');assert.equal(styles['--psl-viewport-height'],'844px');assert(!classes.has('psl-keyboard-open'),'pinch is not keyboard');
viewport.scale=1;window.innerWidth=844;window.innerHeight=390;viewport.height=390;event('resize');assert(!classes.has('psl-keyboard-open'));assert.equal(styles['--psl-viewport-height'],'390px');
console.log('PASS viewport: iOS offset, dismissal hysteresis, Android resize, pinch zoom and orientation');
