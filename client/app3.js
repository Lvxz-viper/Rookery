/* ---------- puzzles ---------- */
var PUZ_LOCAL=/*PUZZLES*/;
var pzTheme=store.get('pztheme','mix'),pzRecent=store.get('pzrecent',[]),pzThemes=null;
function pzRating(){return NET.me?NET.me.puzzle.r:profile.puzzle;}
function pzStreak(){return NET.me?NET.me.puzzle.streak:profile.pzStreak;}
function localPuzzle(daily){var L=PUZ_LOCAL.map(function(p){return {id:p[0],fen:p[1],moves:p[2].split(' '),rating:p[3],themes:p[4].split(' '),setup:false};});
  if(daily){var d=new Date().toISOString().slice(0,10),h=0;for(var i=0;i<d.length;i++)h=(h*31+d.charCodeAt(i))>>>0;var x=L[h%L.length];x.date=d;return x;}
  var r=pzRating(),pool=L.filter(function(p){return pzRecent.indexOf(p.id)<0&&(pzTheme==='mix'||p.themes.indexOf(pzTheme)>=0);});
  if(!pool.length){pzRecent=[];pool=L;}
  pool.sort(function(a,b){return Math.abs(a.rating-r)-Math.abs(b.rating-r);});return pool[Math.floor(Math.random()*Math.min(4,pool.length))];}
function fetchPuzzle(daily){
  if(!ONLINE)return Promise.resolve(localPuzzle(daily));
  var u=daily?'api/puzzle/daily':'api/puzzle?r='+pzRating()+'&theme='+encodeURIComponent(pzTheme)+'&ex='+pzRecent.slice(-150).join(',');
  return fetch(u).then(function(r){return r.json();}).catch(function(){return localPuzzle(daily);});}
function loadThemes(){if(pzThemes||!ONLINE)return;fetch('api/puzzle/themes').then(function(r){return r.json();}).then(function(d){pzThemes=d.themes;if(route==='puzzles')renderPanel();}).catch(function(){});}
function themeList(){if(pzThemes)return pzThemes;var c={};PUZ_LOCAL.forEach(function(p){p[4].split(' ').forEach(function(t){c[t]=1;});});
  return [{id:'mix',label:'Mixed'}].concat([['mateIn1','Mate in 1'],['mateIn2','Mate in 2'],['mateIn3','Mate in 3']].filter(function(x){return c[x[0]];}).map(function(x){return {id:x[0],label:x[1]};}));}
function nextPuzzle(silent,daily){
  var S=session('puzzles');S.state='loading';S.userColor=0;S.pz=null;SS.puzzles=S;
  if(!silent)renderAll();
  fetchPuzzle(daily).then(function(pz){if(SS.puzzles!==S)return;startPuzzle(pz,daily);});}
function startPuzzle(pz,daily){
  var S=session('puzzles',pz.fen);S.pz=pz;S.daily=!!daily;S.idx=0;S.failed=false;S.hinted=false;S.msg=null;S.hintSq=null;S.hintArrow=null;
  var turn=S.pos.turn;S.userColor=pz.setup?turn^1:turn;S.orient=S.userColor;S.state=pz.setup?'setup':'play';
  if(!pz.setup)S.msg={t:'info',s:'Find the best move for '+(S.userColor?'Black':'White')+'.'};
  SS.puzzles=S;if(route==='puzzles')renderAll();
  if(pz.setup)setTimeout(function(){if(SS.puzzles!==S)return;var m=S.pos.parseUci(pz.moves[0]);if(m)doMove(S,m,false,route!=='puzzles');S.idx=1;S.state='play';S.msg={t:'info',s:'Your turn. Find the best move for '+(S.userColor?'Black':'White')+'.'};if(cur()===S){renderBoard();updatePanel();}},650);}
