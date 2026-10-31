/* ---------- state ---------- */
var ONLINE=!!window.ROOKERY_ONLINE;
var settings=Object.assign({board:'walnut',pieces:'staunty',sound:true,legal:true,coords:true,anim:true,autoQueen:false,premove:true,autoFlip:false,evalInGame:false,confirm:true,name:'You'},store.get('settings',{}));
if(!settings.pv4){settings.pieces='staunty';settings.pv4=true;}
var profile=Object.assign({rating:800,peak:800,games:[],w:0,l:0,d:0,puzzle:1200,pzSolved:0,pzStreak:0,pzBest:0,pzSeen:[],hist:[]},store.get('profile',{}));
var setup=Object.assign({tab:ONLINE?'online':'bot',bot:2,color:'w',tc:'5+0',btc:'none'},store.get('setup',{}));
if(!BOTS[setup.bot])setup.bot=2;
function saveAll(){store.set('settings',settings);store.set('profile',profile);store.set('setup',setup);}
var OPEN=[];
OPEN_RAW.forEach(function(o){var p=new Pos(),ucis=[],sans=o[2].split(' ');for(var i=0;i<sans.length;i++){var m=p.parseSan(sans[i]);if(!m)return;ucis.push(p.uci(m));p.make(m);}OPEN.push({eco:o[0],name:o[1],san:sans,uci:ucis});});
function openingOf(sans){var best=null;OPEN.forEach(function(o){if(o.san.length<=sans.length&&(!best||o.san.length>best.san.length)){for(var i=0;i<o.san.length;i++)if(o.san[i]!==sans[i])return;best=o;}});return best;}
function isBook(sans,i){return OPEN.some(function(o){if(o.san.length<=i)return false;for(var k=0;k<=i;k++)if(o.san[k]!==sans[k])return false;return true;});}

var NET={ws:null,ok:false,me:null,stats:{online:0,playing:0},queue:null,room:null,lb:{},live:[],friends:{list:[],incoming:[],outgoing:[]},chIn:{},chOut:{},announce:null,retry:800,pendingJoin:null,history:null,search:[]};
try{var qs0=new URLSearchParams(location.search);if(qs0.get('room'))NET.pendingJoin=qs0.get('room').toUpperCase();if(qs0.get('watch'))NET.pendingWatch=qs0.get('watch');if(qs0.get('game'))NET.pendingGame=qs0.get('game');}catch(e){}
function ttl(t){return t?'<span class="ttl">'+esc(t)+'</span>':'';}

function session(kind,fen){var p=new Pos(fen||START);return {kind:kind,pos:p,startFen:p.fen(),moves:[],fens:[p.fen()],view:0,orient:0,over:null};}
var SS={play:session('play'),analysis:session('analysis'),puzzles:null,review:null,watch:null};
SS.play.setup=true;SS.analysis.engineOn=true;SS.analysis.lines=3;
var route='home',navSeq=0;
var ROUTES=['home','play','puzzles','analysis','watch','community','profile','prefs','review'];
var BOARD_ROUTES={play:1,puzzles:1,analysis:1,review:1};
function isBoardRoute(){return BOARD_ROUTES[route]||(route==='watch'&&SS.watch&&!SS.watch.left);}
function cur(){if(route==='watch')return SS.watch;return SS[route]||SS.play;}
function viewPos(S){if(S.view===S.moves.length)return S.pos;if(!S._vp||S._vpi!==S.view){S._vp=new Pos(S.fens[S.view]);S._vpi=S.view;}return S._vp;}
function sans(S,n){return S.moves.slice(0,n==null?S.moves.length:n).map(function(m){return m.san;});}
function myName(){return NET.me?NET.me.name:(settings.name||'You');}
function myAvatar(){return NET.me?NET.me.avatar:(store.get('avatar',{p:'n',c:3}));}

