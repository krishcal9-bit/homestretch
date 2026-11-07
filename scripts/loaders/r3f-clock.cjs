// webpack loader: R3F 9 builds its frame clock with `new THREE.Clock()`, which three r183+ deprecates (a console
// warning on every canvas). At build time, swap it for a Clock-compatible wrapper around THREE.Timer with the
// fields R3F reads and writes (elapsedTime, oldTime, running; start/stop/getDelta/getElapsedTime).
// node_modules are left untouched; see next.config.ts.
const SHIM =
  '(function(){var T=new THREE.Timer();var c={autoStart:true,startTime:0,oldTime:0,elapsedTime:0,running:false,' +
  'start:function(){if(T.reset)T.reset();T.update();c.startTime=performance.now();c.oldTime=c.startTime;c.elapsedTime=0;c.running=true},' +
  'stop:function(){c.getElapsedTime();c.running=false;c.autoStart=false},' +
  'getElapsedTime:function(){c.getDelta();return c.elapsedTime},' +
  'getDelta:function(){if(c.autoStart&&!c.running){c.start();return 0}if(!c.running)return 0;T.update();var d=T.getDelta();c.oldTime=performance.now();c.elapsedTime+=d;return d}};return c})()';

module.exports = function r3fClock(source) {
  return source.includes('new THREE.Clock()') ? source.split('new THREE.Clock()').join(SHIM) : source;
};
