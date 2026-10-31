/* ---------- engines ----------
   Stockfish 18 (WASM, served by the Rookery server) with the built-in engine as a fallback.
   Every search resolves to {best, pv:[uci], scoreW, mateW, depth, lines:[{pv,scoreW,mateW}], term}. */
var SF_URL='engine/stockfish-18-lite-single.js';
var SF_STATE=window.ROOKERY_ONLINE?'unknown':'off'; // unknown | ok | off
function SFEngine(name){this.name=name;this.w=null;this.ready=null;this.cur=null;this.pending=null;this.opts={};}
SFEngine.prototype.init=function(){var self=this;if(this.ready)return this.ready;
  this.ready=new Promise(function(res,rej){
    if(SF_STATE==='off'){rej(new Error('off'));return;}
    var w;try{w=new Worker(SF_URL);}catch(e){SF_STATE='off';rej(e);return;}
    var to=setTimeout(function(){SF_STATE='off';try{w.terminate();}catch(e){}rej(new Error('timeout'));},20000);
    w.onerror=function(e){clearTimeout(to);SF_STATE='off';rej(e);};
    w.onmessage=function(e){var l=String(e.data);
      if(l==='uciok'){w.postMessage('setoption name Hash value 16');w.postMessage('isready');return;}
      if(l==='readyok'&&!self.w){clearTimeout(to);self.w=w;SF_STATE='ok';w.onmessage=function(ev){self.line(String(ev.data));};res();}};
    w.postMessage('uci');});
  return this.ready;};
SFEngine.prototype.setOpt=function(k,v){if(this.opts[k]===v)return;this.opts[k]=v;this.w.postMessage('setoption name '+k+' value '+v);};
SFEngine.prototype.go=function(p,onInfo){var self=this;
  return this.init().then(function(){return new Promise(function(res){
    var job={p:p,onInfo:onInfo,res:res,lines:[],depth:0,last:0};
    if(self.pending)self.pending.res(null);
    self.pending=job;
    if(self.cur){if(!self.cur.stopping){self.cur.stopping=true;self.w.postMessage('stop');}}
    else self.next();});});};
SFEngine.prototype.next=function(){var j=this.pending;if(!j)return;this.pending=null;this.cur=j;var p=j.p,w=this.w;
  var pos=new Pos(p.fen);(p.moves||[]).forEach(function(u){var m=pos.parseUci(u);if(m)pos.make(m);});
  j.turn=pos.turn;j.fen=pos.fen();
  var st=pos.status();
  if(st.over){this.cur=null;var chk=st.reason==='checkmate';j.res({best:null,pv:[],scoreW:chk?(pos.turn===0?-10000:10000):0,mateW:0,depth:0,lines:[],term:chk?'mate':'stalemate'});this.next();return;}
  this.setOpt('MultiPV',p.multipv||1);
  if(p.elo){this.setOpt('UCI_LimitStrength','true');this.setOpt('UCI_Elo',Math.max(1320,Math.min(3190,p.elo)));}
  else this.setOpt('UCI_LimitStrength','false');
  w.postMessage('position fen '+p.fen+((p.moves&&p.moves.length)?' moves '+p.moves.join(' '):''));
  var g='go';if(p.depth)g+=' depth '+p.depth;if(p.timeMs)g+=' movetime '+Math.round(p.timeMs);if(!p.depth&&!p.timeMs)g+=' movetime 1000';
  w.postMessage(g);};
SFEngine.prototype.line=function(l){var j=this.cur;if(!j)return;
  if(l.lastIndexOf('info ',0)===0&&l.indexOf(' pv ')>0){
    var t=l.split(' '),d=0,mp=1,cp=null,mate=null,pv=[];
    for(var i=1;i<t.length;i++){var k=t[i];
      if(k==='depth')d=+t[++i];else if(k==='multipv')mp=+t[++i];
      else if(k==='score'){var ty=t[++i],v=+t[++i];if(ty==='cp')cp=v;else mate=v;if(t[i+1]==='lowerbound'||t[i+1]==='upperbound')i++;}
      else if(k==='pv'){pv=t.slice(i+1);break;}}
    var sg=j.turn===0?1:-1,ln={pv:pv,depth:d};
    if(mate!=null){ln.mateW=mate*sg;ln.scoreW=(mate>0?1:-1)*sg*(10000-Math.abs(mate)*10);if(mate===0){ln.mateW=0;}}
    else{ln.mateW=0;ln.scoreW=cp*sg;}
    j.lines[mp-1]=ln;if(mp===1)j.depth=d;
    var t2=now();if(j.onInfo&&!j.stopping&&t2-j.last>120&&mp===(j.p.multipv||1)){j.last=t2;j.onInfo(this.pack(j));}
    return;}
  if(l.lastIndexOf('bestmove',0)===0){var b=l.split(' ')[1];this.cur=null;
    if(j.stopping&&this.pending){j.res(null);}else{var r=this.pack(j);if(b&&b!=='(none)')r.best=b;j.res(r);}
    if(this.pending)this.next();}};