function doMove(S,m,dragged,silent){
  var P=S.pos,lg=P.legal(),san=P.san(m,lg),f=m&63,t=(m>>6)&63,fl=m>>15,capSq=(fl&2)?t+(P.turn===0?8:-8):t,cap=(fl&1)?P.b[capSq]:0,color=P.turn,u=P.uci(m);
  P.make(m);
  var e={m:m,uci:u,san:san,color:color,cap:cap,from:f,to:t};
  S.moves.push(e);S.fens.push(P.fen());S.view=S.moves.length;S._vp=null;
  S._anim=dragged?null:{m:m,cap:cap,capSq:capSq};
  if(!silent){if(P.inCheck())sfx('check');else if(fl&4)sfx('castle');else if(cap)sfx('capture');else sfx('move');}
  if(S.startFen===START)S.opening=openingOf(sans(S))||S.opening;
  return e;}
function undoMove(S){if(!S.moves.length)return;S.pos.unmake();S.moves.pop();S.fens.pop();S.view=S.moves.length;S._vp=null;if(S.startFen===START)S.opening=openingOf(sans(S));}
function setView(S,v,anim){if(!S)return;v=Math.max(0,Math.min(S.moves.length,v));if(v===S.view)return;var fwd=v===S.view+1;S.view=v;
  if(fwd&&anim!==false){var e=S.moves[v-1],fl=e.m>>15;S._anim={m:e.m,cap:e.cap,capSq:(fl&2)?e.to+(e.color===0?8:-8):e.to};var P=viewPos(S);if(P.inCheck())sfx('check');else if(e.cap)sfx('capture');else sfx('move');}
  renderBoard();updatePanel();}