function reportPuzzle(S,win){
  if(S.reported)return;S.reported=true;
  pzRecent.push(S.pz.id);if(pzRecent.length>300)pzRecent=pzRecent.slice(-300);store.set('pzrecent',pzRecent);
  if(ONLINE&&NET.ok){S.pending=true;netSend({t:'puzzle_result',id:S.pz.id,win:win,moves:S.moves.map(function(m){return m.uci;})});return;}
  var exp=1/(1+Math.pow(10,(S.pz.rating-profile.puzzle)/400)),k=profile.pzSolved<20?40:22,b=profile.puzzle;
  profile.puzzle=Math.max(100,Math.round(profile.puzzle+k*((win?1:0)-exp)));S.delta=profile.puzzle-b;S.ratingAfter=profile.puzzle;
  if(win){profile.pzSolved++;profile.pzStreak++;profile.pzBest=Math.max(profile.pzBest,profile.pzStreak);}else profile.pzStreak=0;
  profile.hist.push([Date.now(),'puzzle',profile.puzzle]);saveAll();}
function puzzleMove(S,m,dragged){
  if(!isInteractive(S))return;S.hintSq=null;S.hintArrow=null;
  var want=S.pz.moves[S.idx],e=doMove(S,m,dragged),st=S.pos.status();
  if(e.uci===want||(st.over&&st.reason==='checkmate')){
    S.idx++;
    if(S.idx>=S.pz.moves.length||(st.over&&st.reason==='checkmate')){solvePuzzle(S);return;}
    S.busy=true;S.msg={t:'ok',s:'Best move. Keep going.'};sfx('ok');renderBoard();updatePanel();
    setTimeout(function(){if(SS.puzzles!==S)return;var r=S.pos.parseUci(S.pz.moves[S.idx]);if(r)doMove(S,r,false,cur()!==S);S.idx++;S.busy=false;
      if(S.idx>=S.pz.moves.length){solvePuzzle(S);return;}
      S.msg={t:'info',s:'Your move again.'};if(cur()===S){renderBoard();updatePanel();}},420);
    return;}
  S.state='wrong';S.msg={t:'no',s:'That is not the move. Try again.'};sfx('no');
  if(!S.failed&&!S.hinted){S.failed=true;reportPuzzle(S,false);}
  renderBoard();updatePanel();
  setTimeout(function(){if(SS.puzzles!==S||S.state!=='wrong')return;undoMove(S);S.state='play';if(cur()===S){renderBoard();updatePanel();}},900);}
function solvePuzzle(S){S.state='solved';var clean=!S.failed&&!S.hinted;
  S.msg={t:'ok',s:clean?'Solved.':'Solved, but not on the first try.'};if(clean)reportPuzzle(S,true);sfx('win');renderAll();}
function showSolution(S){if(!S.failed){S.failed=true;reportPuzzle(S,false);}S.hinted=true;
  while(S.moves.length>(S.pz.setup?1:0))undoMove(S);S.idx=S.pz.setup?1:0;S.state='showing';S.msg={t:'info',s:'Here is the solution.'};renderAll();
  (function step(){if(SS.puzzles!==S||S.state!=='showing')return;if(S.idx>=S.pz.moves.length){S.state='solved';S.msg={t:'info',s:'That was the solution. Try the next one.'};if(cur()===S)renderAll();return;}
    var m=S.pos.parseUci(S.pz.moves[S.idx++]);if(m)doMove(S,m,false,cur()!==S);if(cur()===S){renderBoard();updatePanel();}setTimeout(step,800);})();}
function puzzleHint(S){if(S.state!=='play')return;var m=S.pos.parseUci(S.pz.moves[S.idx]);if(!m)return;
  if(!S.hinted&&!S.failed){S.failed=true;reportPuzzle(S,false);}S.hinted=true;
  if(S.hintSq==null){S.hintSq=m&63;S.msg={t:'info',s:'Move the highlighted piece.'};}else{S.hintArrow=[m&63,(m>>6)&63];S.msg={t:'info',s:'Play the arrow.'};}
  renderBoard();updatePanel();}