SFEngine.prototype.pack=function(j){var L=j.lines.filter(Boolean),f=L[0]||{pv:[],scoreW:0,mateW:0};
  return {best:f.pv[0]||null,pv:f.pv,scoreW:f.scoreW,mateW:f.mateW,depth:j.depth,lines:L.map(function(x){return {pv:x.pv,scoreW:x.scoreW,mateW:x.mateW};}),fen:j.fen};};
SFEngine.prototype.cancel=function(){if(this.pending){this.pending.res(null);this.pending=null;}if(this.cur&&!this.cur.stopping){this.cur.stopping=true;this.cur.cancelled=true;this.w.postMessage('stop');}
  var c=this.cur;if(c){var r=c.res;c.res=function(){r(null);};}};

/* built-in engine in a worker (also the fallback) */
var WURL=null;
try{WURL=URL.createObjectURL(new Blob([document.getElementById('core').textContent+'\n;('+workerMain.toString()+')();'],{type:'text/javascript'}));}catch(e){WURL=null;}
function workerMain(){onmessage=function(e){var d=e.data,r;try{var p=new Pos(d.fen);(d.moves||[]).forEach(function(u){var m=p.parseUci(u);if(m)p.make(m);});r=think(p,Object.assign({},d,{onInfo:function(i){postMessage(Object.assign({id:d.id,type:'info'},i));}}));}catch(err){r={error:String(err)};}postMessage(Object.assign({id:d.id,type:'done'},r));};}
function LocalEngine(){this.seq=0;this.res=null;this.spawn();}
LocalEngine.prototype.spawn=function(){var self=this;this.w=null;if(!WURL)return;try{this.w=new Worker(WURL);this.w.onmessage=function(e){self.msg(e.data);};this.w.onerror=function(){self.w=null;};}catch(e){this.w=null;}};
LocalEngine.prototype.norm=function(d){if(!d)return null;return {best:d.best,pv:d.pv||[],scoreW:d.scoreW,mateW:d.mateW||0,depth:d.depth,term:d.term,lines:[{pv:d.pv||[],scoreW:d.scoreW,mateW:d.mateW||0}]};};
LocalEngine.prototype.msg=function(d){if(d.id!==this.seq)return;if(d.type==='info'){if(this.onInfo)this.onInfo(this.norm(d));}else{var r=this.res;this.res=null;if(r)r(d.error?null:this.norm(d));}};
LocalEngine.prototype.go=function(p,onInfo){var self=this;this.cancel();var id=++this.seq;this.onInfo=onInfo;
  return new Promise(function(res){self.res=res;
    if(self.w)self.w.postMessage(Object.assign({},p,{id:id}));
    else setTimeout(function(){if(id!==self.seq)return;var r=null;try{var pos=new Pos(p.fen);(p.moves||[]).forEach(function(u){var m=pos.parseUci(u);if(m)pos.make(m);});r=self.norm(think(pos,p));}catch(e){}var f=self.res;self.res=null;if(f)f(r);},20);});};
LocalEngine.prototype.cancel=function(){if(this.res){var r=this.res;this.res=null;this.seq++;if(this.w){this.w.terminate();this.spawn();}r(null);}};

/* facade: tries Stockfish first, falls back silently */
function Brain(name){this.sf=new SFEngine(name);this.lo=new LocalEngine();this.last=null;}
Brain.prototype.go=function(p,onInfo){var self=this;
  if(SF_STATE==='off')return this.useLocal(p,onInfo);
  this.last='sf';
  return this.sf.go(p,onInfo).catch(function(){return self.useLocal(p,onInfo);});};
Brain.prototype.useLocal=function(p,onInfo){this.last='local';var q=Object.assign({},p);
  if(p.local)Object.assign(q,p.local);else{q.timeMs=Math.min(p.timeMs||1500,4000);q.maxDepth=p.depth||40;}
  if(q.analysis==null)q.analysis=!!p.multipv;return this.lo.go(q,onInfo);};
Brain.prototype.cancel=function(){try{this.sf.cancel();}catch(e){}this.lo.cancel();};
var eng={play:new Brain('play'),ana:new Brain('ana'),rev:new Brain('rev')};eng.misc=eng.play;
function engineName(){return SF_STATE==='ok'?'Stockfish 18':SF_STATE==='unknown'?'Engine':'Rookery engine';}
