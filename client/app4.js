/* ---------- pages ---------- */
var dailyPz=null,profCat=store.get('profcat','blitz'),commTab='leaderboard';
function renderPage(){
  var h='';
  if(route==='home')h=homePage();else if(route==='watch')h=watchPage();else if(route==='community')h=communityPage();else if(route==='profile')h=profilePage();else if(route==='prefs')h=prefsPage();
  setPage(h);}
/* Re-render a page without replaying the entry animation, losing scroll, or dropping what is typed in a field. */
var lastPage={seq:-1,html:null};
function setPage(html){var same=lastPage.seq===navSeq;
  if(same&&lastPage.html===html)return;
  var ae=document.activeElement,aid=ae&&ae.id&&pageEl.contains(ae)?ae.id:null,av=aid&&'value' in ae?ae.value:null,sel=null;
  try{if(aid)sel=[ae.selectionStart,ae.selectionEnd];}catch(e){}
  var st=pageEl.scrollTop,wy=window.scrollY;
  pageEl.innerHTML='<div class="wrap'+(same?'':' enter')+'">'+html+'</div>';
  lastPage={seq:navSeq,html:html};
  if(same){pageEl.scrollTop=st;if(window.scrollY!==wy)window.scrollTo(0,wy);}
  if(aid){var n=document.getElementById(aid);if(n){if(av!=null)n.value=av;try{n.focus({preventScroll:true});if(sel&&sel[0]!=null)n.setSelectionRange(sel[0],sel[1]);}catch(e){}}}}
function activeBanner(){var S=SS.play;
  if(S&&!S.setup&&S.active&&!S.over)return '<div class="banner">'+avatar(S.online?S.opp.avatar:S.local?{p:'k',c:6}:S.bot.av,'sm')+'<span>Your game '+(S.local?'on this device':'against <b>'+esc(S.online?S.opp.name:S.bot.name)+'</b>')+' is in progress.</span><a class="btn brass" href="#play">Return to game</a></div>';
  if(NET.cfg&&NET.cfg.maintenance)return '<div class="banner">'+I.warn.replace('<svg','<svg width="20" height="20"')+'<span><b>Maintenance.</b> New online games are paused for a short while. Bots, puzzles and analysis still work.</span></div>';
  if(NET.announce&&NET.announce.text)return '<div class="banner">'+I.bolt.replace('<svg','<svg width="20" height="20"')+'<span>'+esc(NET.announce.text)+'</span></div>';
  return '';}
function homePage(){
  var name=myName(),guest=NET.me&&NET.me.guest;
  var sub=ONLINE?(NET.ok?'<span class="netdot"></span><span id="netstats">'+statsText()+'</span>':'Connecting to your server…'):'Offline mode. Online play, friends and Stockfish run on your Rookery server.';
  var left='';
  if(ONLINE){
    left+='<section class="blk"><h2>Quick pairing</h2><div class="quickgrid">'+TCS.map(function(t){var p=t[0].split('+'),cat=tcCat(t[0]),r=NET.me?NET.me.ratings[cat].r:'';
      return '<button class="qt'+(NET.queue===t[0]?' busy':'')+'" data-act="quick" data-k="'+t[0]+'" aria-label="'+p[0]+' minutes plus '+p[1]+' seconds"><b>'+p[0]+'<em>+</em>'+p[1]+'</b><small>'+t[1]+'<span>'+(NET.queue===t[0]?'Searching':r)+'</span></small></button>';}).join('')+'</div>'+
      (NET.queue?'<div class="row"><p class="note" style="flex:1">Looking for a '+tcParse(NET.queue).label+' opponent. You can browse while you wait.</p><button class="btn sm" data-act="cancelq">Cancel</button></div>':'')+'</section>';}
  left+='<section class="blk"><h2>More ways to play</h2><div class="acts">'+
    '<button class="act" data-act="goplay" data-k="bot"><span class="ic">'+I.bot+'</span><span><b>Play the computer</b><small>Seven opponents from 250 to 3000</small></span></button>'+
    (ONLINE?'<button class="act" data-act="goplay" data-k="friend"><span class="ic">'+I.friend+'</span><span><b>Play a friend</b><small>Invite link, code or challenge</small></span></button>':'<a class="act" href="#analysis"><span class="ic">'+I.analysis+'</span><span><b>Analysis board</b><small>Explore any position</small></span></a>')+
    '<button class="act" data-act="goplay" data-k="local"><span class="ic">'+I.users+'</span><span><b>Pass and play</b><small>Two players, one device</small></span></button></div></section>';
  if(ONLINE){var lv=NET.live.slice(0,3);
    left+='<section class="blk"><h2>Live now<a class="lnk" href="#watch">All games</a></h2>'+(lv.length?'<div class="livegrid">'+lv.map(liveCard).join('')+'</div>':'<div class="card"><p class="note">No games are being played right now. Start one and it shows up here for others to watch.</p></div>')+'</section>';}
  left+=recentBlock(5);
  var right='';
  var dp=dailyPz;right+='<section class="blk"><h2>Daily puzzle</h2><div class="card daily">'+(dp?'<div>'+miniBoard(dp.fen,dp.setup?(new Pos(dp.fen).turn^1):new Pos(dp.fen).turn,null)+'</div><div><b style="font:600 20px var(--serif)">'+new Date().toLocaleDateString(undefined,{weekday:'long'})+'</b><p class="note">Rated '+dp.rating+'. '+(dp.setup?'Your opponent moves first.':'You move first.')+'</p><button class="btn pri sm" style="margin-top:10px" data-act="daily">Solve it</button></div>':'<div class="skel" style="aspect-ratio:1"></div><div class="skel" style="height:60px"></div>')+'</div></section>';
  right+='<section class="blk"><h2>Your ratings<a class="lnk" href="#profile">Profile</a></h2><div class="card list">'+
    (NET.me?['bullet','blitz','rapid'].map(function(c){var r=NET.me.ratings[c];return '<div class="li"><span class="tx"><b>'+c[0].toUpperCase()+c.slice(1)+'</b><small>'+r.games+' game'+(r.games===1?'':'s')+'</small></span><span class="rt">'+r.r+(r.games<10?'?':'')+'</span></div>';}).join(''):'')+
    '<div class="li"><span class="tx"><b>Puzzles</b><small>'+(NET.me?NET.me.puzzle.solved:profile.pzSolved)+' solved</small></span><span class="rt">'+pzRating()+'</span></div>'+
    '<div class="li"><span class="tx"><b>Computer</b><small>'+(profile.w+profile.l+profile.d)+' games</small></span><span class="rt">'+profile.rating+'</span></div></div>'+
    (guest?'<div class="card"><p class="note" style="margin-bottom:12px">You are playing as a guest. Create an account to keep your ratings on any device and add friends.</p><div class="row"><button class="btn pri" data-act="signup">Create account</button><button class="btn" data-act="login">Sign in</button></div></div>':'')+'</section>';
  if(ONLINE&&NET.me&&!NET.me.guest){var fl=(NET.friends.list||[]).slice().sort(function(a,b){return (a.status==='offline')-(b.status==='offline');}).slice(0,6);
    right+='<section class="blk"><h2>Friends<a class="lnk" href="#community" data-act="ctab" data-k="friends">Manage</a></h2><div class="card list">'+(fl.length?fl.map(friendRow).join(''):'<p class="note">Add friends by username to challenge them and see when they are online.</p>')+'</div></section>';}
  return activeBanner()+'<header class="ptitle"><div><h1>'+greeting()+', '+esc(name)+'.</h1><p>'+sub+'</p></div></header><div class="cols"><div class="stack">'+left+'</div><div class="stack">'+right+'</div></div>';}
