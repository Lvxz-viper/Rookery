/* ---------- move list ---------- */
function moveListHTML(S,withCls){
  if(!S.moves.length)return '<div class="empty">'+(S.kind==='analysis'?'Make a move, paste a FEN or load a PGN.':'Moves will appear here.')+'</div>';
  var startP=new Pos(S.startFen),n=startP.full,rows='',i=0;
  if(startP.turn===1){rows+='<div class="mvr"><span class="mvn">'+n+'.</span><span class="mv">…</span>'+mvBtn(S,0,withCls)+'</div>';i=1;n++;}
  for(;i<S.moves.length;i+=2){rows+='<div class="mvr"><span class="mvn">'+n+'.</span>'+mvBtn(S,i,withCls)+(i+1<S.moves.length?mvBtn(S,i+1,withCls):'<span></span>')+'</div>';n++;}
  return rows;}
function mvBtn(S,i,withCls){var g='';if(withCls&&S.cls&&S.cls[i]){var m=CLS[S.cls[i]];g='<i class="g" style="background:'+m.c+'">'+m.g+'</i>';}
  var tm=(S.times&&S.times[i]!=null&&S.tc&&S.tc.base)?'<span class="tm">'+fmtClock(S.times[i],false)+'</span>':'';
  return '<button class="mv'+(S.view===i+1?' cur':'')+'" data-act="view" data-v="'+(i+1)+'">'+g+esc(S.moves[i].san)+tm+'</button>';}
function scrollMoves(){var el=$('#mvlist');if(!el)return;var box=el.closest('.pbody');if(!box||box.scrollHeight<=box.clientHeight)return;var c=el.querySelector('.cur');var S=cur();
  if(S&&S.view===S.moves.length){box.scrollTop=box.scrollHeight;return;}
  if(c){var cr=c.getBoundingClientRect(),br=box.getBoundingClientRect();if(cr.bottom>br.bottom-10||cr.top<br.top+10)box.scrollTop+=cr.top-br.top-br.height/2;}}
function navCtrl(S){var n=S.moves.length,v=S.view;
  return '<button class="ib" data-act="first" title="First move" aria-label="First move"'+(v===0?' disabled':'')+'>'+I.first+'</button><button class="ib" data-act="prev" title="Previous move" aria-label="Previous move"'+(v===0?' disabled':'')+'>'+I.prev+'</button><button class="ib" data-act="next" title="Next move" aria-label="Next move"'+(v===n?' disabled':'')+'>'+I.next+'</button><button class="ib" data-act="last" title="Latest move" aria-label="Latest move"'+(v===n?' disabled':'')+'>'+I.last+'</button>';}
function openingHTML(S){var o=S.opening;return o?'<span class="eco">'+o.eco+'</span><b>'+esc(o.name)+'</b>':(S.moves.length||S.startFen!==START?'':'<span class="fine">Starting position</span>');}

/* ---------- panels ---------- */
function renderPanel(){
  var S=cur(),h='';
  if(route==='play')h=S.setup?setupPanel():gamePanel(S);
  else if(route==='analysis')h=analysisPanel(S);
  else if(route==='puzzles')h=puzzlePanel(S);
  else if(route==='review')h=reviewPanel(S);
  else if(route==='watch')h=watchPanel(S);
  panel.innerHTML=h;updatePanel();}
function updatePanel(){
  var S=cur(),el;if(!S||!isBoardRoute())return;
  if((el=$('#mvlist')))el.innerHTML=moveListHTML(S,route==='review');
  if((el=$('#ctrl')))el.innerHTML=ctrlHTML(S);
  if((el=$('#openName')))el.innerHTML=openingHTML(S);
  if(route==='review')updateReview(S);
  if(route==='analysis')updateEngineBox();
  if(route==='puzzles')updatePuzzle(S);
  if(route==='play'&&!S.setup){
    if((el=$('#bubble'))&&S.bot)el.innerHTML=S.botLine?avatar(S.bot.av,'sm')+'<p>'+esc(S.botLine)+'</p>':'';
    if((el=$('#overbox')))el.innerHTML=S.over?overBox(S):'';
    if((el=$('#offerbox')))el.innerHTML=(S.online&&S.drawIn&&S.active)?'<div class="offer"><span>'+esc(S.opp.name)+' offers a draw</span><button class="btn pri sm" data-act="drawyes">Accept</button><button class="btn sm" data-act="drawno">Decline</button></div>':(S.premove?'<p class="fine">Premove set. Right-click or tap an empty square to cancel.</p>':'');
    if(S.online)updateChat(S);}
  scrollMoves();}