function themeLabel(t){var all={mate:'Mate',mateIn1:'Mate in 1',mateIn2:'Mate in 2',mateIn3:'Mate in 3',mateIn4:'Mate in 4',fork:'Fork',pin:'Pin',skewer:'Skewer',discoveredAttack:'Discovered attack',sacrifice:'Sacrifice',hangingPiece:'Hanging piece',deflection:'Deflection',attraction:'Attraction',backRankMate:'Back-rank mate',promotion:'Promotion',trappedPiece:'Trapped piece',kingsideAttack:'Kingside attack',queensideAttack:'Queenside attack',opening:'Opening',middlegame:'Middlegame',endgame:'Endgame',rookEndgame:'Rook endgame',short:'Short',long:'Long',veryLong:'Very long',oneMove:'One move',crushing:'Crushing',advantage:'Advantage',equality:'Equality',master:'Master game',defensiveMove:'Defensive move',quietMove:'Quiet move',intermezzo:'Intermezzo',xRayAttack:'X-ray',zugzwang:'Zugzwang',capturingDefender:'Remove the defender',exposedKing:'Exposed king',doubleCheck:'Double check',smotheredMate:'Smothered mate',clearance:'Clearance',interference:'Interference',enPassant:'En passant',castling:'Castling',underPromotion:'Underpromotion',advancedPawn:'Advanced pawn',bishopEndgame:'Bishop endgame',knightEndgame:'Knight endgame',pawnEndgame:'Pawn endgame',queenEndgame:'Queen endgame',queenRookEndgame:'Queen and rook endgame',anastasiaMate:'Anastasia mate',arabianMate:'Arabian mate',hookMate:'Hook mate',bodenMate:'Boden mate',dovetailMate:'Dovetail mate',doubleBishopMate:'Double bishop mate',killBoxMate:'Kill box mate',vukovicMate:'Vukovic mate'};return all[t]||null;}
function puzzlePanel(S){
  var pz=S.pz,r=pzRating();
  var th=themeList().slice(0,14).map(function(t){return '<button class="chip'+(pzTheme===t.id?' on':'')+'" data-act="pztheme" data-k="'+t.id+'">'+esc(t.label)+'</button>';}).join('');
  var head=!pz?'<div class="pzhead"><div class="skel" style="width:28px;height:28px;border-radius:50%"></div><div style="flex:1;display:grid;gap:6px"><div class="skel" style="height:18px;width:60%"></div><div class="skel" style="height:13px;width:40%"></div></div></div>':
    '<div class="pzhead"><div class="side" style="background:'+(S.userColor?'#2b2822':'#efe9da')+'"></div><div><h3>'+(S.userColor?'Black':'White')+' to move</h3><p>'+(S.daily?'Daily puzzle, ':'')+'Rated '+pz.rating+(S.state==='solved'||S.failed?', '+pz.themes.map(themeLabel).filter(Boolean).slice(0,3).join(', '):'')+'</p></div></div>';
  return '<div class="ph"><h2>'+(S.daily?'Daily puzzle':'Puzzles')+'</h2><span class="meta">'+(ONLINE?'':'Offline set')+'</span></div><div class="pbody">'+
    '<div class="stats"><div class="stat"><small>Rating</small><b id="pzR">'+r+'</b></div><div class="stat"><small>Streak</small><b>'+pzStreak()+'</b></div><div class="stat"><small>Solved</small><b>'+(NET.me?NET.me.puzzle.solved:profile.pzSolved)+'</b></div></div>'+
    head+'<div id="pzmsg"></div><div class="h">Themes</div><div class="chips">'+th+'</div>'+
    '<p class="fine">Hints and the solution count as a miss for your rating.</p></div><div class="pfoot" id="pzfoot"></div>';}
function updatePuzzle(S){var el=$('#pzmsg');
  if(el){var m=S.msg,d='';if(S.state==='solved'&&!S.failed&&!S.hinted){d=S.pending?' <span class="delta">…</span>':(S.delta?' <span class="delta '+(S.delta>=0?'up':'dn')+'">'+(S.delta>=0?'+':'−')+Math.abs(S.delta)+'</span>':'');}
    else if(S.failed&&S.delta&&S.state!=='play')d=' <span class="delta dn">−'+Math.abs(S.delta)+'</span>';
    el.innerHTML=m?'<div class="msg '+m.t+'">'+(m.t==='ok'?I.check:m.t==='no'?I.x:'')+'<span>'+esc(m.s)+d+'</span></div>':'';}
  var rr=$('#pzR');if(rr)rr.textContent=S.ratingAfter||pzRating();
  var f=$('#pzfoot');if(!f)return;
  if(S.state==='solved')f.innerHTML='<button class="btn" data-act="pzanalyze">Analyze</button><button class="btn pri" style="flex:1" data-act="pznext">Next puzzle</button>';
  else f.innerHTML='<button class="btn" data-act="pzhint"'+(S.state!=='play'?' disabled':'')+'>'+I.hint+'Hint</button><button class="btn" data-act="pzsol"'+(S.state==='loading'||S.state==='setup'?' disabled':'')+'>Solution</button><button class="btn ghost" style="margin-left:auto" data-act="pzskip">Skip</button>';}