function liveCard(g){var top=g.black,bot=g.white,cl=g.clock||[0,0];
  function pl(p,c){return '<div class="pl">'+avatar(p.avatar,'xs')+'<b>'+esc(p.name)+'</b><span>'+p.rating+'</span>'+(tcParse(g.tc).base?'<em>'+fmtClock(cl[c],false)+'</em>':'')+'</div>';}
  return '<button class="lgame" data-act="watchgame" data-gid="'+g.gid+'">'+pl(top,1)+miniBoard(g.fen,0,g.last)+pl(bot,0)+'<small class="fine">'+tcParse(g.tc).label+' '+tcParse(g.tc).cat.toLowerCase()+(g.spect?', '+g.spect+' watching':'')+'</small></button>';}
function friendRow(f){return '<div class="li">'+avatar(f.avatar,'sm',f.status)+'<span class="tx"><b>'+ttl(f.title)+esc(f.name)+'</b><small>'+(f.status==='playing'?'Playing now':f.status==='online'?'Online':'Offline')+', blitz '+f.rating+'</small></span>'+
  (f.status==='online'?'<button class="btn sm" data-act="challengeTo" data-id="'+f.id+'" data-name="'+esc(f.name)+'">Challenge</button>':f.status==='playing'&&f.gid?'<button class="btn sm" data-act="watchgame" data-gid="'+f.gid+'">Watch</button>':'')+
  '<button class="btn ghost sm" data-act="player" data-id="'+f.id+'" aria-label="Profile of '+esc(f.name)+'">'+I.profile+'</button></div>';}
function allGames(){var out=[];
  (NET.history||[]).forEach(function(g){var me=g.color,opp=me?g.white:g.black,res=g.result==='1/2-1/2'?'D':((g.result==='1-0')===(me===0)?'W':'L');
    out.push({ts:g.ts,res:res,title:'vs '+opp.name,sub:tcParse(g.tc).label+' '+(g.rated?'rated':'casual')+', '+g.reason,delta:(me?g.black:g.white).a-(me?g.black:g.white).r,act:'revserver',id:g.id});});
  profile.games.forEach(function(r,i){var b=r.bot?BOTS.find(function(x){return x.id===r.bot;}):null;var res=r.local?'D':(r.score===1?'W':r.score===0?'L':'D');
    out.push({ts:r.date||Date.parse(r.date)||0,res:r.local?(r.result==='1/2-1/2'?'D':'·'):res,local:r.local,title:r.local?'Pass and play':'vs '+(b?b.name:'Computer'),sub:(r.tc&&r.tc!=='none'?tcParse(r.tc).label+', ':'')+r.reason,delta:r.delta,act:'revlocal',id:i});});
  return out.sort(function(a,b){return b.ts-a.ts;});}
function recentBlock(n){var g=allGames().slice(0,n);
  return '<section class="blk"><h2>Recent games'+(g.length?'<a class="lnk" href="#profile">See all</a>':'')+'</h2><div class="card list">'+(g.length?g.map(gameRow).join(''):'<p class="note">Finished games appear here with a full review.</p>')+'</div></section>';}
function gameRow(g){var pill=g.local?(g.res==='D'?'½':'1–0'):g.res;return '<div class="li clk" data-act="'+g.act+'" data-id="'+g.id+'"><span class="res '+(g.res==='·'?'D':g.res)+'">'+pill+'</span><span class="tx"><b>'+esc(g.title)+'</b><small>'+esc(g.sub)+', '+ago(g.ts)+'</small></span>'+(g.delta!=null&&!isNaN(g.delta)?'<span class="delta '+(g.delta>0?'up':g.delta<0?'dn':'')+'">'+(g.delta>0?'+':g.delta<0?'−':'±')+Math.abs(g.delta)+'</span>':'')+'</div>';}
function watchPage(){var lv=NET.live;
  return '<header class="ptitle"><div><h1>Watch</h1><p>'+(ONLINE?'Games being played on your server right now.':'Watching live games works on your Rookery server.')+'</p></div>'+(ONLINE?'<button class="btn" data-act="refreshlive">Refresh</button>':'')+'</header>'+
    (lv.length?'<div class="livegrid">'+lv.map(liveCard).join('')+'</div>':'<div class="card"><p class="note">Nobody is playing at the moment. Live games appear here as soon as they start.</p></div>');}