/* ---------- online connection ---------- */
function netSend(o){if(NET.ws&&NET.ws.readyState===1){NET.ws.send(JSON.stringify(o));return true;}toast('Not connected to the server. Reconnecting…');return false;}
function netConnect(){if(!ONLINE)return;var ws;
  try{ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');}catch(e){return;}
  NET.ws=ws;
  ws.onopen=function(){NET.retry=800;ws.send(JSON.stringify({t:'hello',token:store.get('token',null)}));};
  ws.onmessage=function(e){var m;try{m=JSON.parse(e.data);}catch(er){return;}try{netMsg(m);}catch(er){console.error(er);}};
  ws.onclose=function(){if(NET.ws!==ws)return;var was=NET.ok;NET.ok=false;NET.queue=null;NET.room=null;
    setTimeout(netConnect,NET.retry);NET.retry=Math.min(NET.retry*1.7,10000);if(was){renderNav();refreshView();}};}
function refreshView(){if(isBoardRoute()){renderPanel();renderBars();}else renderPage();}
function netMsg(m){var S=SS.play;
  switch(m.t){
    case 'welcome':NET.ok=true;NET.me=m.me;NET.cfg=m.cfg||{};store.set('token',m.token);renderNav();refreshView();
      if(NET.pendingWatch||NET.pendingGame){if(NET.pendingWatch)netSend({t:'watch',gid:NET.pendingWatch});if(NET.pendingGame){NET.wantReview=NET.pendingGame;netSend({t:'game',id:NET.pendingGame});}NET.pendingWatch=NET.pendingGame=null;try{history.replaceState(null,'',location.pathname+location.hash);}catch(e){}}
      if(NET.pendingJoin){var code=NET.pendingJoin;NET.pendingJoin=null;netSend({t:'join',code:code});try{history.replaceState(null,'',location.pathname+location.hash);}catch(e){}}
      if(route==='watch'&&SS.watch&&!SS.watch.left&&SS.watch.gid)netSend({t:'watch',gid:SS.watch.gid});
      if(route==='home'||route==='watch')netSend({t:'live'});
      break;
    case 'auth_ok':store.set('token',m.token);NET.me=m.me;closeModal();toast(m.msg||'Signed in');renderNav();refreshView();break;
    case 'auth_error':var er=$('.modal .err');if(er)er.textContent=m.msg;else toast(m.msg);var bt=$('.modal button[type=submit]');if(bt)bt.disabled=false;break;
    case 'me':NET.me=m.me;if(SS.play.online&&SS.play.players){var mp=SS.play.players[SS.play.userColor];mp.title=m.me.title;mp.name=m.me.name;mp.avatar=m.me.avatar;}renderNav();if(!isBoardRoute())renderPage();else renderBars();break;
    case 'cfg':NET.cfg=m.cfg;if(!isBoardRoute())renderPage();else renderPanel();break;
    case 'admin_msg':sfx('notify');openModal('<h2>Message from Rookery</h2><p class="note" style="font-size:15px;color:var(--bone)">'+esc(m.text)+'</p><div class="form"><button class="btn pri" data-close>OK</button></div>');break;
    case 'banned':NET.ok=false;NET.ws=null;openModal('<h2>Disconnected</h2><p class="note">'+esc(m.msg||'This account is suspended.')+'</p>',{noclose:true});break;
    case 'stats':NET.stats=m;var el=$('#netstats');if(el)el.textContent=statsText();break;
    case 'announce':NET.announce=m.text?m:null;if(m.text&&!isBoardRoute())renderPage();if(m.text)toast(m.text,6000);break;
    case 'friends':NET.friends=m;renderNav();if(route==='community'||route==='home')renderPage();break;
    case 'friend_request':sfx('notify');toast(m.from.name+' sent you a friend request');break;
    case 'leaderboard':NET.lb[m.cat]=m.rows;if(route==='community')renderPage();break;
    case 'search':NET.search=m.rows;if(route==='community')renderSearch();break;
    case 'live':NET.live=m.games;if(route==='home'||(route==='watch'&&!isBoardRoute()))renderPage();break;
    case 'player':showPlayer(m.player);break;
    case 'history':if(m.id===(NET.me&&NET.me.id)){NET.history=m.games;if(route==='profile')renderPage();}break;
    case 'game':if(NET.wantReview===m.game.id){NET.wantReview=null;reviewRecord(m.game);}break;
    case 'queued':NET.queue=m.tc;NET.room=null;refreshView();break;
    case 'room':NET.room=m.code;NET.roomTc=m.tc;NET.queue=null;if(route!=='play')go('play');else refreshView();break;
    case 'idle':NET.queue=null;NET.room=null;refreshView();break;
    case 'challenge_in':NET.chIn[m.cid]=m;sfx('notify');showChallenge(m);renderNav();break;
    case 'challenge_out':NET.chOut[m.cid]=m;toast('Challenge sent to '+m.to.name);break;
    case 'challenge_gone':delete NET.chIn[m.cid];var o=NET.chOut[m.cid];delete NET.chOut[m.cid];var cm=$('.scrim [data-cid="'+m.cid+'"]');if(cm)closeModal(cm.closest('.scrim'));
      if(o&&m.reason==='declined')toast(o.to.name+' declined your challenge');else if(o&&m.reason==='expired')toast('Your challenge to '+o.to.name+' expired');renderNav();break;
    case 'start':onlineStart(m);break;
    case 'watch':watchStart(m);break;
    case 'move':if(S.online&&S.gid===m.gid)onlineMove(S,m);else if(SS.watch&&SS.watch.gid===m.gid)onlineMove(SS.watch,m);break;
    case 'end':if(S.online&&S.gid===m.gid)onlineEnd(S,m);else if(SS.watch&&SS.watch.gid===m.gid)watchEnd(SS.watch,m);break;
    case 'draw_offer':if(S.online&&S.active){S.drawIn=true;sfx('notify');toast(S.opp.name+' offers a draw');updatePanel();}break;
    case 'rematch_offer':if(S.online&&S.gid===m.gid){S.rematchIn=true;sfx('notify');toast(S.opp.name+' wants a rematch');updatePanel();renderOverlay();}break;
    case 'presence':var T=(S.online&&S.gid===m.gid)?S:(SS.watch&&SS.watch.gid===m.gid?SS.watch:null);if(T){var prev=T.presence;T.presence=m.online;
      if(T===S&&T.active&&prev){var oc=S.userColor^1;if(prev[oc]&&!m.online[oc])toast(S.opp.name+' disconnected. They have 60 seconds to return.',4000);else if(!prev[oc]&&m.online[oc])toast(S.opp.name+' is back');}
      if(cur()===T)renderBars();}break;
    case 'spect':if(S.online&&S.gid===m.gid){S.spect=m.n;var sc=$('#spectN');if(sc)sc.textContent=spectText(m.n);}break;
    case 'chat':{var C=(S.online&&S.gid===m.gid)?S:null;if(!C)break;(C.chat=C.chat||[]).push(m);if(m.from!==C.userColor){if(settings.sound)tone(988,.07,'sine',.05);if(C.tab!=='chat'){C.unread=(C.unread||0)+1;updateTabs();}}updateChat(C);}break;
    case 'puzzle_rating':var PZ=SS.puzzles;if(PZ&&PZ.pending){PZ.pending=false;PZ.delta=m.d;PZ.ratingAfter=m.r;updatePanel();}break;
    case 'info':toast(m.msg);break;
    case 'error':toast(m.msg);var b2=$('.modal button[type=submit]');if(b2)b2.disabled=false;break;
  }}
function statsText(){var s=NET.stats;return s.online+' online, '+s.playing+' game'+(s.playing===1?'':'s')+' in progress';}
function spectText(n){return n?n+' watching':'';}
function netName(p){return p?p.name:'?';}

function onlineStart(m){
  var old=SS.play,same=old.online&&old.gid===m.gid;
  var S=session('play');S.setup=false;S.online=true;S.gid=m.gid;S.userColor=m.color;S.orient=same?old.orient:m.color;S.presence=m.online;S.spect=m.spect;
  S.players=[m.white,m.black];S.opp=m.color?m.white:m.black;S.chat=m.chat||[];S.tab=same?old.tab:'moves';S.unread=0;S.rated=m.rated;S.cat=m.cat;
  var tc=tcParse(m.tc);S.tc=tc;S.times=m.times||[];
  m.moves.forEach(function(u){var mv=S.pos.parseUci(u);if(mv)doMove(S,mv,true,true);});S._anim=null;
  S.clock=tc.base?{t:m.clock.slice(),inc:tc.inc,last:now()}:null;
  S.active=!m.over;if(m.over){S.over=m.over;}
  if(m.drawFrom===(m.color^1))S.drawIn=true;
  NET.queue=null;NET.room=null;SS.play=S;eng.play.cancel();
  if(!same){sfx('start');if(!m.moves.length)toast('Game on. You play '+(m.color?'Black':'White'));}
  if(route!=='play')go('play');else renderAll();
  tryPremove(S);}
function onlineMove(S,m){
  if(S.moves.length>=m.n){if(S.moves[m.n-1].uci!==m.uci)return resync(S);}
  else if(S.moves.length===m.n-1){var mv=S.pos.parseUci(m.uci);if(!mv)return resync(S);var atEnd=S.view===S.moves.length;doMove(S,mv,false,!atEnd&&cur()===S);if(!atEnd){S.view=S.moves.length-1;}}
  else return resync(S);
  (S.times=S.times||[])[m.n-1]=m.clock[(m.n-1)%2===0?0:1];
  if(S.clock){S.clock.t=m.clock.slice();S.clock.last=now();}
  S.drawIn=false;S.armDraw=false;S.lowWarned=false;
  if(cur()===S){renderBoard();updatePanel();}
  if(S.kind==='play')tryPremove(S);}
function resync(S){if(S.kind==='watch')netSend({t:'watch',gid:S.gid});else netSend({t:'sync'});}
function onlineEnd(S,m){
  S.active=false;S.armDraw=S.armResign=false;S.drawIn=false;S.premove=null;board.premove=null;
  if(m.result==='aborted'){S.over={result:'*',reason:'aborted'};S.aborted=true;toast('Game aborted. Ratings are unchanged.');renderAll();return;}
  S.over={result:m.result,reason:m.reason};S.showResult=true;
  var r=m.ratings[S.userColor];S.rBefore=r[0];S.rAfter=r[1];S.delta=r[1]-r[0];
  var score=m.result==='1/2-1/2'?.5:(((m.result==='1-0')===(S.userColor===0))?1:0);S.score=score;
  S.rec={id:S.gid,online:true,startFen:S.startFen,moves:S.moves.map(function(x){return x.uci;}),result:m.result,reason:m.reason,userColor:S.userColor,tc:S.tc.key,
    players:[{name:S.players[0].name,avatar:S.players[0].avatar,rating:S.players[0].rating},{name:S.players[1].name,avatar:S.players[1].avatar,rating:S.players[1].rating}],date:Date.now()};
  sfx(score===1?'win':'end');renderAll();}
function watchStart(m){
  if(SS.watch&&SS.watch.gid!==m.gid&&!SS.watch.left)netSend({t:'unwatch'});
  var S=session('watch');S.gid=m.gid;S.players=[m.white,m.black];S.userColor=-1;S.orient=0;S.presence=m.online;S.spect=m.spect;S.rated=m.rated;
  var tc=tcParse(m.tc);S.tc=tc;S.times=m.times||[];
  m.moves.forEach(function(u){var mv=S.pos.parseUci(u);if(mv)doMove(S,mv,true,true);});S._anim=null;
  S.clock=tc.base?{t:m.clock.slice(),inc:tc.inc,last:now()}:null;S.active=!m.over;if(m.over)S.over=m.over;
  SS.watch=S;if(route!=='watch')go('watch');else renderAll();}
function watchEnd(S,m){S.active=false;S.over={result:m.result,reason:m.reason};S.endRatings=m.ratings;sfx('end');if(cur()===S)renderAll();}

/* ---------- DOM ---------- */
var board,stageEl,pageEl,panel,evalbar;
function layout(){
  if(!isBoardRoute())return;
  var mob=innerWidth<=900,S=cur(),ev=showEval(S),bs,main=$('#main');
  evalbar.hidden=!ev;
  if(mob){var vw=Math.min(innerWidth,document.documentElement.clientWidth||9999,(screen&&screen.width)||9999);bs=Math.min(vw-24-(ev?28:0),640);}
  else{var h=main.clientHeight-40-2*48-16,w=main.clientWidth-56-388-24-(ev?28:0);bs=Math.min(h,w,880);}
  bs=Math.max(240,Math.floor(bs/8)*8);
  document.documentElement.style.setProperty('--bs',bs+'px');
  document.documentElement.style.setProperty('--ph',(bs+2*48+16)+'px');}
function applyTheme(){var t=BOARDS[settings.board]||BOARDS.walnut,r=document.documentElement.style;r.setProperty('--light',t.l);r.setProperty('--dark',t.d);r.setProperty('--mv',settings.anim?'.17s':'0s');loadPieces(settings.pieces);}

/* ---------- navigation ---------- */
function badgeCount(){return Object.keys(NET.chIn).length+(NET.friends.incoming||[]).length;}
function renderNav(){
  var items=[['home','Home',I.home],['play','Play',I.play],['puzzles','Puzzles',I.puzzle],['analysis','Analysis',I.analysis],['watch','Watch',I.watch],['community','Community',I.community],['profile','Profile',I.profile],['prefs','Settings',I.prefs]];
  var bc=badgeCount();
  function on(k){return route===k||(route==='review'&&k==='play');}
  $('#nav').innerHTML=items.map(function(x){return '<a href="#'+x[0]+'" class="'+(on(x[0])?'on':'')+'"'+(on(x[0])?' aria-current="page"':'')+' title="'+x[1]+'">'+x[2]+'<span>'+x[1]+'</span>'+(x[0]==='community'&&bc?'<i class="dot">'+bc+'</i>':'')+'</a>';}).join('');
  var tb=[['home','Home',I.home],['play','Play',I.play],['puzzles','Puzzles',I.puzzle],['community','Social',I.community],['profile','Profile',I.profile]];
  $('#tabbar').innerHTML=tb.map(function(x){return '<a href="#'+x[0]+'" class="'+(on(x[0])||(x[0]==='profile'&&route==='prefs')||(x[0]==='home'&&route==='watch')||(x[0]==='play'&&route==='analysis')?'on':'')+'">'+x[2]+'<span>'+x[1]+'</span>'+(x[0]==='community'&&bc?'<i class="dot"></i>':'')+'</a>';}).join('');
  var r=NET.me?NET.me.ratings.blitz.r:profile.rating;
  $('#meChip').innerHTML=avatar(myAvatar(),'sm')+'<div><b>'+esc(myName())+'</b><small>'+(ONLINE?(NET.ok?'<span class="netdot"></span>':'<span class="netdot off"></span>')+(NET.me&&NET.me.guest?'Guest':'Blitz '+r):'Offline mode')+'</small></div>';}
function go(r,opt){
  if(ROUTES.indexOf(r)<0)r='home';
  if(r==='review'&&!SS.review)r='play';
  if(r==='puzzles'&&!SS.puzzles)nextPuzzle(true);
  var prev=route;route=r;navSeq++;
  if(location.hash!=='#'+r){try{history.replaceState(null,'',location.pathname+location.search+'#'+r);}catch(e){location.hash=r;}}
  if(prev==='analysis'&&r!=='analysis')eng.ana.cancel();
  if(prev==='watch'&&r!=='watch'&&SS.watch&&!SS.watch.left){netSend({t:'unwatch'});SS.watch.left=true;}
  if(r==='watch'&&SS.watch&&SS.watch.left)SS.watch=null;
  board.sArrows=[];board.badge=null;board.sel=-1;board.hintSq=-1;
  if(ONLINE&&NET.ok){if(r==='home'||r==='watch')netSend({t:'live'});if(r==='community'){netSend({t:'leaderboard',cat:NET.lbCat||'blitz'});netSend({t:'friends'});}if(r==='profile'&&NET.me)netSend({t:'history'});}
  renderAll();
  if(!isBoardRoute())pageEl.scrollTop=0;
  if(innerWidth<=900){window.scrollTo(0,0);requestAnimationFrame(function(){window.scrollTo(0,0);});}}
addEventListener('hashchange',function(){var h=location.hash.slice(1);if(h&&h!==route)go(h);});
function renderAll(){applyTheme();renderNav();
  var b=isBoardRoute();stageEl.hidden=!b;pageEl.hidden=b;
  if(b){layout();renderPanel();renderBoard();}else renderPage();}

/* ---------- board rendering ---------- */
function showEval(S){if(!S)return false;if(route==='analysis')return !!S.engineOn;if(route==='review')return !!(S.done);if(S.kind==='play')return settings.evalInGame&&(!!S.over||(!!S.local&&!S.setup));return false;}
function isInteractive(S){var P=viewPos(S);
  if(S.kind==='play'){if(S.setup||!S.active||S.over||S.thinking)return false;if(S.view!==S.moves.length)return false;if(S.online&&!NET.ok)return false;return S.local||P.turn===S.userColor;}
  if(S.kind==='analysis')return true;
  if(S.kind==='puzzles')return S.state==='play'&&!S.busy&&S.view===S.moves.length&&P.turn===S.userColor;
  return false;}
function premoveColor(S){if(!settings.premove||S.kind!=='play'||S.local||S.setup||!S.active||S.over||S.view!==S.moves.length)return null;return S.pos.turn!==S.userColor?S.userColor:null;}
function renderBoard(){
  var S=cur();if(!S)return;var P=viewPos(S),lm=S.view>0?S.moves[S.view-1]:null;
  board.setOrient(S.orient);
  board.pickColor=(S.kind==='play'&&!S.local)?S.userColor:(S.kind==='puzzles'?S.userColor:null);
  board.sArrows=[];board.badge=null;board.hintSq=-1;
  board.premove=(S.kind==='play'&&S.premove&&S.view===S.moves.length)?S.premove:null;
  if((S.kind==='play'||S.kind==='learn')&&S.hint&&S.view===S.moves.length)board.sArrows.push([S.hint[0],S.hint[1],'#6fae5a']);
  if(S.kind==='puzzles'&&S.view===S.moves.length){if(S.hintSq!=null)board.hintSq=S.hintSq;if(S.hintArrow)board.sArrows.push([S.hintArrow[0],S.hintArrow[1],'#6fae5a']);}
  if(S.kind==='review'&&S.done&&S.view>0){var i=S.view-1,k=S.cls[i],meta=CLS[k];board.badge={sq:S.moves[i].to,g:meta.g,c:meta.c};
    if(['best','brilliant','great','book'].indexOf(k)<0&&S.bests[i]){var bp=new Pos(S.fens[i]),bm=bp.parseUci(S.bests[i]);if(bm)board.sArrows.push([bm&63,(bm>>6)&63,'#6fae5a',.8]);}}
  if(route==='analysis')anaArrows(S);
  board.set(P,{last:lm?[lm.from,lm.to]:null,check:P.inCheck()?P.k[P.turn]:-1,interactive:isInteractive(S),anim:S._anim,premove:premoveColor(S)});
  S._anim=null;
  renderBars();renderOverlay();updateEval();
  if(route==='analysis'||(route==='play'&&showEval(S)))scheduleAnalysis();}
function anaArrows(S){if(!S.engineOn||!S.showBest)return;var inf=S.einfo;if(!inf||inf.fen!==S.fens[S.view])return;var ap=new Pos(S.fens[S.view]);
  (inf.lines||[]).slice(0,S.lines||1).forEach(function(l,i){var am=l.pv[0]&&ap.parseUci(l.pv[0]);if(am)board.sArrows.push([am&63,(am>>6)&63,'#4f8fc4',i?.42:.8,i?11:15]);});}

/* player bars */
function material(P){var cnt=[[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];for(var s=0;s<64;s++){var p=P.b[s];if(p)cnt[p>>3][p&7]++;}
  var init=[0,8,2,2,2,1,1],caps=[[],[]],val=[0,0];
  for(var c=0;c<2;c++){for(var t=1;t<=5;t++){val[c]+=cnt[c][t]*VAL[t];var miss=Math.max(0,init[t]-cnt[c][t]);for(var k=0;k<miss;k++)caps[c^1].push(t|(c<<3));}}
  return {caps:caps,diff:val[0]-val[1]};}
function playerInfo(S,c){
  var side={name:c?'Black':'White',r:'',av:{p:c?'k':'k',c:c?7:6}};
  if(S.kind==='play'&&!S.setup){
    if(S.online){var pp=S.players[c];return {name:pp.name,r:pp.rating+(pp.prov?'?':''),av:pp.avatar,title:pp.title,off:S.presence&&!S.presence[c]};}
    if(S.local)return side;
    if(c===S.userColor)return {name:myName(),r:profile.rating,av:myAvatar()};
    return {name:S.bot.name,r:S.bot.rating,av:S.bot.av};}
  if(S.kind==='play'){var uc=setup.color==='b'?1:0;
    if(setup.tab==='local')return side;
    if(setup.tab==='bot'){var bt=BOTS[setup.bot];if(c===uc)return {name:myName(),r:profile.rating,av:myAvatar()};return {name:bt.name,r:bt.rating,av:bt.av};}
    if(c===uc)return {name:myName(),r:NET.me?NET.me.ratings[tcCat(setup.tc)].r:'',av:myAvatar()};return {name:'Opponent',r:'',av:{p:'p',c:6}};}
  if(S.kind==='watch'){var wp2=S.players[c];return {name:wp2.name,r:wp2.rating,av:wp2.avatar,title:wp2.title,off:S.presence&&!S.presence[c]};}
  if(S.kind==='review'){var r=S.rec;if(r.players)return {name:r.players[c].name,r:r.players[c].rating||'',av:r.players[c].avatar};
    if(r.local)return side;
    if(c===r.userColor)return {name:myName(),r:'',av:myAvatar()};var b2=BOTS.find(function(x){return x.id===r.bot;})||BOTS[0];return {name:b2.name,r:b2.rating,av:b2.av};}
  if(S.kind==='puzzles'){if(c===S.userColor)return {name:myName(),r:pzRating(),av:myAvatar()};return {name:'Opponent',r:'',av:{p:'p',c:6}};}
  return side;}
function barHTML(S,c,mat){
  var inf=playerInfo(S,c),capsArr=mat.caps[c].sort(function(a,b){return (a&7)-(b&7);}),ch='';
  capsArr.forEach(function(p,i){var nx=capsArr[i+1];ch+='<i'+(nx&&(nx&7)!==(p&7)?' class="gap"':'')+' style="background-image:'+PIMG[p]+'"></i>';});
  var adv=c===0?mat.diff:-mat.diff;if(S.kind==='puzzles'){ch='';adv=0;}
  var think=(S.kind==='play'&&S.thinking&&S.pos.turn===c&&!S.local&&!S.online)?'<span class="thinking"><i></i><i></i><i></i></span>':'';
  var clk='';if((S.kind==='play'||S.kind==='watch')&&S.clock){clk='<div class="clock" id="clk'+c+'">'+fmtClock(S.clock.t[c])+'</div>';}
  return avatar(inf.av,'')+'<div class="who"><div class="pname">'+ttl(inf.title)+'<span class="n">'+esc(inf.name)+'</span>'+(inf.r!==''?'<span class="r num">'+inf.r+'</span>':'')+(inf.off?'<span class="off">offline</span>':'')+think+'</div><div class="caps">'+ch+(adv>0?'<b>+'+Math.round(adv/100)+'</b>':'')+'</div></div>'+clk;}
function renderBars(){var S=cur();if(!S||!isBoardRoute())return;var P=viewPos(S),mat=material(P),top=S.orient===0?1:0;
  $('#barTop').innerHTML=barHTML(S,top,mat);$('#barBot').innerHTML=barHTML(S,top^1,mat);updateClocks();}
function clockSession(){var S=cur();return S&&(S.kind==='play'||S.kind==='watch')&&S.clock?S:null;}
function updateClocks(){var S=clockSession();if(!S)return;for(var c=0;c<2;c++){var el=document.getElementById('clk'+c);if(!el)continue;
  var on=S.active&&!S.over&&S.pos.turn===c&&S.moves.length>=2;var t=S.clock.t[c];
  if(on&&S.clock.last)t-=now()-S.clock.last;
  el.textContent=fmtClock(t);var cls='clock'+(on?' on':'')+(t<20000&&on?' low':'');if(el.className!==cls)el.className=cls;
  if(on&&S.kind==='play'&&c===S.userColor&&t<10000&&!S.lowWarned&&S.clock.t[c]>=10000-50){}
  if(on&&S.kind==='play'&&!S.local&&c===S.userColor&&t<10000&&!S.lowWarned){S.lowWarned=true;sfx('low');}}}
setInterval(function(){
  var S=SS.play;
  if(S.clock&&S.active&&!S.over&&!S.online&&S.moves.length>=2){var t=now(),side=S.pos.turn;if(!S.clock.last)S.clock.last=t;S.clock.t[side]-=t-S.clock.last;S.clock.last=t;
    if(S.clock.t[side]<=0){S.clock.t[side]=0;var opp=side^1,mat=false;for(var s=0;s<64;s++){var p=S.pos.b[s];if(p&&(p>>3)===opp&&(p&7)!==6){mat=true;break;}}
      endLocalGame(S,mat?(side===0?'0-1':'1-0'):'1/2-1/2',mat?'timeout':'timeout vs insufficient material');return;}}
  updateClocks();},100);

/* eval bar */
function updateEval(){var S=cur();if(!S||evalbar.hidden)return;var cp=0,mate=0,term='';
  if(route==='review'&&S.evals){cp=S.evals[S.view];mate=S.mates[S.view];term=S.terms[S.view];}
  else if(S.einfo&&S.einfo.fen===S.fens[S.view]){cp=S.einfo.scoreW;mate=S.einfo.mateW;term=S.einfo.term;}
  else return;
  var pct=term==='mate'?(cp>0?100:0):term==='stalemate'?50:(mate?(mate>0?100:0):wp(cp));
  evalbar.classList.toggle('flip',S.orient===1);
  evalbar.querySelector('.w').style.height=pct+'%';
  var txt=fmtEval(cp,mate,term).replace('+','').replace('−',''),wa=term==='mate'?cp>0:mate?mate>0:cp>=0,bw=S.orient===0;
  var t=evalbar.querySelector('.t'),b=evalbar.querySelector('.b');t.textContent='';b.textContent='';
  if(wa===bw){b.textContent=txt;b.style.color=bw?'#2b2822':'#efe9da';}else{t.textContent=txt;t.style.color=bw?'#efe9da':'#2b2822';}}
var anaTimer=null;
function scheduleAnalysis(){var S=cur();if(!showEval(S)||route==='review')return;var fen=S.fens[S.view];if(S._anaFen===fen&&S._anaLines===S.lines)return;S._anaFen=fen;S._anaLines=S.lines;
  clearTimeout(anaTimer);anaTimer=setTimeout(function(){var st=S,isA=route==='analysis';
    eng.ana.go({fen:fen,moves:[],timeMs:isA?30000:3000,depth:isA?26:18,multipv:isA?(st.lines||1):1,local:{timeMs:isA?8000:2500,maxDepth:24,analysis:true}},function(info){if(!info)return;info.fen=fen;st.einfo=info;if(cur()===st){updateEval();updateEngineBox();if(isA&&st.showBest)drawAnaArrows();}})
    .then(function(r){if(r){r.fen=fen;st.einfo=r;if(cur()===st){updateEval();updateEngineBox();if(isA&&st.showBest)drawAnaArrows();}}});},140);}
function drawAnaArrows(){var S=cur();board.sArrows=[];anaArrows(S);board.renderArrows();}