/* ---------- game review ---------- */
function reviewFromSession(S){return S.rec;}
function startReview(rec){
  var S=session('review',rec.startFen||START);S.rec=rec;rec.moves.forEach(function(u){var m=S.pos.parseUci(u);if(m)doMove(S,m,true,true);});
  S._anim=null;S.view=0;S.orient=rec.local?0:(rec.userColor>=0?rec.userColor:0);S.evals=[];S.mates=[];S.terms=[];S.bests=[];S.seconds=[];S.done=false;S.prog=0;
  if(rec.times&&rec.tc&&rec.tc!=='none'){S.times=rec.times;S.tc=tcParse(rec.tc);}
  SS.review=S;eng.rev.cancel();go('review');runReview(S);}
function reviewRecord(r){var me=NET.me&&NET.me.id;var c=r.b.id===me?1:0;
  function pa(x){var h=0;for(var i=0;i<x.name.length;i++)h=(h*31+x.name.charCodeAt(i))>>>0;return {name:x.name,rating:x.r,avatar:{p:'kqrbnp'[h%6],c:h%8}};}
  startReview({id:r.id,online:true,startFen:START,moves:r.moves,times:r.times,result:r.result,reason:r.reason,userColor:(r.w.id===me||r.b.id===me)?c:0,tc:r.tc,date:r.end,players:[pa(r.w),pa(r.b)]});}
function runReview(S){var i=0,n=S.fens.length;
  (function next(){if(SS.review!==S)return;if(i>=n){classify(S);S.done=true;S.view=S.moves.length?1:0;sfx('ok');if(cur()===S)renderAll();return;}
    eng.rev.go({fen:S.fens[i],moves:[],depth:16,timeMs:n>90?220:320,multipv:2,local:{timeMs:n>80?180:260,maxDepth:9}}).then(function(r){if(SS.review!==S)return;
      if(!r){setTimeout(next,40);return;}
      S.evals[i]=r.scoreW;S.mates[i]=r.mateW||0;S.terms[i]=r.term||'';S.bests[i]=r.best;S.seconds[i]=r.lines&&r.lines[1]?r.lines[1]:null;i++;S.prog=i/n;
      var bar=$('#revprog');if(bar){bar.style.width=(S.prog*100).toFixed(1)+'%';var t=$('#revtxt');if(t)t.textContent='Analyzing move '+Math.min(i,n-1)+' of '+(n-1);}
      next();});})();}
function wpOf(S,i,sg){if(S.terms[i]==='mate')return S.evals[i]*sg>0?100:0;if(S.terms[i]==='stalemate')return 50;var m=S.mates[i];if(m)return m*sg>0?100:0;return wp(sg*S.evals[i]);}
function classify(S){
  var sanArr=sans(S);S.cls=[];S.accs=[];
  for(var i=0;i<S.moves.length;i++){var mv=S.moves[i],sg=mv.color===0?1:-1;
    var before=wpOf(S,i,sg),after=wpOf(S,i+1,sg),drop=Math.max(0,before-after),k;
    var isBest=S.bests[i]===mv.uci;
    if(S.startFen===START&&i<16&&isBook(sanArr,i))k='book';
    else if(S.terms[i+1]==='mate'||isBest||drop<=1.5){k='best';
      var sec=S.seconds[i];if(isBest&&sec&&before<96){var sw=sec.mateW?(sec.mateW*sg>0?100:0):wp(sg*sec.scoreW);if(before-sw>=12&&after>=35)k='great';}}
    else if(drop<=4)k='excellent';else if(drop<=9)k='good';else if(drop<=16)k='inaccuracy';else if(drop<=27)k='mistake';else k='blunder';
    if((k==='best'||k==='excellent'||k==='great')&&before<92&&after>=45&&isSac(S,i))k='brilliant';
    if(i>0&&['mistake','blunder'].indexOf(S.cls[i-1])>=0&&['inaccuracy','mistake','blunder'].indexOf(k)>=0&&before>=62&&after<before-10)k='miss';
    S.cls.push(k);S.accs.push(k==='book'?100:Math.max(0,Math.min(100,103.1668*Math.exp(-0.04354*drop)-3.1669)));}
  S.acc=[0,1].map(function(c){var a=[];S.moves.forEach(function(m,i){if(m.color===c)a.push(S.accs[i]);});if(!a.length)return null;var mean=a.reduce(function(x,y){return x+y;},0)/a.length,harm=a.length/a.reduce(function(x,y){return x+1/Math.max(y,5);},0);return (mean+harm)/2;});}