function communityPage(){
  var tabs='<div class="ptabs">'+[['leaderboard','Leaderboard'],['friends','Friends'+((NET.friends.incoming||[]).length?' ('+NET.friends.incoming.length+')':'')],['find','Find players']].map(function(t){return '<button class="'+(commTab===t[0]?'on':'')+'" data-act="ctab" data-k="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div>';
  var body='';
  if(!ONLINE)body='<div class="card"><p class="note">Leaderboards, friends and player search work on your Rookery server.</p></div>';
  else if(commTab==='leaderboard'){var cat=NET.lbCat||'blitz',rows=NET.lb[cat];
    body='<div class="seg" style="max-width:360px;margin-bottom:14px">'+['bullet','blitz','rapid'].map(function(c){return '<button class="'+(cat===c?'on':'')+'" data-act="lbcat" data-k="'+c+'">'+c[0].toUpperCase()+c.slice(1)+'</button>';}).join('')+'</div>'+
      '<div class="card list">'+(rows?(rows.length?rows.map(function(r,i){return '<div class="li clk'+(NET.me&&r.id===NET.me.id?' me':'')+'" data-act="player" data-id="'+r.id+'"><span class="rk">'+(i+1)+'</span>'+avatar(r.avatar,'sm',r.online?'online':null)+'<span class="tx"><b>'+ttl(r.title)+esc(r.name)+'</b><small>'+r.games+' game'+(r.games===1?'':'s')+'</small></span><span class="rt">'+r.rating+'</span></div>';}).join(''):'<p class="note">No rated '+cat+' games yet. Players with an account appear here after their first game.</p>'):'<div class="skel" style="height:160px"></div>')+'</div>';}
  else if(commTab==='friends'){
    if(!NET.me||NET.me.guest)body='<div class="card"><p class="note" style="margin-bottom:12px">Create an account to add friends, see when they are online and challenge them directly.</p><div class="row" style="max-width:360px"><button class="btn pri" data-act="signup">Create account</button><button class="btn" data-act="login">Sign in</button></div></div>';
    else{var F=NET.friends;
      body='<div class="cols"><div class="stack">'+
        ((F.incoming||[]).length?'<section class="blk"><h2>Friend requests</h2><div class="card list">'+F.incoming.map(function(f){return '<div class="li">'+avatar(f.avatar,'sm')+'<span class="tx"><b>'+esc(f.name)+'</b><small>Blitz '+f.rating+'</small></span><button class="btn pri sm" data-act="facc" data-id="'+f.id+'">Accept</button><button class="btn sm" data-act="fdec" data-id="'+f.id+'">Decline</button></div>';}).join('')+'</div></section>':'')+
        '<section class="blk"><h2>Friends</h2><div class="card list">'+((F.list||[]).length?F.list.slice().sort(function(a,b){return (a.status==='offline')-(b.status==='offline');}).map(friendRow).join(''):'<p class="note">No friends yet. Add someone by their username.</p>')+'</div></section></div>'+
        '<div class="stack"><section class="blk"><h2>Add a friend</h2><form class="card joinrow" data-form="addfriend"><input id="friendIn" placeholder="Username" autocomplete="off" spellcheck="false" aria-label="Username"><button class="btn pri" type="submit">Send request</button></form></section>'+
        ((F.outgoing||[]).length?'<section class="blk"><h2>Sent requests</h2><div class="card list">'+F.outgoing.map(function(f){return '<div class="li">'+avatar(f.avatar,'sm')+'<span class="tx"><b>'+esc(f.name)+'</b><small>Waiting for a reply</small></span><button class="btn ghost sm" data-act="frem" data-id="'+f.id+'">Cancel</button></div>';}).join('')+'</div></section>':'')+'</div></div>';}}
  else body='<form class="joinrow" data-form="search" style="max-width:480px;margin-bottom:14px"><input id="searchIn" placeholder="Search by username" autocomplete="off" spellcheck="false" aria-label="Search players"><button class="btn" type="submit">'+I.search+'Search</button></form><div class="card list" id="searchRes"><p class="note">Type at least two letters.</p></div>';
  return '<header class="ptitle"><div><h1>Community</h1><p>'+(ONLINE&&NET.ok?statsText()+'.':'Players on your server.')+'</p></div></header>'+tabs+body;}
function renderSearch(){var el=$('#searchRes');if(!el)return;el.innerHTML=NET.search.length?NET.search.map(function(r){return '<div class="li clk" data-act="player" data-id="'+r.id+'">'+avatar(r.avatar,'sm',r.online?'online':null)+'<span class="tx"><b>'+esc(r.name)+'</b><small>Blitz '+r.rating+'</small></span></div>';}).join(''):'<p class="note">No players found.</p>';}
function ratingChart(hist,cat){var pts=(hist||[]).filter(function(h){return h[1]===cat;});
  if(pts.length){var base={bullet:1200,blitz:1200,rapid:1200,puzzle:1500,bots:800}[cat];pts.unshift([pts[0][0]-60000,cat,base]);}
  if(pts.length<2)return '<p class="note" style="padding:30px 0;text-align:center">Play a few '+(cat==='bots'?'computer':cat)+' games to see your rating over time.</p>';
  var W=720,H=200,pad=34,vals=pts.map(function(p){return p[2];}),mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals);
  var lo=Math.floor((mn-20)/50)*50,hi=Math.ceil((mx+20)/50)*50;if(hi-lo<100)hi=lo+100;
  var x=function(i){return pad+i/(pts.length-1)*(W-pad-8);},y=function(v){return 10+(1-(v-lo)/(hi-lo))*(H-34);};
  var line=pts.map(function(p,i){return (i?'L':'M')+x(i).toFixed(1)+' '+y(p[2]).toFixed(1);}).join(' ');
  var area=line+' L'+x(pts.length-1).toFixed(1)+' '+(H-24)+' L'+x(0)+' '+(H-24)+' Z';
  var ticks='',step=(hi-lo)>400?200:(hi-lo)>200?100:50;for(var v=lo;v<=hi;v+=step)ticks+='<line x1="'+pad+'" x2="'+W+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#2c3831" stroke-width="1"/><text x="0" y="'+(y(v)+4)+'">'+v+'</text>';
  var d0=new Date(pts[0][0]),d1=new Date(pts[pts.length-1][0]),f=function(d){return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});};
  var lp=pts[pts.length-1];
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Rating history"><defs><linearGradient id="rg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c9a45c" stop-opacity=".28"/><stop offset="1" stop-color="#c9a45c" stop-opacity="0"/></linearGradient></defs>'+ticks+
    '<path d="'+area+'" fill="url(#rg)"/><path d="'+line+'" fill="none" stroke="#e0c389" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="'+x(pts.length-1)+'" cy="'+y(lp[2])+'" r="4.5" fill="#e0c389" stroke="#18211c" stroke-width="2"/>'+
    '<text x="'+pad+'" y="'+(H-6)+'">'+f(d0)+'</text><text x="'+W+'" y="'+(H-6)+'" text-anchor="end">'+f(d1)+'</text></svg>';}