function ctrlHTML(S){
  var flip='<span class="sep"></span><button class="ib" data-act="flip" title="Flip board (F)" aria-label="Flip board">'+I.flip+'</button>';
  if(route==='play'&&!S.setup){var act=S.active&&!S.over,h=navCtrl(S)+flip;
    if(act&&!S.online){if(!S.local)h+='<button class="ib" data-act="hint" title="Hint" aria-label="Hint">'+I.hint+'</button>';
      h+='<button class="ib" data-act="takeback" title="Take back" aria-label="Take back"'+(S.moves.length&&(S.local||S.moves.some(function(m){return m.color===S.userColor;}))?'':' disabled')+'>'+I.undo+'</button>';}
    if(act){h+='<button class="ib draw'+(S.armDraw?' armed':'')+'" data-act="draw" title="'+(S.armDraw?'Click again to offer a draw':'Offer a draw')+'" aria-label="Offer a draw">'+I.draw+'</button>';
      h+='<button class="ib'+(S.armResign?' armed':'')+'" data-act="resign" title="'+(S.armResign?'Click again to resign':(S.online&&S.moves.length<2?'Abort':'Resign'))+'" aria-label="Resign">'+I.flag+'</button>';}
    return h;}
  return navCtrl(S)+flip;}
function tcTiles(sel,act,withNone){return '<div class="tcs">'+(withNone?[['none','Casual']]:[]).concat(TCS).map(function(t){var p=tcParse(t[0]);return '<button class="tc'+(sel===t[0]?' on':'')+'" data-act="'+act+'" data-k="'+t[0]+'"><b>'+(t[0]==='none'?'∞':t[0].replace('+','<em>+</em>'))+'</b><small>'+(t[0]==='none'?'No clock':t[1])+'</small></button>';}).join('')+'</div>';}
function setupPanel(){
  var tabs=[['online','Online'],['bot','Computer'],['friend','Friend'],['local','Pass & Play']].filter(function(t){return ONLINE||(t[0]==='bot'||t[0]==='local');});
  if(!tabs.some(function(t){return t[0]===setup.tab;}))setup.tab='bot';
  var body='',foot='';
  if(setup.tab==='bot'){var bt=BOTS[setup.bot];
    var sfNote=bt.eng.kind==='sf'&&SF_STATE==='off'?'<p class="fine">Stockfish is only available on your Rookery server, so this bot plays with the built-in engine here.</p>':'';
    body='<div class="hero">'+avatar(bt.av,'lg')+'<div><h3>'+bt.name+'</h3><div class="sub">'+bt.title+', rated '+bt.rating+'</div><p>'+esc(bt.bio)+'</p></div></div>'+sfNote+
      '<div class="bots">'+BOTS.map(function(b,i){return '<button class="'+(i===setup.bot?'on':'')+'" data-act="pickbot" data-i="'+i+'" aria-label="'+b.name+', '+b.rating+'">'+avatar(b.av,'')+'<small>'+b.rating+'</small></button>';}).join('')+'</div>'+
      '<div class="h">Play as</div>'+colorSeg()+'<div class="h">Time control</div>'+tcTiles(setup.btc,'btc',true);
    foot='<button class="btn pri lg block" data-act="startbot">Play '+bt.name+'</button>';}
  else if(setup.tab==='local'){body='<div class="hero">'+avatar({p:'k',c:6},'lg')+'<div><h3>One board, two players</h3><p>Pass the device after each move. Turn on auto-flip in Settings to rotate the board for the player to move.</p></div></div><div class="h">Time control</div>'+tcTiles(setup.btc,'btc',true);
    foot='<button class="btn pri lg block" data-act="startlocal">Start game</button>';}
  else if(setup.tab==='online'){
    if(!NET.ok)body='<div class="search"><div class="spin"></div><b>Connecting</b><small>Reaching your Rookery server.</small></div>';
    else if(NET.queue){var q=tcParse(NET.queue);body='<div class="search"><div class="spin"></div><b>Finding an opponent</b><small>'+q.label+' '+q.cat.toLowerCase()+'. Keep this page open.</small></div><p class="fine" id="netstats">'+statsText()+'</p>';foot='<button class="btn block" data-act="cancelq">Cancel search</button>';}
    else{body='<p class="note"><span class="netdot"></span><span id="netstats">'+statsText()+'</span></p><div class="h">Pick a time control</div>'+tcTiles(setup.tc,'tc');
      foot='<button class="btn pri lg block" data-act="findgame">Find '+tcParse(setup.tc).label+' game</button>';}}
  else if(setup.tab==='friend'){
    if(!NET.ok)body='<div class="search"><div class="spin"></div><b>Connecting</b></div>';
    else if(NET.room){body='<div class="search"><small>Game code</small><div class="code">'+NET.room+'</div><small>Share the invite link, or have your friend enter this code. '+tcParse(NET.roomTc).label+'.</small></div>';
      foot='<button class="btn" data-act="cancelq">Cancel</button><button class="btn pri" style="flex:1" data-act="copyroom">'+I.link+'Copy invite link</button>';}
    else{var fr=(NET.friends.list||[]).filter(function(f){return f.status==='online';});
      body=(fr.length?'<div class="h">Friends online</div><div class="list">'+fr.slice(0,5).map(function(f){return '<div class="li">'+avatar(f.avatar,'sm','online')+'<div class="tx"><b>'+esc(f.name)+'</b><small>Blitz '+f.rating+'</small></div><button class="btn sm" data-act="challengeTo" data-id="'+f.id+'" data-name="'+esc(f.name)+'">Challenge</button></div>';}).join('')+'</div>':'')+
      '<div class="h">Invite with a code</div>'+tcTiles(setup.tc,'tc',true)+'<div class="h">You play</div>'+colorSeg()+
      '<div class="h">Have a code?</div><div class="joinrow"><input id="codeIn" maxlength="5" placeholder="Code" autocomplete="off" spellcheck="false" aria-label="Game code"><button class="btn" data-act="joinroom">Join</button></div>';
      foot='<button class="btn pri lg block" data-act="createroom">Create invite</button>';}}
  return '<div class="ph"><h2>New game</h2></div><div class="tabs">'+tabs.map(function(t){return '<button class="'+(setup.tab===t[0]?'on':'')+'" data-act="stab" data-k="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div><div class="pbody enter">'+body+'</div>'+(foot?'<div class="pfoot">'+foot+'</div>':'');}
function colorSeg(){return '<div class="seg">'+[['w','White',PIMG[6]],['r','Random',null],['b','Black',PIMG[14]]].map(function(x){return '<button class="'+(setup.color===x[0]?'on':'')+'" data-act="color" data-c="'+x[0]+'">'+(x[2]?'<i style="background-image:'+x[2]+'"></i>':'<i style="background:linear-gradient(90deg,#efe9da 50%,#2b2822 50%);border-radius:50%;width:14px;height:14px"></i>')+x[1]+'</button>';}).join('')+'</div>';}
function gamePanel(S){
  var tc=S.tc&&S.tc.base?S.tc.label:'No clock',title=S.local?'Pass & Play':S.online?'vs '+S.opp.name:'vs '+S.bot.name;
  var meta=S.online?(S.rated?'Rated, '+tc:'Casual, '+tc.toLowerCase()):tc;
  var tabs=S.online?'<div class="tabs" id="gtabs"></div>':'';
  var body=S.online&&S.tab==='chat'?chatHTML(S):
    (S.bot?'<div class="bubble" id="bubble"></div>':'')+'<div id="offerbox"></div><div class="opening" id="openName"></div><div class="mvl" id="mvlist"></div><div id="overbox"></div>';
  return '<div class="ph"><h2>'+esc(title)+'</h2><span class="meta">'+esc(meta)+'</span></div>'+tabs+'<div class="pbody">'+body+'</div><div class="ctrl" id="ctrl"></div>';}
function updateTabs(){var S=SS.play,t=$('#gtabs');if(!t||!S.online)return;
  t.innerHTML='<button class="'+(S.tab!=='chat'?'on':'')+'" data-act="gtab" data-k="moves">Moves</button><button class="'+(S.tab==='chat'?'on':'')+'" data-act="gtab" data-k="chat">Chat'+(S.unread?'<span class="cnt">'+S.unread+'</span>':'')+'</button><span style="flex:1"></span><span class="fine" style="align-self:center" id="spectN">'+spectText(S.spect)+'</span>';}
function chatHTML(S){return '<div class="chat"><div class="chatlist" id="chatlist"></div><div class="quick">'+['Good luck','Have fun','Well played','Thanks','Rematch?'].map(function(q){return '<button data-act="quick" data-q="'+q+'">'+q+'</button>';}).join('')+'</div><div class="chatin"><input id="chatIn" maxlength="200" placeholder="Message '+esc(S.opp.name)+'" autocomplete="off"><button class="btn" data-act="chatsend">Send</button></div><button class="btn ghost sm" data-act="report" style="align-self:flex-start">'+I.report+'Report chat</button></div>';}
function updateChat(S){var el=$('#chatlist');updateTabs();if(!el)return;
  el.innerHTML=(S.chat||[]).map(function(c){return '<p class="'+(c.from===S.userColor?'mine':'')+'"><b>'+esc(c.name)+'</b>'+esc(c.text)+'</p>';}).join('')||'<span class="empty">Say hello. Messages are only seen by the two players.</span>';
  el.scrollTop=el.scrollHeight;}
function sendChat(text){var S=SS.play;text=(text||'').trim();if(!text||!S.online)return;netSend({t:'chat',gid:S.gid,text:text});}
function overBox(S){var r=resultText(S);
  if(S.aborted)return '<div class="msg info">Game aborted. Ratings are unchanged.</div><div class="row" style="margin-top:8px"><button class="btn pri" data-act="newgame">New game</button></div>';
  return '<div class="msg '+(r.tone==='win'?'ok':r.tone==='loss'?'no':'info')+'">'+esc(r.title)+' by '+esc(S.over.reason)+'</div><div class="row" style="margin-top:8px"><button class="btn pri" data-act="review">Game review</button><button class="btn" data-act="rematch">'+(S.rematchIn?'Accept rematch':S.rematchSent?'Rematch sent':'Rematch')+'</button><button class="btn" data-act="newgame">New game</button></div>';}
function resultText(S){var res=S.over.result,tone='draw',title='Draw';
  if(res==='1-0'||res==='0-1'){var wWin=res==='1-0';
    if(S.local){title=(wWin?'White':'Black')+' won';tone='win';}
    else{var u=(wWin&&S.userColor===0)||(!wWin&&S.userColor===1);title=u?'You won':((S.online?S.opp.name:S.bot.name)+' won');tone=u?'win':'loss';}}
  return {title:title,tone:tone};}

/* result card */
function renderOverlay(){
  var S=cur(),bb=$('#bbox'),old=bb.querySelector('.result');if(old)old.remove();
  if(route!=='play'||!S||S.kind!=='play'||!S.over||!S.showResult||S.aborted)return;
  var r=resultText(S),res=S.over.result,wWin=res==='1-0',bWin=res==='0-1';
  var big=S.local?(res==='1/2-1/2'?'Draw':(wWin?'White wins':'Black wins')):(r.tone==='win'?'Victory':r.tone==='loss'?'Defeat':'Draw');
  var A=playerInfo(S,0),B=playerInfo(S,1);
  var rate='';if(!S.local){var b4=S.online?S.rBefore:S.rBefore,af=S.online?S.rAfter:S.rAfter;if(af!=null)rate='<div class="rate">'+(S.online?(S.rated?tcParse(S.tc.key).cat+' rating':'Casual game'):'Rating against bots')+' <b class="num" id="rCount">'+b4+'</b> <span class="delta '+(S.delta>0?'up':S.delta<0?'dn':'')+'">'+(S.delta>0?'+':S.delta<0?'−':'±')+Math.abs(S.delta)+'</span></div>';}
  var d=document.createElement('div');d.className='result';
  d.innerHTML='<div class="rcard" role="dialog" aria-label="Game over"><button class="x" data-act="closeresult" aria-label="Close">'+I.x+'</button>'+
    '<div class="vs">'+avatar(A.av,wWin?'win':'')+'<em>'+res.replace(/1\/2/g,'½')+'</em>'+avatar(B.av,bWin?'win':'')+'</div>'+
    '<h3>'+big+'</h3><div class="why">'+(S.local?'':esc(r.title)+' ')+'by '+esc(S.over.reason)+'</div>'+(rate||'<div style="height:18px"></div>')+
    '<div class="stack"><button class="btn pri lg" data-act="review">Game review</button><div class="row"><button class="btn" data-act="rematch">'+(S.rematchIn?'Accept rematch':S.rematchSent?'Rematch sent':'Rematch')+'</button><button class="btn" data-act="newgame">New game</button></div></div></div>';
  bb.appendChild(d);
  d.addEventListener('click',onAct);
  d.addEventListener('pointerdown',function(e){if(e.target===d){S.showResult=false;renderOverlay();}});
  var rc=d.querySelector('#rCount');if(rc&&S.rAfter!=null&&!S._counted){S._counted=true;var a=S.rBefore,b=S.rAfter,t0=now();(function step(){var k=Math.min(1,(now()-t0)/900),e=1-Math.pow(1-k,3);rc.textContent=Math.round(a+(b-a)*e);if(k<1)requestAnimationFrame(step);})();}
  else if(rc)rc.textContent=S.rAfter;}

/* ---------- computer games ---------- */
function startBotGame(){
  var S=session('play');S.setup=false;S.active=true;S.bot=BOTS[setup.bot];
  var tc=tcParse(setup.btc);S.tc=tc;S.clock=tc.base?{t:[tc.base,tc.base],inc:tc.inc,last:0}:null;
  var c=setup.color==='r'?(Math.random()<.5?0:1):(setup.color==='b'?1:0);S.userColor=c;S.orient=c;S.botLine=S.bot.lines.start;S.times=[];
  SS.play=S;eng.play.cancel();saveAll();sfx('start');go('play');
  if(c===1)botMove(S);}
function startLocalGame(){var S=session('play');S.setup=false;S.active=true;S.local=true;S.userColor=0;var tc=tcParse(setup.btc);S.tc=tc;S.clock=tc.base?{t:[tc.base,tc.base],inc:tc.inc,last:0}:null;S.times=[];
  SS.play=S;saveAll();sfx('start');go('play');}
function botMove(S){
  if(SS.play!==S||!S.active||S.over)return;
  S.thinking=true;renderBars();
  var n=S.moves.length,bk=null,ucis=S.moves.map(function(m){return m.uci;}),bot=S.bot;
  if(n<12&&S.startFen===START&&Math.random()<bot.book){var c=OPEN.filter(function(o){if(o.uci.length<=n)return false;for(var i=0;i<n;i++)if(o.uci[i]!==ucis[i])return false;return true;});if(c.length)bk=c[(Math.random()*c.length)|0].uci[n];}
  var budget=S.clock?Math.max(150,S.clock.t[S.pos.turn]/40):1e9;
  var task;
  if(bk)task=Promise.resolve({best:bk});
  else if(bot.eng.kind==='local')task=eng.play.useLocal({fen:S.startFen,moves:ucis,local:Object.assign({},bot.eng.p,{timeMs:Math.min(bot.eng.p.timeMs,budget)})});
  else task=eng.play.go({fen:S.startFen,moves:ucis,timeMs:Math.min(bot.eng.ms,budget),elo:bot.eng.elo||0,local:Object.assign({},bot.eng.fb,{timeMs:Math.min(bot.eng.fb.timeMs,budget)})});
  var delay=bk?350+Math.random()*700:(bot.rating<1500?400+Math.random()*800:120);
  if(S.clock&&S.clock.t[S.pos.turn]<15000)delay=40;
  Promise.all([task,sleep(delay)]).then(function(res){var r=res[0];
    if(SS.play!==S||!S.thinking||S.over)return;S.thinking=false;
    if(!r||!r.best){renderBars();return;}
    var m=S.pos.parseUci(r.best);if(!m){renderBars();return;}
    var e=doMove(S,m,false,cur()!==S);afterLocalMove(S,e);});}
function settleClock(S){if(!S.clock||!S.active||S.over)return;var t=now();if(S.moves.length>=2&&S.clock.last){S.clock.t[S.pos.turn]-=t-S.clock.last;}S.clock.last=t;}
function afterLocalMove(S,e){
  if(S.clock){if(S.moves.length>2)S.clock.t[e.color]+=S.clock.inc;S.clock.last=now();S.times[S.moves.length-1]=S.clock.t[e.color];}
  var st=S.pos.status();
  if(!S.local){var botC=S.userColor^1;
    if(e.color===botC&&S.pos.inCheck()&&Math.random()<.5)S.botLine=S.bot.lines.check;
    else if(e.color===botC&&e.cap&&Math.random()<.4)S.botLine=S.bot.lines.cap;
    else if(e.color!==botC&&e.cap&&(e.cap&7)>=2&&Math.random()<.45)S.botLine=S.bot.lines.lost;}
  if(S.local&&settings.autoFlip&&!st.over)S.orient=S.pos.turn;
  if(st.over){endLocalGame(S,st.result,st.reason);return;}
  if(cur()===S){renderBoard();updatePanel();}
  if(!S.local&&S.pos.turn!==S.userColor)botMove(S);
  else tryPremove(S);}
function tryPremove(S){if(!S.premove||S.over||!S.active)return;if(S.pos.turn!==S.userColor){return;}
  var pm=S.premove;S.premove=null;board.premove=null;
  var m=S.pos.legal().filter(function(x){return (x&63)===pm[0]&&((x>>6)&63)===pm[1];});
  if(!m.length){if(cur()===S){renderBoard();updatePanel();}return;}
  var mv=m.find(function(x){return ((x>>12)&7)===5;})||m[0];
  setTimeout(function(){if(SS.play===S&&S.pos.turn===S.userColor&&S.active)userMove(mv,false,true);},20);}
function userMove(m,dragged,isPre){
  var S=cur();
  if(S.kind==='play'){if(!isPre&&!isInteractive(S))return;if(isPre&&(S.pos.turn!==S.userColor||S.view!==S.moves.length))return;
    S.hint=null;S.armDraw=S.armResign=false;
    if(S.online){S.drawIn=false;var e=doMove(S,m,dragged);netSend({t:'move',gid:S.gid,uci:e.uci});if(S.clock){S.clock.last=now();}renderBoard();updatePanel();return;}
    settleClock(S);var e2=doMove(S,m,dragged);afterLocalMove(S,e2);return;}
  if(S.kind==='analysis'){while(S.moves.length>S.view)undoMove(S);doMove(S,m,dragged);S.einfo=null;renderBoard();updatePanel();return;}
  if(S.kind==='puzzles')puzzleMove(S,m,dragged);}
function endLocalGame(S,result,reason){
  if(S.over)return;S.over={result:result,reason:reason};S.active=false;S.thinking=false;S.armDraw=S.armResign=false;S.premove=null;eng.play.cancel();S.showResult=true;
  var rec={id:'g'+Date.now(),date:Date.now(),local:!!S.local,startFen:S.startFen,moves:S.moves.map(function(m){return m.uci;}),result:result,reason:reason,userColor:S.userColor,tc:S.tc.key};
  if(!S.local){var score=result==='1/2-1/2'?.5:(((result==='1-0')===(S.userColor===0))?1:0);
    var exp=1/(1+Math.pow(10,(S.bot.rating-profile.rating)/400)),K=(profile.w+profile.l+profile.d)<15?40:24;
    var delta=Math.round(K*(score-exp));if(S.moves.length<4&&score===0)delta=Math.min(delta,-1);
    S.rBefore=profile.rating;profile.rating=Math.max(100,profile.rating+delta);profile.peak=Math.max(profile.peak,profile.rating);S.rAfter=profile.rating;S.delta=delta;
    if(score===1)profile.w++;else if(score===0)profile.l++;else profile.d++;
    profile.hist.push([Date.now(),'bots',profile.rating]);if(profile.hist.length>400)profile.hist.shift();
    S.botLine=score===1?S.bot.lines.lose:score===0?S.bot.lines.win:S.bot.lines.draw;
    rec.bot=S.bot.id;rec.delta=delta;rec.score=score;sfx(score===1?'win':'end');}
  else sfx('end');
  S.rec=rec;profile.games.unshift(rec);profile.games=profile.games.slice(0,60);saveAll();
  if(cur()===S)renderAll();else toast('Your game against '+(S.bot?S.bot.name:'your friend')+' has ended');}
function takeback(S){
  if(!S.active||S.over||S.online)return;eng.play.cancel();S.thinking=false;S.hint=null;S.premove=null;
  if(S.local)undoMove(S);else{undoMove(S);while(S.moves.length&&S.pos.turn!==S.userColor)undoMove(S);}
  if(S.clock)S.clock.last=now();
  renderBoard();updatePanel();
  if(!S.local&&S.pos.turn!==S.userColor)botMove(S);}
function offerDraw(S){
  if(S.online){netSend({t:'draw_offer'});return;}
  if(S.local){endLocalGame(S,'1/2-1/2','agreement');return;}
  toast('Draw offered');
  eng.misc.go({fen:S.startFen,moves:S.moves.map(function(m){return m.uci;}),timeMs:500,depth:12,local:{timeMs:500,maxDepth:6}}).then(function(r){
    if(SS.play!==S||S.over)return;var bs=r?((S.userColor^1)===0?r.scoreW:-r.scoreW):0;
    if(r&&S.moves.length>=20&&bs<=30){S.botLine=S.bot.lines.draw;endLocalGame(S,'1/2-1/2','agreement');}
    else{S.botLine=S.bot.lines.nodraw;toast(S.bot.name+' declined the draw');updatePanel();}});}
function hint(S){
  if(!S.active||S.over||S.thinking||S.online)return;toast('Looking for a good move');
  eng.misc.go({fen:S.startFen,moves:S.moves.map(function(m){return m.uci;}),timeMs:900,depth:16,local:{timeMs:900,maxDepth:12}}).then(function(r){
    if(!r||!r.best||SS.play!==S)return;var m=S.pos.parseUci(r.best);if(!m)return;S.hint=[m&63,(m>>6)&63];if(cur()===S)renderBoard();});}

/* ---------- analysis ---------- */
function analysisPanel(S){
  return '<div class="ph"><h2>Analysis</h2><span class="meta" id="engName">'+engineName()+'</span><button class="tog'+(S.engineOn?' on':'')+'" data-act="engtog" aria-label="Engine on or off" title="Engine"></button></div><div class="pbody">'+
   '<div id="eng"></div><div class="opening" id="openName"></div><div class="mvl" id="mvlist"></div>'+
   '<div class="h">Position</div><div style="display:grid;gap:8px"><div class="joinrow"><input id="fenIn" placeholder="Paste a FEN" spellcheck="false" autocomplete="off" aria-label="FEN"><button class="btn" data-act="loadfen">Load</button></div>'+
   '<textarea id="pgnIn" placeholder="Paste a PGN" spellcheck="false" aria-label="PGN"></textarea><div class="row"><button class="btn" data-act="loadpgn">Load PGN</button><button class="btn" data-act="copyfen">'+I.copy+'FEN</button><button class="btn" data-act="copypgn">'+I.copy+'PGN</button></div><button class="btn ghost" data-act="reset">Clear the board</button></div>'+
   '</div><div class="ctrl" id="ctrl"></div>';}
function updateEngineBox(){var el=$('#eng');if(!el)return;var S=cur();var nm=$('#engName');if(nm)nm.textContent=engineName();
  if(!S.engineOn){el.innerHTML='<p class="note">The engine is off. Turn it on with the switch.</p>';return;}
  var P=viewPos(S),st=P.status();
  if(st.over){el.innerHTML='<div class="eng"><div class="top"><b>'+(st.reason==='checkmate'?'#':'½')+'</b><small>'+esc(st.reason)+'</small></div></div>';return;}
  var inf=S.einfo&&S.einfo.fen===S.fens[S.view]?S.einfo:null;
  var head='<div class="top"><b class="num">'+(inf?fmtEval(inf.scoreW,inf.mateW,inf.term):'…')+'</b><small>'+(inf?'Depth '+inf.depth:'Thinking')+'</small><span style="flex:1"></span>'+
    '<div class="seg" style="padding:2px">'+[1,2,3].map(function(n){return '<button class="'+((S.lines||1)===n?'on':'')+'" data-act="lines" data-n="'+n+'" style="padding:3px 9px" aria-label="'+n+' lines">'+n+'</button>';}).join('')+'</div>'+
    '<button class="tog'+(S.showBest?' on':'')+'" data-act="besttog" title="Show arrows" aria-label="Show best move arrows"></button></div>';
  var lines=inf?(inf.lines||[]).slice(0,S.lines||1).map(function(l,i){var w=(l.mateW?l.mateW>0:l.scoreW>=0);return '<div class="line" data-act="pvplay" data-i="'+i+'"><span class="s '+(w?'w':'b')+'">'+fmtEval(l.scoreW,l.mateW)+'</span><span class="pv">'+sanLine(S.fens[S.view],l.pv.slice(0,14))+'</span></div>';}).join(''):'';
  el.innerHTML='<div class="eng">'+head+lines+'</div>';}
function sanLine(fen,ucis){var p=new Pos(fen),out=[],n=p.full;ucis.forEach(function(u,i){var m=p.parseUci(u);if(!m)return;var s=esc(p.san(m));if(p.turn===0)out.push(n+'. '+(i===0?'<b>'+s+'</b>':s));else out.push(i===0?n+'… <b>'+s+'</b>':s);p.make(m);if(p.turn===0)n++;});return out.join(' ');}
function pgnOf(S,meta){meta=meta||{};var h='[Event "'+(meta.event||'Rookery game')+'"]\n[Site "Rookery"]\n[Date "'+new Date(meta.date||Date.now()).toISOString().slice(0,10).replace(/-/g,'.')+'"]\n[White "'+(meta.white||'White')+'"]\n[Black "'+(meta.black||'Black')+'"]\n[Result "'+(meta.result||'*')+'"]\n';
  if(S.startFen!==START)h+='[SetUp "1"]\n[FEN "'+S.startFen+'"]\n';
  var p=new Pos(S.startFen),n=p.full,out=[];S.moves.forEach(function(m,i){if(p.turn===0)out.push(n+'.');else if(i===0)out.push(n+'...');out.push(m.san);p.make(p.parseUci(m.uci));if(p.turn===0)n++;});
  return h+'\n'+out.join(' ')+' '+(meta.result||'*');}
function parsePgn(txt){
  var fenM=txt.match(/\[FEN\s+"([^"]+)"\]/),fen=fenM?fenM[1]:START;
  var body=txt.replace(/\[[^\]]*\]/g,' ').replace(/\{[^}]*\}/g,' ').replace(/;[^\n]*/g,' ');
  var prev;do{prev=body;body=body.replace(/\([^()]*\)/g,' ');}while(body!==prev);
  body=body.replace(/\$\d+/g,' ').replace(/\d+\.(\.\.)?/g,' ');
  var toks=body.trim().split(/\s+/).filter(Boolean),S=session('analysis',fen);
  for(var i=0;i<toks.length;i++){if(/^(1-0|0-1|1\/2-1\/2|\*)$/.test(toks[i]))break;var m=S.pos.parseSan(toks[i]);if(!m)return {S:S,err:'Stopped at "'+toks[i]+'", move '+(i+1)+'.'};doMove(S,m,true,true);}
  S._anim=null;return {S:S};}
function toAnalysis(src){var A=session('analysis',src.startFen);src.moves.forEach(function(m){doMove(A,m.m,true,true);});A._anim=null;A.view=src.view;A.orient=src.orient;A.engineOn=true;A.lines=SS.analysis.lines||3;A.showBest=SS.analysis.showBest;SS.analysis=A;go('analysis');}