function perfOf(acc){if(acc==null)return null;var P=[[0,100],[40,400],[60,900],[70,1250],[80,1650],[90,2150],[95,2500],[100,2900]];for(var i=1;i<P.length;i++)if(acc<=P[i][0]){var a=P[i-1],b=P[i];return Math.round((a[1]+(b[1]-a[1])*(acc-a[0])/(b[0]-a[0]))/50)*50;}return 2900;}
function isSac(S,i){var mv=S.moves[i],P=new Pos(S.fens[i+1]),pc=P.b[mv.to];if(!pc)return false;var t=pc&7;if(t===1||t===6)return false;
  var v=VAL[t],cv=mv.cap?VAL[mv.cap&7]:0;if(cv>=v)return false;var opp=P.turn,me=opp^1;if(!P.attacked(mv.to,opp))return false;
  var i120=M64[mv.to],pawnHit=false;(opp===0?[9,11]:[-9,-11]).forEach(function(x){var j=M120[i120+x];if(j>=0&&P.b[j]===(1|(opp<<3)))pawnHit=true;});
  return pawnHit||!P.attacked(mv.to,me);}
function reviewPanel(S){
  if(!S.done)return '<div class="ph"><h2>Game review</h2><span class="meta">'+engineName()+'</span></div><div class="pbody"><div class="msg info" style="flex-direction:column;align-items:stretch;gap:10px"><span id="revtxt">Analyzing move 0 of '+S.moves.length+'</span><div class="prog"><i id="revprog" style="width:'+(S.prog*100)+'%"></i></div></div><div class="mvl" id="mvlist"></div></div><div class="ctrl" id="ctrl"></div>';
  var inf=[playerInfo(S,0),playerInfo(S,1)];
  function accCell(c){var a=S.acc[c],pf=perfOf(a);return '<div>'+avatar(inf[c].av,'sm')+'<span><b>'+(a==null?'–':a.toFixed(1))+'</b><small>'+esc(inf[c].name)+(pf?', plays like '+pf:'')+'</small></span></div>';}
  var counts=CLS_ORDER.map(function(k){var w=0,b=0;S.cls.forEach(function(x,i){if(x===k){if(S.moves[i].color===0)w++;else b++;}});
    return '<span class="c"><i style="background:'+CLS[k].c+'">'+CLS[k].g+'</i>'+CLS[k].l+'</span><span class="n'+(w?'':' z')+'">'+w+'</span><span class="n'+(b?'':' z')+'">'+b+'</span>';}).join('');
  return '<div class="ph"><h2>Game review</h2><button class="btn sm" data-act="toanalysis">'+I.analysis+'Analyze</button></div><div class="pbody">'+
   '<div class="acc">'+accCell(0)+accCell(1)+'</div>'+graphSvg(S)+'<div class="coach" id="coach"></div>'+
   '<div class="ctab"><span></span><span class="hd">White</span><span class="hd">Black</span>'+counts+'</div>'+
   '<div class="mvl" id="mvlist"></div><button class="btn ghost sm" style="align-self:flex-start" data-act="revpgn">'+I.copy+'Copy PGN</button></div><div class="ctrl" id="ctrl"></div>';}