function profilePage(){
  var me=NET.me,a=myAvatar(),guest=!me||me.guest;
  var since=me?new Date(me.created).toLocaleDateString(undefined,{month:'long',year:'numeric'}):'';
  var acct='';
  if(ONLINE&&me){acct=guest?'<button class="btn pri" data-act="signup">Create account</button><button class="btn" data-act="login">Sign in</button>':'<button class="btn" data-act="password">Change password</button><button class="btn ghost" data-act="logout">'+I.out+'Sign out</button>';}
  var hist=(me?me.hist:[]).concat(profile.hist);
  var cards=[];if(me)['bullet','blitz','rapid'].forEach(function(c){var r=me.ratings[c];cards.push([c,c[0].toUpperCase()+c.slice(1),r.r+(r.games<10?'?':''),r.games+' game'+(r.games===1?'':'s')+', best '+r.peak,c==='bullet'?I.bolt:c==='blitz'?I.clock:I.cal]);});
  cards.push(['puzzle','Puzzles',pzRating(),(me?me.puzzle.solved:profile.pzSolved)+' solved, best streak '+(me?me.puzzle.best:profile.pzBest),I.puzzle]);
  cards.push(['bots','Computer',profile.rating,profile.w+' wins, '+profile.l+' losses, '+profile.d+' draws',I.bot]);
  if(!cards.some(function(c){return c[0]===profCat;}))profCat=cards[0][0];
  var g=allGames();
  return '<header class="ptitle prof"><div class="phead"><button class="avbtn" data-act="avatar" aria-label="Change avatar" title="Change avatar">'+avatar(a,'xl')+'</button><div style="min-width:0"><h1>'+esc(myName())+'</h1><p>'+(me?(guest?'Guest player':'Member since '+since):'Playing offline on this device')+'</p></div></div><div class="row">'+acct+'<a class="btn ghost" href="#prefs">'+I.prefs+'Settings</a></div></header>'+
    '<div class="rcards" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">'+cards.map(function(c){return '<button class="rc'+(profCat===c[0]?' on':'')+'" data-act="profcat" data-k="'+c[0]+'"><small>'+c[4]+c[1]+'</small><b>'+c[2]+'</b><span>'+c[3]+'</span></button>';}).join('')+'</div>'+
    '<div class="card" style="margin-top:14px">'+ratingChart(hist,profCat)+'</div>'+
    '<section class="blk" style="margin-top:28px"><h2>Games</h2><div class="card list">'+(g.length?g.slice(0,40).map(gameRow).join(''):'<p class="note">Your finished games show up here, each with a full review.</p>')+'</div></section>';}
function prefsPage(){
  var bs=Object.keys(BOARDS).map(function(k){var t=BOARDS[k];return '<button class="'+(settings.board===k?'on':'')+'" data-act="board" data-k="'+k+'"><span class="sw"><i style="background:'+t.l+'"></i><i style="background:'+t.d+'"></i><i style="background:'+t.d+'"></i><i style="background:'+t.l+'"></i></span>'+t.n+'</button>';}).join('');
  var ps=Object.keys(SET_NAMES).map(function(k){return '<button class="'+(settings.pieces===k?'on':'')+'" data-act="pieces" data-k="'+k+'"><span class="ps"><i style="background-image:'+pieceUrl(k,'wN')+'"></i></span>'+SET_NAMES[k]+'</button>';}).join('');
  function row(k,t,s){return '<div class="set"><div><b>'+t+'</b><small>'+s+'</small></div><button class="tog'+(settings[k]?' on':'')+'" data-act="set" data-k="'+k+'" aria-label="'+t+'" aria-pressed="'+!!settings[k]+'"></button></div>';}
  return '<header class="ptitle"><div><h1>Settings</h1><p>Saved on this device.</p></div></header><div class="cols"><div class="stack">'+
    '<section class="blk"><h2>Board</h2><div class="card"><div class="swatches">'+bs+'</div></div></section>'+
    '<section class="blk"><h2>Pieces</h2><div class="card"><div class="swatches">'+ps+'</div></div></section>'+
    '<section class="blk"><h2>Gameplay</h2><div class="card" style="padding-block:4px">'+row('sound','Sounds','Moves, captures, checks and low time')+row('premove','Premoves','Plan your next move while your opponent thinks')+row('legal','Show legal moves','Dots on the squares a piece can reach')+row('coords','Coordinates','Files and ranks on the board edge')+row('anim','Piece animation','Slide pieces between squares')+row('autoQueen','Always promote to a queen','Skip the promotion picker')+row('autoFlip','Flip in pass and play','Turn the board toward the player to move')+row('evalInGame','Evaluation bar after games','Also shown during pass and play')+row('confirm','Confirm resign and draw','Ask for a second click')+'</div></section></div>'+
    '<div class="stack">'+(ONLINE?'':'<section class="blk"><h2>Your name</h2><div class="card"><input id="nameIn" maxlength="20" value="'+esc(settings.name)+'" autocomplete="off" aria-label="Display name"></div></section>')+
    '<section class="blk"><h2>About Rookery</h2><div class="card" style="display:grid;gap:10px"><p class="note">Engine: '+engineName()+'. '+(ONLINE?'Version 3.3, running on your own server.':'Offline edition.')+'</p>'+
    '<p class="fine">Keyboard: ← and → step through moves, F flips the board. Right-click and drag to draw arrows.</p>'+
    '<p class="fine"><a href="#licenses">Licenses and credits</a> · <a href="#terms">Terms</a> · <a href="#privacy">Privacy</a></p></div></section></div></div>';}

/* ---------- modals ---------- */
function authModal(mode){
  var su=mode==='signup';
  openModal('<h2>'+(su?'Create your account':'Sign in')+'</h2><p class="note">'+(su?'Your current ratings and games move to the new account.':'Use the username and password you chose.')+'</p>'+
    '<form class="form" data-form="'+mode+'"><label>Username<input name="u" id="authU" autocomplete="username" maxlength="20" spellcheck="false" required></label><label>Password<input name="p" id="authP" type="password" autocomplete="'+(su?'new-password':'current-password')+'" minlength="8" required></label>'+
    '<div class="err" role="alert"></div><button class="btn pri lg" type="submit">'+(su?'Create account':'Sign in')+'</button>'+
    '<button type="button" class="btn ghost" data-act="'+(su?'login':'signup')+'">'+(su?'I already have an account':'Create a new account')+'</button></form>');}
function passwordModal(){openModal('<h2>Change password</h2><form class="form" data-form="password"><label>Current password<input id="pwOld" type="password" autocomplete="current-password" required></label><label>New password<input id="pwNew" type="password" autocomplete="new-password" minlength="8" required></label><div class="err" role="alert"></div><button class="btn pri lg" type="submit">Change password</button></form>');}
function avatarModal(){var a=myAvatar();
  openModal('<h2>Your avatar</h2><p class="note">Pick a piece and a color.</p><div class="form"><div class="avpick">'+'kqrbnp'.split('').map(function(p){return '<button class="'+(a.p===p?'on':'')+'" data-act="avp" data-k="'+p+'">'+avatar({p:p,c:a.c},'')+'</button>';}).join('')+'</div><div class="avpick">'+TINTS.map(function(t,i){return '<button class="'+(a.c===i?'on':'')+'" data-act="avc" data-k="'+i+'">'+avatar({p:a.p,c:i},'sm')+'</button>';}).join('')+'</div></div>');}