function graphSvg(S){var n=S.evals.length,W=300,H=64;if(n<2)return '';
  var pts=S.evals.map(function(e,i){return [i/(n-1)*W,H-wpOf(S,i,1)/100*H];});
  var d='M0 '+H+' '+pts.map(function(p){return 'L'+p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' ')+' L'+W+' '+H+' Z';
  var dots=S.cls.map(function(k,i){if(['blunder','mistake','miss','brilliant','great'].indexOf(k)<0)return '';var p=pts[i+1];return '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.2" fill="'+CLS[k].c+'" stroke="#2e2c27" stroke-width="1"/>';}).join('');
  return '<svg class="graph" id="graph" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="Evaluation over the game"><path d="'+d+'" fill="#efe9da" opacity=".93"/><line x1="0" y1="'+H/2+'" x2="'+W+'" y2="'+H/2+'" stroke="#8a8578" stroke-width=".6" stroke-dasharray="3 3"/>'+dots+'<line id="gcur" x1="0" x2="0" y1="0" y2="'+H+'" stroke="#c9a45c" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';}
function updateReview(S){if(!S.done)return;var g=$('#gcur');if(g){var x=S.view/Math.max(1,S.fens.length-1)*300;g.setAttribute('x1',x);g.setAttribute('x2',x);}
  var c=$('#coach');if(!c)return;
  if(S.view===0){c.innerHTML='<div class="g" style="background:var(--baize3)">'+I.bolt.replace('<svg','<svg width="16" height="16"')+'</div><div><b>Step through the game</b><p>Use the arrows below or the ← and → keys. Each move gets a verdict and, where it matters, the better alternative.</p></div>';return;}
  var i=S.view-1,k=S.cls[i],m=CLS[k],mv=S.moves[i],best='';
  if(S.bests[i]&&['best','brilliant','great','book'].indexOf(k)<0){var P=new Pos(S.fens[i]),bm=P.parseUci(S.bests[i]);if(bm)best=P.san(bm);}
  var o=openingOf(sans(S,i+1));
  var txt={brilliant:'A sound sacrifice. The material comes back or the attack is decisive.',great:'The only good move in the position. Everything else was clearly worse.',best:'The strongest move in the position.',excellent:'Very close to the best move.',good:'A solid move, though a stronger one was available.',book:(o?o.name:'Opening theory')+'. A well-known move.',inaccuracy:'This lets some of the advantage slip.',mistake:'A real error. The evaluation shifts noticeably.',miss:'Your opponent had just gone wrong and this move does not take advantage of it.',blunder:'A serious error that changes the course of the game.'}[k];
  var verdict={brilliant:'is brilliant',great:'is a great move',best:'is the best move',excellent:'is excellent',good:'is good',book:'is a book move',inaccuracy:'is an inaccuracy',mistake:'is a mistake',miss:'is a missed chance',blunder:'is a blunder'}[k];
  c.innerHTML='<div class="g" style="background:'+m.c+'">'+m.g+'</div><div><b>'+esc(mv.san)+' '+verdict+'</b><p>'+esc(txt)+(best?' The best move was <b style="display:inline;color:var(--win)">'+esc(best)+'</b>.':'')+' Evaluation '+fmtEval(S.evals[i+1],S.mates[i+1],S.terms[i+1])+'.</p></div>';}

/* ---------- spectating ---------- */
function watchPanel(S){var A=S.players[0],B=S.players[1];
  return '<div class="ph"><h2>'+esc(A.name)+' vs '+esc(B.name)+'</h2></div><div class="pbody"><p class="note">'+(S.rated?'Rated ':'Casual ')+(S.tc.base?S.tc.label+' '+S.tc.cat.toLowerCase():'game without a clock')+(S.spect?', '+S.spect+' watching':'')+'</p>'+
   (S.over?'<div class="msg info">'+(S.over.result==='1/2-1/2'?'Draw':(S.over.result==='1-0'?A.name:B.name)+' won')+' by '+esc(S.over.reason)+'</div>':'')+
   '<div class="opening" id="openName"></div><div class="mvl" id="mvlist"></div></div><div class="pfoot"><button class="btn" data-act="leavewatch">'+I.prev+'All games</button>'+(S.over?'<button class="btn pri" style="flex:1" data-act="watchreview">Game review</button>':'')+'</div><div class="ctrl" id="ctrl"></div>';}