function setAvatar(a){if(NET.me){NET.me.avatar=a;netSend({t:'profile',avatar:a});}else store.set('avatar',a);var m=modalStack[modalStack.length-1];if(m){closeModal(m);avatarModal();}renderNav();if(!isBoardRoute())renderPage();}
function challengeModal(id,name){var sel=store.get('chtc','5+0'),col='r';
  openModal('<h2>Challenge '+esc(name)+'</h2><p class="note">They have a minute to accept.</p><div class="form"><div class="h">Time control</div>'+tcTiles(sel,'chtc',true)+'<div class="h">You play</div><div class="seg" id="chcol">'+[['w','White'],['r','Random'],['b','Black']].map(function(x){return '<button class="'+(x[0]==='r'?'on':'')+'" data-act="chcol" data-c="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div><button class="btn pri lg" data-act="sendch" data-id="'+id+'">Send challenge</button></div>',{wide:false});}
function showChallenge(m){var tc=tcParse(m.tc);
  openModal('<div class="challenge" data-cid="'+m.cid+'">'+avatar(m.from.avatar,'lg')+'<div><h2>'+esc(m.from.name)+' challenges you</h2><p class="note">'+(m.from.rating?'Rated '+m.from.rating+'. ':'')+(m.color==='w'?'They play White.':m.color==='b'?'They play Black.':'Colors are random.')+'</p></div><div class="tt">'+(tc.base?tc.label:'No clock')+'</div><div class="timer"><i></i></div><div class="row" style="width:100%"><button class="btn" data-act="chno" data-cid="'+m.cid+'">Decline</button><button class="btn pri" data-act="chyes" data-cid="'+m.cid+'">Accept</button></div></div>',{noclose:true});}
function showPlayer(p){
  var cat=['bullet','blitz','rapid'],me=NET.me&&NET.me.id===p.id;
  var fbtn=me||p.guest||!NET.me||NET.me.guest?'':p.friend==='yes'?'<button class="btn ghost" data-act="frem" data-id="'+p.id+'">Remove friend</button>':p.friend==='sent'?'<button class="btn" disabled>Request sent</button>':p.friend==='incoming'?'<button class="btn pri" data-act="facc" data-id="'+p.id+'">Accept request</button>':'<button class="btn" data-act="fadd" data-id="'+p.id+'">'+I.friend+'Add friend</button>';
  var ch=!me&&p.status==='online'?'<button class="btn pri" data-act="challengeTo" data-id="'+p.id+'" data-name="'+esc(p.name)+'">Challenge</button>':(!me&&p.status==='playing'&&p.gid?'<button class="btn" data-act="watchgame" data-gid="'+p.gid+'">'+I.eye+'Watch</button>':'');
  openModal('<div style="display:flex;gap:16px;align-items:center">'+avatar(p.avatar,'lg',p.status)+'<div><h2 style="margin:0">'+ttl(p.title)+esc(p.name)+'</h2><p class="note">'+(p.status==='playing'?'Playing now':p.status==='online'?'Online':'Last seen '+ago(p.seen||p.created))+', joined '+new Date(p.created).toLocaleDateString(undefined,{month:'short',year:'numeric'})+'</p></div></div>'+
    '<div class="stats" style="grid-template-columns:repeat(4,1fr);margin-top:18px">'+cat.map(function(c){var r=p.ratings[c];return '<div class="stat"><small>'+c[0].toUpperCase()+c.slice(1)+'</small><b>'+r.r+'</b><small>'+r.w+'W '+r.l+'L '+r.d+'D</small></div>';}).join('')+'<div class="stat"><small>Puzzles</small><b>'+p.puzzle+'</b></div></div>'+
    '<div class="row" style="margin-top:16px">'+ch+fbtn+'</div>'+
    (p.games.length?'<div class="h" style="margin-top:20px;margin-bottom:6px">Recent games</div><div class="list">'+p.games.slice(0,8).map(function(g){var c=g.color,opp=c?g.white:g.black,res=g.result==='1/2-1/2'?'D':((g.result==='1-0')===(c===0)?'W':'L');return '<div class="li clk" data-act="revserver" data-id="'+g.id+'"><span class="res '+res+'">'+res+'</span><span class="tx"><b>vs '+esc(opp.name)+'</b><small>'+tcParse(g.tc).label+', '+esc(g.reason)+', '+ago(g.ts)+'</small></span></div>';}).join('')+'</div>':''),{wide:true});}

/* ---------- actions ---------- */
function onAct(e){
  var a=e.target.closest('[data-act]');if(!a)return;var act=a.dataset.act,S=cur(),k=a.dataset.k;
  if(a.tagName==='A'&&act!=='ctab')return;
  switch(act){
   case 'stab':setup.tab=k;saveAll();renderPanel();renderBars();break;
   case 'pickbot':setup.bot=+a.dataset.i;saveAll();renderPanel();renderBars();break;
   case 'color':setup.color=a.dataset.c;saveAll();renderPanel();if(SS.play.setup){SS.play.orient=setup.color==='b'?1:0;renderBoard();}break;
   case 'tc':setup.tc=k;saveAll();renderPanel();break;
   case 'btc':setup.btc=k;saveAll();renderPanel();break;
   case 'startbot':ac();startBotGame();break;
   case 'startlocal':ac();startLocalGame();break;
   case 'findgame':ac();netSend({t:'queue',tc:setup.tc});break;
   case 'quick':if(a.classList.contains('qt')){ac();if(NET.queue===k)netSend({t:'cancel'});else{setup.tc=k;saveAll();netSend({t:'queue',tc:k});}}else sendChat(a.dataset.q);break;
   case 'cancelq':netSend({t:'cancel'});break;
   case 'goplay':if(SS.play.active&&!SS.play.over){go('play');break;}SS.play=session('play');SS.play.setup=true;setup.tab=k;saveAll();go('play');break;
   case 'createroom':ac();netSend({t:'create',tc:setup.tc,color:setup.color});break;
   case 'joinroom':{var cd=($('#codeIn').value||'').trim().toUpperCase();if(cd.length<5){toast('Enter the five-character code');break;}ac();netSend({t:'join',code:cd});}break;
   case 'copyroom':copyText(location.origin+location.pathname+'?room='+NET.room,'Invite link');break;
   case 'challengeTo':challengeModal(a.dataset.id,a.dataset.name);break;
   case 'chtc':store.set('chtc',k);$$('.modal .tc').forEach(function(b){b.classList.toggle('on',b.dataset.k===k);});break;
   case 'chcol':$$('#chcol button').forEach(function(b){b.classList.toggle('on',b===a);});break;
   case 'sendch':{var col=($('#chcol .on')||{}).dataset;netSend({t:'challenge',to:a.dataset.id,tc:store.get('chtc','5+0'),color:col?col.c:'r'});closeModal();}break;
   case 'chyes':ac();netSend({t:'challenge_reply',cid:a.dataset.cid,accept:true});delete NET.chIn[a.dataset.cid];closeModal();renderNav();break;
   case 'chno':netSend({t:'challenge_reply',cid:a.dataset.cid,accept:false});delete NET.chIn[a.dataset.cid];closeModal();renderNav();break;
   case 'view':setView(S,+a.dataset.v);break;
   case 'first':setView(S,0);break;
   case 'prev':setView(S,S.view-1);break;
   case 'next':setView(S,S.view+1);break;
   case 'last':setView(S,S.moves.length,false);break;
   case 'flip':S.orient^=1;renderBoard();break;
   case 'hint':hint(S);break;
   case 'takeback':takeback(S);break;
   case 'draw':if(settings.confirm&&!S.armDraw){S.armDraw=true;S.armResign=false;updatePanel();setTimeout(function(){if(S.armDraw){S.armDraw=false;if(cur()===S)updatePanel();}},3000);}else{S.armDraw=false;offerDraw(S);updatePanel();}break;
   case 'resign':if(settings.confirm&&!S.armResign){S.armResign=true;S.armDraw=false;updatePanel();setTimeout(function(){if(S.armResign){S.armResign=false;if(cur()===S)updatePanel();}},3000);}
     else{S.armResign=false;if(S.online){netSend({t:'resign'});updatePanel();break;}var loser=S.local?S.pos.turn:S.userColor;endLocalGame(S,loser===0?'0-1':'1-0','resignation');}break;
   case 'drawyes':S.drawIn=false;netSend({t:'draw_reply',accept:true});updatePanel();break;
   case 'drawno':S.drawIn=false;netSend({t:'draw_reply',accept:false});updatePanel();break;
   case 'gtab':S.tab=k;if(k==='chat')S.unread=0;renderPanel();if(k==='chat'){var ci=$('#chatIn');if(ci&&innerWidth>900)ci.focus();}break;
   case 'chatsend':{var c2=$('#chatIn');sendChat(c2.value);c2.value='';c2.focus();}break;
   case 'report':if(S.online){netSend({t:'report',gid:S.gid,reason:'Chat'});}break;
   case 'closeresult':S.showResult=false;renderOverlay();break;
   case 'review':if(S.rec)startReview(S.rec);break;
   case 'rematch':if(S.online){if(netSend({t:'rematch',gid:S.gid})){S.rematchSent=true;updatePanel();renderOverlay();}break;}
     if(S.local){startLocalGame();break;}setup.color=S.userColor===0?'b':'w';startBotGame();break;
   case 'newgame':{var wasOn=S.online;SS.play=session('play');SS.play.setup=true;if(wasOn)setup.tab='online';SS.play.orient=setup.color==='b'?1:0;go('play');}break;
   case 'revlocal':{var r=profile.games[+a.dataset.id];if(r){var rr=Object.assign({},r);if(!rr.local&&rr.bot){}startReview(rr);}}break;
   case 'revserver':NET.wantReview=a.dataset.id;netSend({t:'game',id:a.dataset.id});if(modalStack.length)closeModal();toast('Loading game');break;
   case 'revpgn':{var R=S.rec,pl=[playerInfo(S,0).name,playerInfo(S,1).name];copyText(pgnOf(S,{white:pl[0],black:pl[1],result:R.result,date:R.date}),'PGN');}break;
   case 'toanalysis':toAnalysis(S);break;
   case 'engtog':S.engineOn=!S.engineOn;S._anaFen=null;if(!S.engineOn){eng.ana.cancel();S.einfo=null;}renderAll();break;
   case 'besttog':S.showBest=!S.showBest;renderBoard();updatePanel();break;
   case 'lines':S.lines=+a.dataset.n;SS.analysis.lines=S.lines;S._anaFen=null;scheduleAnalysis();updateEngineBox();break;
   case 'pvplay':{var inf=S.einfo,l=inf&&inf.lines&&inf.lines[+a.dataset.i];if(l&&l.pv[0]){var pm=viewPos(S).parseUci(l.pv[0]);if(pm)userMove(pm,false);}}break;
   case 'loadfen':{var v=($('#fenIn').value||'').trim();if(!v){toast('Paste a FEN first');break;}try{var tp=new Pos(v);if(tp.attacked(tp.k[tp.turn^1],tp.turn)||!tp.b.some(function(x){return x===6;})||!tp.b.some(function(x){return x===14;}))throw 0;var A2=session('analysis',v);A2.engineOn=S.engineOn;A2.showBest=S.showBest;A2.lines=S.lines;A2.orient=tp.turn;SS.analysis=A2;renderAll();toast('Position loaded');}catch(er){toast('That FEN is not a legal position');}}break;
   case 'copyfen':copyText(S.fens[S.view],'FEN');break;
   case 'loadpgn':{var t=($('#pgnIn').value||'').trim();if(!t){toast('Paste a PGN first');break;}try{var res=parsePgn(t);res.S.engineOn=S.engineOn;res.S.showBest=S.showBest;res.S.lines=S.lines;SS.analysis=res.S;renderAll();toast(res.err?res.err:'Loaded '+res.S.moves.length+' moves');}catch(er){toast('That PGN could not be read');}}break;
   case 'copypgn':copyText(pgnOf(S),'PGN');break;
   case 'reset':{var A3=session('analysis');A3.engineOn=S.engineOn;A3.showBest=S.showBest;A3.lines=S.lines;SS.analysis=A3;renderAll();}break;
   case 'pztheme':pzTheme=k;store.set('pztheme',k);nextPuzzle();break;
   case 'pzhint':puzzleHint(S);break;
   case 'pzsol':showSolution(S);break;
   case 'pzskip':if(S.state==='play'&&!S.failed&&S.moves.length>(S.pz&&S.pz.setup?1:0)){}nextPuzzle();break;
   case 'pznext':nextPuzzle();break;
   case 'pzanalyze':toAnalysis(S);break;
   case 'daily':if(dailyPz){startPuzzle(dailyPz,true);go('puzzles');}break;
   case 'watchgame':if(modalStack.length)closeModal();netSend({t:'watch',gid:a.dataset.gid});break;
   case 'leavewatch':netSend({t:'unwatch'});if(SS.watch)SS.watch.left=true;go('watch');break;
   case 'watchreview':{var W=SS.watch;startReview({id:W.gid,online:true,startFen:START,moves:W.moves.map(function(m){return m.uci;}),times:W.times,result:W.over.result,reason:W.over.reason,userColor:0,tc:W.tc.key,date:Date.now(),players:W.players});}break;
   case 'refreshlive':netSend({t:'live'});break;
   case 'ctab':commTab=k;if(route!=='community'){go('community');e.preventDefault();}else renderPage();if(k==='leaderboard')netSend({t:'leaderboard',cat:NET.lbCat||'blitz'});break;
   case 'lbcat':NET.lbCat=k;netSend({t:'leaderboard',cat:k});renderPage();break;
   case 'player':netSend({t:'player',id:a.dataset.id});break;
   case 'fadd':netSend({t:'friend_add',id:a.dataset.id});if(modalStack.length)closeModal();break;
   case 'facc':netSend({t:'friend_accept',id:a.dataset.id});if(modalStack.length)closeModal();break;
   case 'fdec':netSend({t:'friend_decline',id:a.dataset.id});break;
   case 'frem':netSend({t:'friend_remove',id:a.dataset.id});if(modalStack.length)closeModal();break;
   case 'profcat':profCat=k;store.set('profcat',k);renderPage();break;
   case 'signup':if(modalStack.length)closeModal();authModal('signup');break;
   case 'login':if(modalStack.length)closeModal();authModal('login');break;
   case 'logout':netSend({t:'logout'});break;
   case 'password':passwordModal();break;
   case 'avatar':avatarModal();break;
   case 'avp':setAvatar({p:k,c:myAvatar().c});break;
   case 'avc':setAvatar({p:myAvatar().p,c:+k});break;
   case 'board':settings.board=k;saveAll();applyTheme();renderPage();break;
   case 'pieces':settings.pieces=k;saveAll();applyTheme();renderPage();break;
   case 'set':settings[k]=!settings[k];saveAll();if(k==='coords')board.buildCoords();applyTheme();renderPage();break;
  }}
function onSubmit(form){var f=form.dataset.form;
  if(f==='signup'||f==='login'){var u=$('#authU').value.trim(),p=$('#authP').value;form.querySelector('.err').textContent='';form.querySelector('button[type=submit]').disabled=true;if(!netSend({t:f,username:u,password:p,agree:f==='signup'?!!($('#authAgree')&&$('#authAgree').checked):undefined}))form.querySelector('button[type=submit]').disabled=false;}
  else if(f==='password'){netSend({t:'password',old:$('#pwOld').value,password:$('#pwNew').value});closeModal();}
  else if(f==='addfriend'){var n=$('#friendIn').value.trim();if(n){netSend({t:'friend_add',username:n});$('#friendIn').value='';}}
  else if(f==='search'){var q=$('#searchIn').value.trim();if(q.length>=2)netSend({t:'search',q:q});}}

/* ---------- boot ---------- */
function boot(){
  stageEl=$('#stage');pageEl=$('#page');panel=$('#panel');evalbar=$('#evalbar');
  applyTheme();
  board=new Board($('#board'));
  board.onMove=function(m,dragged){userMove(m,dragged);};
  board.onPremove=function(pm){var S=SS.play;if(S.kind==='play'){S.premove=pm;if(cur()===S)updatePanel();}};
  document.addEventListener('click',function(e){if(e.target.closest('.scrim'))return;onAct(e);});
  document.addEventListener('submit',function(e){if(e.target.closest('.scrim'))return;e.preventDefault();onSubmit(e.target);});
  panel.addEventListener('click',function(e){var g=e.target.closest('#graph');if(!g)return;var S=cur(),r=g.getBoundingClientRect(),v=Math.round((e.clientX-r.left)/r.width*(S.fens.length-1));setView(S,v,false);});
  panel.addEventListener('keydown',function(e){if(e.key!=='Enter')return;if(e.target.id==='chatIn'){sendChat(e.target.value);e.target.value='';}else if(e.target.id==='codeIn'){var b=$('[data-act=joinroom]');if(b)b.click();}else if(e.target.id==='fenIn'){var b2=$('[data-act=loadfen]');if(b2)b2.click();}});
  document.addEventListener('input',function(e){if(e.target.id==='nameIn'){settings.name=e.target.value.slice(0,20)||'You';saveAll();renderNav();}});
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&modalStack.length){var top=modalStack[modalStack.length-1];if(!top.querySelector('[data-cid]'))closeModal();return;}
    if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement&&document.activeElement.tagName)||modalStack.length||!isBoardRoute())return;var S=cur();if(!S)return;
    if(e.key==='ArrowLeft'){setView(S,S.view-1);e.preventDefault();}else if(e.key==='ArrowRight'){setView(S,S.view+1);e.preventDefault();}
    else if(e.key==='Home')setView(S,0);else if(e.key==='End')setView(S,S.moves.length,false);
    else if(e.key==='f'||e.key==='F'){S.orient^=1;renderBoard();}
    else if(e.key==='Enter'&&route==='puzzles'&&S.state==='solved')nextPuzzle();});
  addEventListener('resize',function(){if(isBoardRoute())layout();});
  SS.play.orient=setup.color==='b'?1:0;SS.analysis.showBest=true;
  var h0=location.hash.slice(1);if(NET.pendingJoin){setup.tab='friend';h0='play';}
  route=ROUTES.indexOf(h0)>=0&&h0!=='review'?h0:'home';
  if(route==='watch')SS.watch=null;
  if(route==='puzzles')nextPuzzle(true);
  renderAll();
  netConnect();loadThemes();
  fetchPuzzle(true).then(function(p){dailyPz=p;if(route==='home')renderPage();});
  if(document.fonts)document.fonts.ready.then(function(){if(isBoardRoute())layout();});
  if(ONLINE)setTimeout(function(){eng.ana.sf.init().then(function(){if(route==='analysis')updateEngineBox();},function(){});},2500);
  if(ONLINE&&'serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(function(){});
  setInterval(function(){if(ONLINE&&NET.ok&&(route==='watch'&&!isBoardRoute()||route==='home'))netSend({t:'live'});},8000);}
