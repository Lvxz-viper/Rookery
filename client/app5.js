/* ==========================================================================
   Rookery 3.0: daily chess, messages, achievements, richer profiles,
   shareable games with GIF export, and the opening trainer.
   Hooks into the earlier modules by wrapping their global functions.
   ========================================================================== */

/* ---------- small helpers ---------- */
I.book=ic('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h6M9 11.5h4"/>');
I.mail=ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>');
I.share=ic('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>');
I.film=ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>');
I.medal=ic('<circle cx="12" cy="15" r="5"/><path d="M8.5 3h7L13 10h-2z"/><path d="m12 13 .9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 15.1l2-.3z"/>');
I.edit=ic('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>');
I.back=ic('<path d="M15 5l-7 7 7 7"/>');
I.send=ic('<path d="M4 12 20 4l-5 16-3-7z"/><path d="m12 13 8-9"/>');

function flagOf(cc){if(!cc||!/^[A-Z]{2}$/.test(cc))return '';return String.fromCodePoint(127397+cc.charCodeAt(0),127397+cc.charCodeAt(1));}
var REGION_NAMES=null;
try{REGION_NAMES=new Intl.DisplayNames(['en'],{type:'region'});}catch(e){}
function countryName(cc){if(!cc)return '';try{return REGION_NAMES?REGION_NAMES.of(cc):cc;}catch(e){return cc;}}
var COUNTRY_LIST=null;
function countries(){if(COUNTRY_LIST)return COUNTRY_LIST;var out=[],A=65;
  if(REGION_NAMES){for(var i=0;i<26;i++)for(var j=0;j<26;j++){var cc=String.fromCharCode(A+i,A+j),n;try{n=REGION_NAMES.of(cc);}catch(e){n=null;}
    if(n&&n!==cc&&!/^(Unknown|Pseudo|Outlying|European Union|Eurozone|United Nations|World)/i.test(n)&&!/^(AA|Q[M-Z]|X[A-Z]|ZZ|EZ|UN|EU)$/.test(cc))out.push([cc,n]);}}
  else out=[['EG','Egypt'],['SA','Saudi Arabia'],['AE','United Arab Emirates'],['KW','Kuwait'],['QA','Qatar'],['JO','Jordan'],['MA','Morocco'],['DZ','Algeria'],['TN','Tunisia'],['IQ','Iraq'],['US','United States'],['GB','United Kingdom'],['DE','Germany'],['FR','France'],['IN','India'],['TR','Türkiye']];
  out.sort(function(a,b){return a[1].localeCompare(b[1]);});COUNTRY_LIST=out;return out;}
function roleTag(r){return r==='admin'?'<span class="role">Admin</span>':r==='mod'?'<span class="role mod">Moderator</span>':'';}
function fmtLeft(ms){if(ms<=0)return 'time is up';var d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
  if(d)return d+' day'+(d>1?'s':'')+(h?' '+h+' h':'');if(h)return h+' h '+m+' min';return Math.max(1,m)+' min';}
function fmtLeftShort(ms){if(ms<=0)return '0m';var d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);return d?d+'d '+h+'h':h?h+'h '+m+'m':Math.max(1,m)+'m';}
function achIds(x){if(!x)return [];if(Array.isArray(x))return x;return Object.keys(x).sort(function(a,b){return (x[a]||0)-(x[b]||0);});}
function isAccount(){return ONLINE&&NET.me&&!NET.me.guest;}

/* time-control keys for daily records look like "d3" */
var _tcParse=tcParse;tcParse=function(k){if(k&&/^d\d+$/.test(k)){var n=+k.slice(1);return {key:k,base:0,inc:0,label:n+' day'+(n>1?'s':''),cat:'Daily',daily:n};}return _tcParse(k);};
var _tcCat=tcCat;tcCat=function(k){if(k&&/^d\d+$/.test(k))return 'daily';return _tcCat(k);};
var _reviewRecord=reviewRecord;reviewRecord=function(r){if(r&&/^d\d+$/.test(r.tc||''))r=Object.assign({},r,{times:null});return _reviewRecord(r);};

/* ---------- routes ---------- */
ROUTES.push('daily','inbox','learn');
BOARD_ROUTES.daily=1;BOARD_ROUTES.learn=1;
SS.daily=null;
NET.daily={games:[],invites:[],seeks:[]};NET.dm={list:[],thread:null,openId:null};NET.achList=null;NET.openings={};
var dailySet=Object.assign({days:3,color:'r'},store.get('dailyset',{}));

var _go=go;go=function(r,opt){
  if(r==='daily'&&!SS.daily){setup.tab='daily';r='play';if(!(SS.play.active&&!SS.play.over)&&!SS.play.setup){SS.play=session('play');SS.play.setup=true;}}
  if(r==='learn'&&!SS.learn)SS.learn=learnSession();
  _go(r,opt);
  if(isAccount()&&NET.ok){
    if(route==='inbox'){netSend({t:'dm_list'});if(NET.dm.openId)netSend({t:'dm_open',id:NET.dm.openId});}
    if(route==='profile')netSend({t:'openings'});
    if(route==='play'&&setup.tab==='daily'&&SS.play.setup)netSend({t:'daily_list'});}};

var _renderPage=renderPage;renderPage=function(){
  if(route==='inbox'){var ms=$('#dmMsgs'),keep=ms&&ms.scrollHeight-ms.scrollTop-ms.clientHeight>60?ms.scrollTop:null;setPage(inboxPage());var l=$('#dmMsgs');if(l)l.scrollTop=keep!=null?keep:l.scrollHeight;return;}
  _renderPage();};
var _renderPanel=renderPanel;renderPanel=function(){
  var S=cur();
  if(route==='daily'&&S){panel.innerHTML=dailyPanel(S);updatePanel();return;}
  if(route==='learn'&&S){panel.innerHTML=learnPanel(S);updatePanel();var si=$('#opSearch');if(si&&S.q)si.value=S.q;return;}
  _renderPanel();};
var _updatePanel=updatePanel;updatePanel=function(){_updatePanel();var S=cur(),el;if(!S||!isBoardRoute())return;
  if(route==='daily'){if((el=$('#dstatus')))el.innerHTML=dailyStatus(S);}
  if(route==='learn'&&!S.pick){if((el=$('#lstatus')))el.innerHTML=learnStatus(S);}};
var _isInteractive=isInteractive;isInteractive=function(S){
  if(S.kind==='daily')return !S.over&&!S.pending&&NET.ok&&S.view===S.moves.length&&S.pos.turn===S.userColor;
  if(S.kind==='learn')return !S.pick&&!S.done&&!S.busy&&S.view===S.moves.length&&S.pos.turn===S.side;
  return _isInteractive(S);};
var _userMove=userMove;userMove=function(m,dragged,isPre){var S=cur();
  if(S&&S.kind==='daily'){if(!isInteractive(S))return;var e=doMove(S,m,dragged);S.pending=true;S.drawFrom=-1;netSend({t:'daily_move',gid:S.gid,uci:e.uci});renderBoard();updatePanel();return;}
  if(S&&S.kind==='learn'){learnMove(S,m,dragged);return;}
  _userMove(m,dragged,isPre);};
var _playerInfo=playerInfo;playerInfo=function(S,c){
  if(S.kind==='daily'){var p=S.players[c];return {name:p.name,r:p.rating+(p.prov?'?':''),av:p.avatar,title:p.title,off:S.presence&&!S.presence[c]};}
  if(S.kind==='learn'){if(S.pick||c===S.side)return {name:myName(),r:'',av:myAvatar()};return {name:'Opening book',r:'',av:{p:'b',c:3}};}
  if(S.kind==='play'&&S.setup&&setup.tab==='daily'){var uc=setup.color==='b'?1:0;if(c===uc)return {name:myName(),r:NET.me?NET.me.ratings.daily?NET.me.ratings.daily.r:'':'',av:myAvatar()};return {name:'Opponent',r:'',av:{p:'p',c:6}};}
  return _playerInfo(S,c);};
var _barHTML=barHTML;barHTML=function(S,c,mat){var h=_barHTML(S,c,mat);
  if(S.kind==='daily'&&!S.over&&S.pos.turn===c&&S.deadline){var left=S.deadline-Date.now();h+='<div class="clock on dclk'+(left<6*36e5?' low':'')+'" title="Time left for this move">'+fmtLeftShort(left)+'</div>';}
  return h;};
var _ctrlHTML=ctrlHTML;ctrlHTML=function(S){
  var flip='<span class="sep"></span><button class="ib" data-act="flip" title="Flip board (F)" aria-label="Flip board">'+I.flip+'</button>';
  if(route==='daily'){var h=navCtrl(S)+flip;if(!S.over){
      h+='<button class="ib draw'+(S.armDraw?' armed':'')+'" data-act="ddraw" title="'+(S.armDraw?'Click again to offer a draw':'Offer a draw')+'" aria-label="Offer a draw"'+(S.moves.length<2?' disabled':'')+'>'+I.draw+'</button>';
      h+='<button class="ib'+(S.armResign?' armed':'')+'" data-act="dresign" title="'+(S.armResign?'Click again to confirm':(S.moves.length<2?'Abort':'Resign'))+'" aria-label="Resign">'+I.flag+'</button>';}
    return h;}
  if(route==='learn')return S.pick?'':navCtrl(S)+flip;
  return _ctrlHTML(S);};

/* ---------- navigation ---------- */
var _renderNav=renderNav;renderNav=function(){_renderNav();
  var nav=$('#nav'),tb=$('#tabbar'),me=NET.me||{},dt=me.dailyTurn||0,du=me.dmUnread||0;
  function link(k,label,icon,n){return '<a href="#'+k+'" class="'+(route===k?'on':'')+'"'+(route===k?' aria-current="page"':'')+' title="'+label+'">'+icon+'<span>'+label+'</span>'+(n?'<i class="dot">'+n+'</i>':'')+'</a>';}
  var an=nav.querySelector('a[href="#analysis"]');if(an)an.insertAdjacentHTML('afterend',link('learn','Openings',I.book));
  if(ONLINE){var cm=nav.querySelector('a[href="#community"]');if(cm)cm.insertAdjacentHTML('afterend',link('inbox','Messages',I.mail,du));}
  var pl=nav.querySelector('a[href="#play"]');
  if(pl){if(route==='daily'){pl.classList.add('on');pl.setAttribute('aria-current','page');}if(dt)pl.insertAdjacentHTML('beforeend','<i class="dot">'+dt+'</i>');}
  var tp=tb.querySelector('a[href="#play"]'),ts=tb.querySelector('a[href="#community"]'),tz=tb.querySelector('a[href="#puzzles"]');
  if(tp){if(route==='daily')tp.classList.add('on');if(dt&&!tp.querySelector('.dot'))tp.insertAdjacentHTML('beforeend','<i class="dot"></i>');}
  if(ts){if(route==='inbox')ts.classList.add('on');if(du&&!ts.querySelector('.dot'))ts.insertAdjacentHTML('beforeend','<i class="dot"></i>');}
  if(tz&&route==='learn')tz.classList.add('on');};

/* ---------- network ---------- */
var _netMsg=netMsg;netMsg=function(m){
  switch(m.t){
    case 'daily_list':NET.daily={games:m.games||[],invites:m.invites||[],seeks:m.seeks||[]};
      if(route==='play'&&SS.play.setup&&setup.tab==='daily')renderPanel();else if(route==='home')renderPage();return;
    case 'daily_update':onDailyUpdate(m);return;
    case 'dm_list':NET.dm.list=m.list||[];if(NET.me)NET.me.dmUnread=m.unread||0;renderNav();if(route==='inbox')renderInbox();return;
    case 'dm_thread':NET.dm.thread=m;NET.dm.openId=m.id;if(route==='inbox')renderInbox(true);return;
    case 'dm':onDm(m);return;
    case 'dm_unread':if(NET.me){NET.me.dmUnread=m.n;renderNav();}return;
    case 'achievement':if(NET.me){var ah=NET.me.ach;if(Array.isArray(ah)){if(ah.indexOf(m.id)<0)ah.push(m.id);}else{NET.me.ach=ah||{};NET.me.ach[m.id]=Date.now();}}sfx('win');achToast(m);if(route==='profile')renderPage();return;
    case 'ach_list':NET.achList=m.list;if(route==='profile')renderPage();return;
    case 'openings':NET.openings[m.id]=m.games;if(route==='profile'&&NET.me&&m.id===NET.me.id)renderPage();return;
  }
  _netMsg(m);
  if(m.t==='welcome'){netSend({t:'ach_list'});if(route==='inbox'&&isAccount()){netSend({t:'dm_list'});if(NET.dm.openId)netSend({t:'dm_open',id:NET.dm.openId});}
    if(route==='profile'&&isAccount())netSend({t:'openings'});
    if(SS.daily&&!SS.daily.over)netSend({t:'daily_open',gid:SS.daily.gid});}
  if(m.t==='auth_ok'&&isAccount())netSend({t:'daily_list'});
  if(m.t==='me'&&route==='inbox')renderInbox();
  if(m.t==='player'){}
};
function achToast(m){var box=$('#toasts');var d=document.createElement('div');d.className='toast ach';d.innerHTML='<span class="ai">'+achIcon(m.id)+'</span><span><small>Achievement unlocked</small><b>'+esc(m.name)+'</b><em>'+esc(m.desc)+'</em></span>';box.appendChild(d);
  setTimeout(function(){d.classList.add('out');setTimeout(function(){d.remove();},400);},6000);}

/* ======================================================================
   Daily chess
   ====================================================================== */
function buildDaily(g){var S=session('daily');S.gid=g.gid;S.userColor=g.color<0?0:g.color;S.orient=S.userColor;S.players=[g.white,g.black];
  g.moves.forEach(function(u){var mv=S.pos.parseUci(u);if(mv)doMove(S,mv,true,true);});S._anim=null;applyDaily(S,g);return S;}
function applyDaily(S,g){S.days=g.days;S.deadline=g.deadline;S.created=g.created;S.last=g.last;S.over=g.over;S.drawFrom=g.drawFrom;S.presence=g.online;S.players=[g.white,g.black];S.pending=false;}
function openDaily(g){var S=buildDaily(g);SS.daily=S;sfx('start');if(route!=='daily')go('daily');else renderAll();}
function onDailyUpdate(m){var g=m.game;if(!g)return;
  var L=NET.daily.games,i=L.findIndex(function(x){return x.gid===g.gid;});if(i>=0)L[i]=g;else L.unshift(g);
  var S=SS.daily;
  if(m.open||(m.fresh&&route==='play'&&SS.play.setup&&setup.tab==='daily')){openDaily(g);if(m.fresh)toast('Daily game started. You play '+(g.color?'Black':'White'));return;}
  if(m.fresh){sfx('notify');toast('A new daily game has started against '+(g.color?g.white:g.black).name);}
  if(S&&S.gid===g.gid){
    var same=S.moves.length<=g.moves.length&&S.moves.every(function(x,k){return x.uci===g.moves[k];});
    if(!same){var keepO=S.orient;S=buildDaily(g);S.orient=keepO;SS.daily=S;}
    else{var atEnd=S.view===S.moves.length;for(var k=S.moves.length;k<g.moves.length;k++){var mv=S.pos.parseUci(g.moves[k]);if(mv)doMove(S,mv,false,!atEnd);}if(!atEnd)S.view=Math.min(S.view,S.moves.length);}
    var wasOver=!!S.over;applyDaily(S,g);
    if(g.over&&!wasOver){if(m.ratings&&g.color>=0){var r=m.ratings[g.color];S.rBefore=r[0];S.rAfter=r[1];}
      var sc=dailyScore(S);sfx(sc===1?'win':'end');toast(dailyResultTitle(S)+' by '+g.over.reason);}
    if(cur()===S)renderAll();}
  else if(m.moved&&!g.over){sfx('notify');var opp=g.color?g.white:g.black;toast(opp.name+' moved in your daily game');}
  else if(g.over&&m.ratings){toast('Daily game against '+(g.color?g.white:g.black).name+' finished');}
  if(route==='home')renderPage();else if(route==='play'&&SS.play.setup&&setup.tab==='daily')renderPanel();}
function dailyScore(S){var r=S.over&&S.over.result;if(!r||r==='aborted')return null;if(r==='1/2-1/2')return .5;return ((r==='1-0')===(S.userColor===0))?1:0;}
function dailyResultTitle(S){var r=S.over.result;if(r==='aborted')return 'Game aborted';if(r==='1/2-1/2')return 'Draw';var opp=S.players[S.userColor^1].name;return dailyScore(S)===1?'You won':opp+' won';}
function dailyPanel(S){var opp=S.players[S.userColor^1];
  return '<div class="ph"><h2>vs '+esc(opp.name)+'</h2><span class="meta">Daily, '+S.days+' day'+(S.days>1?'s':'')+' per move</span></div>'+
    '<div class="pbody"><div id="dstatus"></div><div class="opening" id="openName"></div><div class="mvl" id="mvlist"></div>'+
    '<div class="row" style="margin-top:auto"><button class="btn ghost sm" data-act="dlist">'+I.cal+'All daily games</button></div></div><div class="ctrl" id="ctrl"></div>';}
function dailyStatus(S){var opp=S.players[S.userColor^1];
  if(S.over){var sc=dailyScore(S),tone=sc===1?'ok':sc===0?'no':'info',rate='';
    if(S.rAfter!=null){var d=S.rAfter-S.rBefore;rate=' <span class="delta '+(d>0?'up':d<0?'dn':'')+'">'+(d>0?'+':d<0?'−':'±')+Math.abs(d)+'</span>';}
    return '<div class="msg '+tone+'">'+esc(dailyResultTitle(S))+(S.over.result!=='aborted'?' by '+esc(S.over.reason):'')+rate+'</div>'+
      (S.over.result!=='aborted'?'<div class="row" style="margin-top:8px"><button class="btn pri" data-act="dreview">Game review</button><button class="btn" data-act="sharegame" data-id="'+S.gid+'">'+I.share+'Share</button></div>':'');}
  var mine=S.pos.turn===S.userColor,left=S.deadline-Date.now(),h='';
  if(S.drawFrom===(S.userColor^1))h+='<div class="offer"><span>'+esc(opp.name)+' offers a draw</span><button class="btn pri sm" data-act="ddrawyes">Accept</button><button class="btn sm" data-act="ddrawno">Decline</button></div>';
  h+='<div class="msg '+(mine?'ok':'info')+' dstat">'+(S.pending?'Sending your move…':mine?'<b>Your move.</b> '+fmtLeft(left)+' left':'Waiting for '+esc(opp.name)+'. They have '+fmtLeft(left))+'</div>';
  if(S.drawFrom===S.userColor)h+='<p class="fine">You offered a draw.</p>';
  if(!S.moves.length&&mine)h+='<p class="fine">Take your time. You can close the page and come back later.</p>';
  return h;}
setInterval(function(){if(route==='daily'&&SS.daily&&!SS.daily.over){var el=$('#dstatus');if(el)el.innerHTML=dailyStatus(SS.daily);var S=SS.daily,c=$('.dclk');if(c)c.textContent=fmtLeftShort(S.deadline-Date.now());}},30000);

function dailyGameRow(g){var opp=g.color?g.white:g.black,mine=!g.over&&g.turn===g.color,left=g.deadline-Date.now(),sub;
  if(g.over){var r=g.over.result,sc=r==='1/2-1/2'?'Draw':r==='aborted'?'Aborted':((r==='1-0')===(g.color===0)?'Won':'Lost');sub=sc+' by '+g.over.reason;}
  else sub=(mine?'Your move, ':'Their move, ')+fmtLeft(left)+' left';
  return '<div class="li clk" data-act="dopen" data-gid="'+g.gid+'">'+miniBoard(g.fen,g.color===1?1:0,null).replace('class="mini','class="mini dm')+'<span class="tx"><b>'+ttl(opp.title)+esc(opp.name)+' <span class="fine" style="font-weight:400">'+opp.rating+'</span></b><small>'+esc(sub)+', '+g.moves.length+' move'+(g.moves.length===1?'':'s')+'</small></span>'+(mine?'<span class="turn">Your turn</span>':'')+'</div>';}
function dailySetupBody(){
  if(!NET.ok)return {body:'<div class="search"><div class="spin"></div><b>Connecting</b></div>'};
  if(!isAccount())return {body:'<div class="hero">'+avatar({p:'q',c:3},'lg')+'<div><h3>Daily chess</h3><p>Play at your own pace with up to seven days per move. Create a free account to start daily games.</p></div></div>',foot:'<button class="btn pri lg block" data-act="signup">Create account</button>'};
  var D=NET.daily,h='';
  var active=D.games.filter(function(g){return !g.over;}),done=D.games.filter(function(g){return g.over;});
  h+='<div class="h">Your games</div>'+(active.length?'<div class="list">'+active.map(dailyGameRow).join('')+'</div>':'<p class="note">No daily games yet. Post an open game or invite a friend.</p>');
  var inc=D.invites.filter(function(x){return x.incoming;}),out=D.invites.filter(function(x){return !x.incoming;});
  if(inc.length)h+='<div class="h">Invitations</div><div class="list">'+inc.map(function(x){return '<div class="li">'+avatar(x.who.avatar,'sm')+'<span class="tx"><b>'+esc(x.who.name)+'</b><small>'+x.days+' day'+(x.days>1?'s':'')+' per move'+(x.color==='r'?'':', they play '+(x.color==='w'?'White':'Black'))+'</small></span><button class="btn pri sm" data-act="dinvyes" data-id="'+x.id+'">Accept</button><button class="btn ghost sm" data-act="dinvno" data-id="'+x.id+'" aria-label="Decline">'+I.x+'</button></div>';}).join('')+'</div>';
  var seeks=D.seeks.filter(function(x){return !x.mine;}),mine=D.seeks.filter(function(x){return x.mine;});
  if(out.length||mine.length)h+='<div class="h">Waiting for an opponent</div><div class="list">'+out.map(function(x){return '<div class="li">'+avatar(x.who.avatar,'sm')+'<span class="tx"><b>Invited '+esc(x.who.name)+'</b><small>'+x.days+' day'+(x.days>1?'s':'')+' per move</small></span><button class="btn ghost sm" data-act="dinvno" data-id="'+x.id+'">Cancel</button></div>';}).join('')+
    mine.map(function(x){return '<div class="li"><span class="tx"><b>Open game</b><small>'+x.days+' day'+(x.days>1?'s':'')+' per move, '+ago(x.ts)+'</small></span><button class="btn ghost sm" data-act="dseekno" data-id="'+x.id+'">Cancel</button></div>';}).join('')+'</div>';
  h+='<div class="h">Open games from other players</div>'+(seeks.length?'<div class="list">'+seeks.slice(0,8).map(function(x){return '<div class="li">'+avatar(x.by.avatar,'sm')+'<span class="tx"><b>'+ttl(x.by.title)+esc(x.by.name)+' <span class="fine" style="font-weight:400">'+x.by.rating+'</span></b><small>'+x.days+' day'+(x.days>1?'s':'')+' per move</small></span><button class="btn sm" data-act="dseekyes" data-id="'+x.id+'">Play</button></div>';}).join('')+'</div>':'<p class="fine">None right now.</p>');
  h+='<div class="h">New daily game</div><div class="seg">'+[1,3,7].map(function(d){return '<button class="'+(dailySet.days===d?'on':'')+'" data-act="ddays" data-k="'+d+'">'+d+' day'+(d>1?'s':'')+'</button>';}).join('')+'</div>'+
    '<div class="seg">'+[['w','White'],['r','Random'],['b','Black']].map(function(x){return '<button class="'+(dailySet.color===x[0]?'on':'')+'" data-act="dcolor" data-k="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>';
  var fr=(NET.friends.list||[]);
  if(fr.length)h+='<div class="joinrow"><select id="dfriend" aria-label="Friend">'+fr.map(function(f){return '<option value="'+f.id+'">'+esc(f.name)+'</option>';}).join('')+'</select><button class="btn" data-act="dinvite">Invite</button></div>';
  if(done.length)h+='<div class="h">Recently finished</div><div class="list">'+done.slice(0,5).map(dailyGameRow).join('')+'</div>';
  return {body:h,foot:'<button class="btn pri lg block" data-act="dseek">Post open game</button>'};}
var _setupPanel=setupPanel;setupPanel=function(){
  if(!ONLINE)return _setupPanel();
  if(setup.tab!=='daily')return _setupPanel().replace(/(data-k="online">Online<\/button>)/,'$1<button class="" data-act="stab" data-k="daily">Daily</button>');
  var tabs=[['online','Online'],['daily','Daily'],['bot','Computer'],['friend','Friend'],['local','Pass & Play']],d=dailySetupBody();
  return '<div class="ph"><h2>New game</h2></div><div class="tabs">'+tabs.map(function(t){return '<button class="'+(setup.tab===t[0]?'on':'')+'" data-act="stab" data-k="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div><div class="pbody enter">'+d.body+'</div>'+(d.foot?'<div class="pfoot">'+d.foot+'</div>':'');};
function dailyInviteModal(id,name){
  openModal('<h2>Daily game with '+esc(name)+'</h2><p class="note">Each player gets the chosen number of days for every move.</p><div class="form"><div class="h">Time per move</div><div class="seg" id="dimDays">'+[1,3,7].map(function(d){return '<button class="'+(dailySet.days===d?'on':'')+'" data-act="dimpick" data-k="'+d+'">'+d+' day'+(d>1?'s':'')+'</button>';}).join('')+'</div>'+
    '<div class="h">You play</div><div class="seg" id="dimCol">'+[['w','White'],['r','Random'],['b','Black']].map(function(x){return '<button class="'+(dailySet.color===x[0]?'on':'')+'" data-act="dimpick" data-k="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>'+
    '<button class="btn pri lg" data-act="dimsend" data-id="'+id+'">Send invitation</button></div>');}
function dailyBlock(){if(!isAccount())return '';var g=NET.daily.games.filter(function(x){return !x.over;});if(!g.length&&!NET.daily.invites.some(function(x){return x.incoming;}))return '';
  var inv=NET.daily.invites.filter(function(x){return x.incoming;}).length;
  return '<section class="blk"><h2>Daily games<a class="lnk" href="#daily">'+(inv?inv+' invitation'+(inv>1?'s':'')+', ':'')+'All</a></h2><div class="card list">'+(g.length?g.slice(0,4).map(dailyGameRow).join(''):'<p class="note">You have a new invitation.</p>')+'</div></section>';}

/* ======================================================================
   Messages
   ====================================================================== */
function inboxPage(){
  var head='<header class="ptitle"><div><h1>Messages</h1><p>Private conversations with your friends.</p></div></header>';
  if(!ONLINE)return head+'<div class="card"><p class="note">Messages work on your Rookery server.</p></div>';
  if(!isAccount())return head+'<div class="card"><p class="note" style="margin-bottom:12px">Create an account to add friends and message them.</p><div class="row"><button class="btn pri" data-act="signup">Create account</button><button class="btn" data-act="login">Sign in</button></div></div>';
  return head+'<div class="inbox'+(NET.dm.openId?' open':'')+'"><div class="card ibl" id="dmList">'+dmListHTML()+'</div><div class="card ibt" id="dmThread">'+dmThreadHTML()+'</div></div>';}
function dmListHTML(){var L=NET.dm.list,ids={},h='';
  L.forEach(function(c){ids[c.id]=1;});
  h+=L.length?'<div class="list">'+L.map(function(c){var w=c.who;return '<div class="li clk'+(NET.dm.openId===c.id?' me':'')+'" data-act="dmopen" data-id="'+c.id+'">'+avatar(w.avatar,'sm',c.online?'online':'offline')+'<span class="tx"><b>'+ttl(w.title)+esc(w.name)+'</b><small>'+(c.last?(c.last.mine?'You: ':'')+esc(c.last.text.slice(0,60)):'No messages yet')+'</small></span><span class="dmmeta">'+(c.last?'<small>'+agoShort(c.last.ts)+'</small>':'')+(c.unread?'<i class="ub">'+c.unread+'</i>':'')+'</span></div>';}).join('')+'</div>':'';
  var fr=(NET.friends.list||[]).filter(function(f){return !ids[f.id];});
  if(fr.length)h+='<div class="h" style="margin:14px 0 4px">Start a conversation</div><div class="chips">'+fr.map(function(f){return '<button class="chip" data-act="dmopen" data-id="'+f.id+'">'+esc(f.name)+'</button>';}).join('')+'</div>';
  if(!h)h='<p class="note">Add friends from the Community page, then message them here.</p><div class="row" style="margin-top:12px"><a class="btn" href="#community" data-act="ctab" data-k="find">Find players</a></div>';
  return h;}
function agoShort(ts){var s=(Date.now()-ts)/1000;if(s<60)return 'now';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';if(s<86400*7)return Math.floor(s/86400)+'d';return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'});}
function dmThreadHTML(){var T=NET.dm.thread;
  if(!NET.dm.openId)return '<div class="empty" style="padding:60px 10px">'+I.mail.replace('<svg','<svg width="34" height="34" style="opacity:.5;margin-bottom:8px"')+'<br>Pick a conversation</div>';
  if(!T||T.id!==NET.dm.openId)return '<div class="search"><div class="spin"></div></div>';
  var me=NET.me.id,w=T.who,lastDay='';
  var msgs=T.msgs.map(function(x){var d=new Date(x.ts),day=d.toDateString(),sep='';if(day!==lastDay){lastDay=day;sep='<div class="dday">'+d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+'</div>';}
    return sep+'<p class="'+(x.f===me?'mine':'')+'"><span>'+esc(x.t)+'</span><small>'+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})+'</small></p>';}).join('');
  return '<div class="dmh"><button class="ib dmback" data-act="dmback" aria-label="Back">'+I.back+'</button>'+avatar(w.avatar,'sm',T.online?'online':'offline')+'<span class="tx"><b>'+ttl(w.title)+esc(w.name)+'</b><small>'+(T.online?'Online':'Offline')+'</small></span><button class="btn ghost sm" data-act="player" data-id="'+w.id+'">'+I.profile+'Profile</button></div>'+
    '<div class="dmmsgs" id="dmMsgs">'+(msgs||'<div class="empty">Say hello to '+esc(w.name)+'.</div>')+'</div>'+
    (T.friend?'<div class="chatin"><input id="dmIn" maxlength="1000" placeholder="Message '+esc(w.name)+'" autocomplete="off"><button class="btn pri" data-act="dmsend" aria-label="Send">'+I.send+'</button></div>':'<p class="fine" style="padding:12px 4px 0">You can message friends only.</p>');}
function renderInbox(scroll){if(route!=='inbox')return;var L=$('#dmList'),Th=$('#dmThread'),box=$('.inbox');if(!L||!Th){renderPage();return;}
  L.innerHTML=dmListHTML();var inp=$('#dmIn'),val=inp?inp.value:'',foc=inp&&document.activeElement===inp,ms=$('#dmMsgs'),atBottom=!ms||ms.scrollHeight-ms.scrollTop-ms.clientHeight<60;
  Th.innerHTML=dmThreadHTML();if(box)box.classList.toggle('open',!!NET.dm.openId);
  var ni=$('#dmIn');if(ni){ni.value=val;if(foc)ni.focus();}
  var m2=$('#dmMsgs');if(m2&&(scroll||atBottom))m2.scrollTop=m2.scrollHeight;}
function onDm(m){var other=m.with,T=NET.dm.thread;
  if(route==='inbox'&&NET.dm.openId===other&&T&&T.id===other){T.msgs.push(m.msg);if(m.from)netSend({t:'dm_open',id:other});renderInbox(true);}
  else if(m.from){sfx('notify');toast(m.from.name+': '+m.msg.t.slice(0,80),4000);}
  if(route==='inbox')netSend({t:'dm_list'});}
function dmSend(){var i=$('#dmIn');if(!i)return;var t=i.value.trim();if(!t||!NET.dm.openId)return;if(netSend({t:'dm_send',to:NET.dm.openId,text:t})){i.value='';i.focus();}}
document.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target&&e.target.id==='dmIn'){e.preventDefault();dmSend();}});

/* ======================================================================
   Achievements, profile, player card
   ====================================================================== */
function achIcon(id){var i=id.indexOf('pz')===0?I.puzzle:id.indexOf('streak')===0?I.bolt:/^r\d/.test(id)?I.star:id.indexOf('friend')===0?I.friend:id.indexOf('daily')===0?I.cal:id==='giant'?I.trophy:id==='quick_mate'?I.clock:id.indexOf('games')===0?I.board:I.medal;return i;}
function achGrid(have){var L=NET.achList;if(!L)return '<p class="note">Loading…</p>';var hv={};achIds(have).forEach(function(x){hv[x]=1;});
  var sorted=L.slice().sort(function(a,b){return (hv[b[0]]?1:0)-(hv[a[0]]?1:0);});
  return '<div class="achs">'+sorted.map(function(a){var on=hv[a[0]];return '<div class="achv'+(on?' on':'')+'" title="'+esc(a[2])+'"><span class="ai">'+achIcon(a[0])+'</span><span><b>'+esc(a[1])+'</b><small>'+esc(a[2])+'</small></span></div>';}).join('')+'</div>';}
function openingStats(games){if(!games||!games.length)return '<p class="note">Play a few online games and your openings show up here.</p>';
  var agg=[{},{}];
  games.forEach(function(g){var p=new Pos(),ss=[];for(var i=0;i<g[0].length;i++){var mv=p.parseUci(g[0][i]);if(!mv)break;ss.push(p.san(mv));p.make(mv);}
    var o=openingOf(ss),name=o?o.name.split(':')[0]:'Other openings',A=agg[g[1]],e=A[name]||(A[name]={n:0,w:0,d:0,l:0,eco:o?o.eco:''});e.n++;if(g[2]===1)e.w++;else if(g[2]===0)e.l++;else e.d++;});
  function tbl(c){var rows=Object.keys(agg[c]).map(function(k){return [k,agg[c][k]];}).sort(function(a,b){return b[1].n-a[1].n;}).slice(0,6);
    if(!rows.length)return '<p class="fine">No games as '+(c?'Black':'White')+' yet.</p>';
    return rows.map(function(r){var e=r[1],sc=Math.round((e.w+e.d/2)/e.n*100);return '<div class="opr"><span class="tx"><b>'+esc(r[0])+'</b><small>'+e.n+' game'+(e.n>1?'s':'')+', '+e.w+'W '+e.d+'D '+e.l+'L</small></span><span class="wdl" aria-hidden="true"><i class="w" style="flex:'+e.w+'"></i><i class="d" style="flex:'+e.d+'"></i><i class="l" style="flex:'+e.l+'"></i></span><b class="pct">'+sc+'%</b></div>';}).join('');}
  return '<div class="opcols"><div><div class="h" style="margin-bottom:8px">As White</div>'+tbl(0)+'</div><div><div class="h" style="margin-bottom:8px">As Black</div>'+tbl(1)+'</div></div>';}
var _profilePage=profilePage;profilePage=function(){var h=_profilePage(),me=NET.me;
  if(!me)return h;
  var name=esc(myName());
  h=h.replace('<h1>'+name+'</h1>','<h1>'+ttl(me.title)+name+(me.country?' <span class="flag" title="'+esc(countryName(me.country))+'">'+flagOf(me.country)+'</span>':'')+'</h1>'+roleTag(me.role));
  var about='';
  if(!me.guest){var dr=me.ratings.daily;
    about='<div class="about card"><div class="tx">'+(me.bio?'<p class="bio">'+esc(me.bio)+'</p>':'<p class="note">Add a short bio and your country so other players know you.</p>')+
      '<div class="facts">'+(me.country?'<span>'+flagOf(me.country)+' '+esc(countryName(me.country))+'</span>':'')+(dr?'<span>'+I.cal+'Daily '+dr.r+(dr.games<10?'?':'')+'</span>':'')+'<span>'+I.bolt+'Win streak '+(me.streak||0)+', best '+(me.bestStreak||0)+'</span><span>'+I.medal+achIds(me.ach).length+(NET.achList?' of '+NET.achList.length:'')+' achievements</span></div></div>'+
      '<button class="btn" data-act="editprof">'+I.edit+'Edit profile</button></div>';}
  h=h.replace('</header>','</header>'+about);
  var extra='';
  if(!me.guest){extra+='<section class="blk" style="margin-top:28px"><h2>Achievements <span class="fine" style="font:500 13.5px var(--sans)">'+achIds(me.ach).length+(NET.achList?' / '+NET.achList.length:'')+'</span></h2><div class="card">'+achGrid(me.ach)+'</div></section>';
    extra+='<section class="blk" style="margin-top:28px"><h2>Openings</h2><div class="card">'+openingStats(NET.openings[me.id])+'</div></section>';}
  var mark='<section class="blk" style="margin-top:28px"><h2>Games</h2>';
  return h.indexOf(mark)>=0?h.replace(mark,extra+mark):h+extra;};
function editProfileModal(){var me=NET.me;if(!me||me.guest)return;
  openModal('<h2>Edit profile</h2><form class="form" data-form="profile5"><label>Bio<textarea id="pfBio" maxlength="300" placeholder="A line or two about you and your chess">'+esc(me.bio||'')+'</textarea></label>'+
    '<label>Country<select id="pfCountry"><option value="">Not shown</option>'+countries().map(function(c){return '<option value="'+c[0]+'"'+(me.country===c[0]?' selected':'')+'>'+flagOf(c[0])+' '+esc(c[1])+'</option>';}).join('')+'</select></label>'+
    '<div class="err" role="alert"></div><button class="btn pri lg" type="submit">Save</button></form>');}
var _onSubmit=onSubmit;onSubmit=function(form){
  if(form.dataset.form==='profile5'){var bio=$('#pfBio').value.slice(0,300),cc=$('#pfCountry').value;if(netSend({t:'profile',bio:bio,country:cc})){NET.me.bio=bio;NET.me.country=cc;closeModal();toast('Profile saved');renderPage();}return;}
  _onSubmit(form);};
var _showPlayer=showPlayer;showPlayer=function(p){_showPlayer(p);
  var m=modalStack[modalStack.length-1];if(!m)return;var md=m.querySelector('.modal');if(!md)return;
  var h2=md.querySelector('h2');if(h2){if(p.country)h2.insertAdjacentHTML('beforeend',' <span class="flag" title="'+esc(countryName(p.country))+'">'+flagOf(p.country)+'</span>');if(p.role)h2.insertAdjacentHTML('afterend',roleTag(p.role));}
  var row=md.querySelector('.row');
  var add='';if(p.bio)add+='<p class="bio" style="margin-top:14px">'+esc(p.bio)+'</p>';
  var facts=[];if(p.country)facts.push(esc(countryName(p.country)));if(p.ratings.daily&&p.ratings.daily.games)facts.push('Daily '+p.ratings.daily.r);if(p.bestStreak)facts.push('Best win streak '+p.bestStreak);
  if(facts.length)add+='<p class="fine" style="margin-top:6px">'+facts.join(' · ')+'</p>';
  var head=md.querySelector('div');if(head&&add)head.insertAdjacentHTML('afterend',add);
  var pa=achIds(p.ach);if(pa.length&&NET.achList){var names={};NET.achList.forEach(function(a){names[a[0]]=a;});
    var stats=md.querySelector('.stats');if(stats)stats.insertAdjacentHTML('afterend','<div class="achmini">'+pa.slice(-10).map(function(id){var a=names[id];return a?'<span class="ai" title="'+esc(a[1]+': '+a[2])+'">'+achIcon(id)+'</span>':'';}).join('')+'<span class="fine">'+pa.length+' achievement'+(pa.length>1?'s':'')+'</span></div>');}
  var me=NET.me;if(row&&me&&!me.guest&&me.id!==p.id&&p.friend==='yes'){row.insertAdjacentHTML('beforeend','<button class="btn" data-act="dmto" data-id="'+p.id+'">'+I.mail+'Message</button><button class="btn" data-act="dinvto" data-id="'+p.id+'" data-name="'+esc(p.name)+'">'+I.cal+'Daily game</button>');}};
var _friendRow=friendRow;friendRow=function(f){var h=_friendRow(f);if(!isAccount())return h;
  return h.replace('<button class="btn ghost sm" data-act="player"','<button class="btn ghost sm" data-act="dmto" data-id="'+f.id+'" aria-label="Message '+esc(f.name)+'" title="Message">'+I.mail+'</button><button class="btn ghost sm" data-act="player"');};
var _homePage=homePage;homePage=function(){var h=_homePage();
  var trainer='<a class="act" href="#learn"><span class="ic">'+I.book+'</span><span><b>Opening trainer</b><small>Learn the main lines move by move</small></span></a>';
  var daily=ONLINE?'<button class="act" data-act="goplay" data-k="daily"><span class="ic">'+I.cal+'</span><span><b>Daily chess</b><small>Up to seven days per move</small></span></button>':'';
  h=h.replace('<button class="act" data-act="goplay" data-k="local">',daily+trainer+'<button class="act" data-act="goplay" data-k="local">');
  var db=dailyBlock();if(db){var mk='<section class="blk"><h2>More ways to play</h2>';h=h.replace(mk,db+mk);}
  return h;};
var _communityPage=communityPage;communityPage=function(){var h=_communityPage();
  h=h.replace(/(data-k="rapid">Rapid<\/button>)/,'$1<button class="'+(NET.lbCat==='daily'?'on':'')+'" data-act="lbcat" data-k="daily">Daily</button>');
  if(ONLINE)h=h.replace('<div class="ptabs">','<div class="ptabs"><a class="btn sm" href="#inbox" style="order:9;margin-left:auto">'+I.mail+'Messages'+(NET.me&&NET.me.dmUnread?' ('+NET.me.dmUnread+')':'')+'</a>');
  return h;};

/* ======================================================================
   Share link and animated GIF
   ====================================================================== */
function gameLink(id){return location.origin+location.pathname+'?game='+encodeURIComponent(id);}
function shareModal(S){var R=S.rec||{},id=R.online?R.id:null,link=id?gameLink(id):'';
  openModal('<h2>Share this game</h2>'+(id?'<p class="note">Anyone with the link can open the game with a full review.</p><div class="form"><div class="joinrow"><input id="shareIn" readonly value="'+esc(link)+'" aria-label="Game link"><button class="btn" data-act="sharecopy">'+I.copy+'Copy</button></div>'+(navigator.share?'<button class="btn" data-act="sharenative">'+I.share+'Share…</button>':'')+'</div>':'<p class="note">Games against the computer stay on this device, so they have no link. You can still save an animated GIF.</p>')+
    '<div class="form"><div class="h">Animated GIF</div><div id="gifBox"><button class="btn pri" data-act="makegif">'+I.film+'Make GIF</button></div></div>',{wide:false});
  shareModal.S=S;}
function pieceImages(){var out={},keys=[1,2,3,4,5,6,9,10,11,12,13,14];
  return Promise.all(keys.map(function(k){return new Promise(function(res){var u=PIMG[k],m=/url\('(.*)'\)/.exec(u);if(!m){res();return;}var im=new Image();im.onload=function(){out[k]=im;res();};im.onerror=function(){res();};im.src=m[1];});})).then(function(){return out;});}
function makeGif(S,done,prog){
  var sq=40,W=sq*8,strip=30,H=W+strip,th=BOARDS[settings.board]||BOARDS.walnut,orient=S.orient||0;
  var inf=[playerInfo(S,0),playerInfo(S,1)],res=(S.rec&&S.rec.result)||(S.over&&S.over.result)||'*';
  pieceImages().then(function(imgs){
    var cv=document.createElement('canvas');cv.width=W;cv.height=H;var x=cv.getContext('2d',{willReadFrequently:true});
    var N=Math.min(S.fens.length,301),frames=[];
    function draw(i){var P=new Pos(S.fens[i]),mv=i>0?S.moves[i-1]:null;
      x.fillStyle='#131a16';x.fillRect(0,0,W,H);
      for(var r=0;r<8;r++)for(var f=0;f<8;f++){var s=orient?63-(r*8+f):r*8+f;var light=((r+f)&1)===0;x.fillStyle=light?th.l:th.d;x.fillRect(f*sq,r*sq,sq,sq);
        if(mv&&(s===mv.from||s===mv.to)){x.fillStyle='rgba(214,181,96,.48)';x.fillRect(f*sq,r*sq,sq,sq);}
        var p=P.b[s];if(p&&imgs[p])x.drawImage(imgs[p],f*sq+1,r*sq+1,sq-2,sq-2);}
      x.fillStyle='#ece6d6';x.font='600 13px Onest, system-ui, sans-serif';x.textBaseline='middle';
      x.textAlign='left';x.fillText((inf[0].name||'White')+' vs '+(inf[1].name||'Black'),8,W+strip/2);
      x.textAlign='right';x.fillStyle='#c9a45c';x.fillText(i===N-1&&res!=='*'?res:(i?Math.ceil(i/2)+'. '+(i%2?'':'… ')+mv.san:'Rookery'),W-8,W+strip/2);
      return x.getImageData(0,0,W,H).data;}
    var hist=new Uint32Array(32768),sums=new Float64Array(32768*3),i=0;
    (function step(){var t0=performance.now();
      while(i<N&&performance.now()-t0<30){var d=draw(i);frames.push(d);for(var k=0;k<d.length;k+=4){var key=((d[k]>>3)<<10)|((d[k+1]>>3)<<5)|(d[k+2]>>3);hist[key]++;sums[key*3]+=d[k];sums[key*3+1]+=d[k+1];sums[key*3+2]+=d[k+2];}i++;}
      if(prog)prog(i/N*.5);
      if(i<N){setTimeout(step,0);return;}
      var keys=[];for(var q=0;q<32768;q++)if(hist[q])keys.push(q);keys.sort(function(a,b){return hist[b]-hist[a];});keys=keys.slice(0,256);
      var pal=keys.map(function(q){var n=hist[q];return [Math.round(sums[q*3]/n),Math.round(sums[q*3+1]/n),Math.round(sums[q*3+2]/n)];});while(pal.length<256)pal.push([0,0,0]);
      var map=new Int16Array(32768).fill(-1);
      function near(key){var r=(key>>10)<<3|4,g=((key>>5)&31)<<3|4,b=(key&31)<<3|4,best=0,bd=1e9;for(var j=0;j<pal.length;j++){var p=pal[j],dd=(p[0]-r)*(p[0]-r)*2+(p[1]-g)*(p[1]-g)*4+(p[2]-b)*(p[2]-b)*3;if(dd<bd){bd=dd;best=j;}}return best;}
      var gif=new GifWriter(W,H,pal),fi=0;
      (function enc(){var t1=performance.now();
        while(fi<frames.length&&performance.now()-t1<40){var d=frames[fi],idx=new Uint8Array(W*H);for(var k=0,p=0;k<d.length;k+=4,p++){var key=((d[k]>>3)<<10)|((d[k+1]>>3)<<5)|(d[k+2]>>3),v=map[key];if(v<0)v=map[key]=near(key);idx[p]=v;}
          gif.frame(idx,fi===0?120:fi===frames.length-1?400:80);frames[fi]=null;fi++;}
        if(prog)prog(.5+fi/frames.length*.5);
        if(fi<frames.length){setTimeout(enc,0);return;}
        done(new Blob([gif.end()],{type:'image/gif'}));})();})();});}
function GifWriter(w,h,pal){var buf=new Uint8Array(1<<20),n=0;
  function grow(k){if(n+k<=buf.length)return;var nb=new Uint8Array(Math.max(buf.length*2,n+k+1024));nb.set(buf.subarray(0,n));buf=nb;}
  function b(x){grow(1);buf[n++]=x&255;}function w16(x){b(x);b(x>>8);}function s(t){for(var i=0;i<t.length;i++)b(t.charCodeAt(i));}
  s('GIF89a');w16(w);w16(h);b(0xF7);b(0);b(0);pal.forEach(function(c){b(c[0]);b(c[1]);b(c[2]);});
  b(0x21);b(0xFF);b(11);s('NETSCAPE2.0');b(3);b(1);w16(0);b(0);
  this.frame=function(px,delay){b(0x21);b(0xF9);b(4);b(0);w16(delay);b(0);b(0);b(0x2C);w16(0);w16(0);w16(w);w16(h);b(0);
    var minCode=8,clear=256,eoi=257,next=258,size=9,dict=new Map(),cur=0,nb=0,block=new Uint8Array(255),bl=0;
    b(minCode);
    function flush(){b(bl);grow(bl);buf.set(block.subarray(0,bl),n);n+=bl;bl=0;}
    function emit(code){cur|=code<<nb;nb+=size;while(nb>=8){block[bl++]=cur&255;cur>>>=8;nb-=8;if(bl===255)flush();}}
    emit(clear);var prefix=px[0];
    for(var i=1;i<px.length;i++){var k=px[i],key=(prefix<<8)|k,c=dict.get(key);
      if(c!==undefined){prefix=c;continue;}
      emit(prefix);
      if(next===4096){emit(clear);dict.clear();next=258;size=9;}
      else{if(next>=(1<<size))size++;dict.set(key,next++);}
      prefix=k;}
    emit(prefix);emit(eoi);if(nb>0){block[bl++]=cur&255;cur=0;nb=0;if(bl===255)flush();}
    if(bl)flush();b(0);};
  this.end=function(){b(0x3B);return buf.slice(0,n);};}
var _reviewPanel=reviewPanel;reviewPanel=function(S){var h=_reviewPanel(S);
  return h.replace('data-act="revpgn">'+I.copy+'Copy PGN</button>','data-act="revpgn">'+I.copy+'Copy PGN</button><button class="btn ghost sm" data-act="share5">'+I.share+'Share</button><button class="btn ghost sm" data-act="gif5">'+I.film+'GIF</button>').replace('<button class="btn ghost sm" style="align-self:flex-start" data-act="revpgn">','<div class="row"><button class="btn ghost sm" data-act="revpgn">').replace(I.film+'GIF</button></div><div class="ctrl"',I.film+'GIF</button></div></div><div class="ctrl"');};
var _overBox=overBox;overBox=function(S){var h=_overBox(S);if(S.online&&!S.aborted)h=h.replace('<button class="btn" data-act="newgame">','<button class="btn" data-act="sharegame" data-id="'+S.gid+'">'+I.share+'Share</button><button class="btn" data-act="newgame">');return h;};

/* ======================================================================
   Opening trainer
   ====================================================================== */
var LEARN_OPEN=OPEN.filter(function(o){return o.san.length>=3;});
var optrain=store.get('optrain',{});
function learnSession(){var S=session('learn');S.pick=true;S.side=store.get('opside',0);S.orient=S.side;S.q='';return S;}
function opKey(o,side){return o.eco+'|'+o.name+'|'+side;}
function opStars(o,side){var r=optrain[opKey(o,side)];return r?Math.min(3,r.clean||0):0;}
function startLine(o,side){var old=SS.learn,S=session('learn');S.op=o;S.side=side;S.orient=side;S.ply=0;S.miss=0;S.tries=0;S.pick=false;S.q=old?old.q:'';S.note=null;
  SS.learn=S;if(route!=='learn')go('learn');else renderAll();
  if(side===1){S.busy=true;setTimeout(function(){learnBot(S);},550);}}
function learnBot(S){S.busy=false;if(SS.learn!==S||S.pick||S.done)return;if(S.pos.turn===S.side||S.ply>=S.op.uci.length){learnDone(S);return;}
  var m=S.pos.parseUci(S.op.uci[S.ply]);if(!m)return;doMove(S,m,false);S.ply++;S.tries=0;
  if(S.ply>=S.op.uci.length)learnDone(S);
  if(cur()===S){renderBoard();updatePanel();}}
function learnMove(S,m,dragged){if(!isInteractive(S))return;var u=S.pos.uci(m),want=S.op.uci[S.ply];
  if(u===want){S.hint=null;doMove(S,m,dragged);S.ply++;S.note={ok:true,t:S.moves[S.moves.length-1].san+' is the book move.'};S.tries=0;
    if(S.ply>=S.op.uci.length)learnDone(S);else{S.busy=true;setTimeout(function(){learnBot(S);},450);}
    renderBoard();updatePanel();return;}
  S.miss++;S.tries++;sfx('no');
  var wm=S.pos.parseUci(want);
  if(S.tries>=2&&wm)S.hint=[wm&63,(wm>>6)&63];
  S.note={ok:false,t:S.tries>=2?'Follow the arrow to play the book move.':'That is not the main line here. Try again.'};
  renderBoard();updatePanel();}
function learnDone(S){if(S.done)return;S.done=true;var k=opKey(S.op,S.side),r=optrain[k]||(optrain[k]={n:0,clean:0});r.n++;if(!S.miss)r.clean++;r.ts=Date.now();store.set('optrain',optrain);sfx(S.miss?'ok':'win');}
function learnStatus(S){var o=S.op,total=o.uci.filter(function(_,i){return (i%2)===S.side;}).length,doneN=S.moves.filter(function(m){return m.color===S.side;}).length;
  if(S.done)return '<div class="msg ok">'+(S.miss?'Line complete with '+S.miss+' mistake'+(S.miss>1?'s':'')+'.':'Perfect. Line complete without a mistake.')+'</div>'+
    '<p class="fine">Mastery: '+starsHTML(opStars(o,S.side))+' Three clean runs master a line.</p>'+
    '<div class="row"><button class="btn pri" data-act="opagain">Again</button><button class="btn" data-act="oprandom">Next line</button><button class="btn ghost" data-act="oplist">All openings</button></div>';
  var h='<div class="prog"><i style="width:'+(doneN/Math.max(1,total)*100)+'%"></i></div><p class="fine">Your move '+Math.min(doneN+1,total)+' of '+total+'</p>';
  if(S.note)h+='<div class="msg '+(S.note.ok?'ok':'no')+'">'+esc(S.note.t)+'</div>';
  else h+='<div class="msg info">'+(S.pos.turn===S.side?'Your move. Play the main line.':'The book replies…')+'</div>';
  return h;}
function starsHTML(n){var s='';for(var i=0;i<3;i++)s+='<i class="'+(i<n?'on':'')+'">★</i>';return '<span class="stars">'+s+'</span>';}
function learnList(S){var q=(S.q||'').trim().toLowerCase(),side=S.side,fam={},order=[];
  LEARN_OPEN.forEach(function(o){if(q&&(o.name+' '+o.eco+' '+o.san.join(' ')).toLowerCase().indexOf(q)<0)return;var f=o.name.split(':')[0];if(!fam[f]){fam[f]=[];order.push(f);}fam[f].push(o);});
  if(!order.length)return '<p class="note">No opening matches “'+esc(S.q)+'”.</p>';
  return order.map(function(f){return '<div class="opfam"><div class="h">'+esc(f)+'</div><div class="list">'+fam[f].map(function(o){var i=OPEN.indexOf(o),st=opStars(o,side);
    return '<div class="li clk" data-act="opstart" data-i="'+i+'"><span class="eco">'+o.eco+'</span><span class="tx"><b>'+esc(o.name.indexOf(':')>0?o.name.split(':').slice(1).join(':').trim():o.name)+'</b><small>'+esc(o.san.slice(0,6).join(' '))+(o.san.length>6?' …':'')+'</small></span>'+starsHTML(st)+'</div>';}).join('')+'</div></div>';}).join('');}
function learnPanel(S){
  if(S.pick){var mastered=LEARN_OPEN.filter(function(o){return opStars(o,S.side)>=3;}).length;
    return '<div class="ph"><h2>Opening trainer</h2><span class="meta">'+mastered+' of '+LEARN_OPEN.length+' mastered</span></div><div class="pbody">'+
      '<p class="note">Pick a line and play your side from memory. The book answers for the other side.</p><div class="seg">'+[[0,'Train as White',PIMG[6]],[1,'Train as Black',PIMG[14]]].map(function(x){return '<button class="'+(S.side===x[0]?'on':'')+'" data-act="opside" data-k="'+x[0]+'"><i style="background-image:'+x[2]+'"></i>'+x[1]+'</button>';}).join('')+'</div>'+
      '<input id="opSearch" placeholder="Search openings, ECO codes or moves" autocomplete="off" spellcheck="false" aria-label="Search openings">'+
      '<div id="opList">'+learnList(S)+'</div></div><div class="pfoot"><button class="btn pri lg block" data-act="oprandom">'+I.bolt+'Random line</button></div>';}
  return '<div class="ph"><h2>'+esc(S.op.name)+'</h2><span class="meta">'+S.op.eco+', as '+(S.side?'Black':'White')+'</span></div><div class="pbody"><div id="lstatus"></div><div class="mvl" id="mvlist"></div>'+
    (S.done?'':'<div class="row" style="margin-top:auto"><button class="btn ghost sm" data-act="ophint">'+I.hint+'Hint</button><button class="btn ghost sm" data-act="opagain">Restart</button><button class="btn ghost sm" data-act="oplist">All openings</button></div>')+'</div><div class="ctrl" id="ctrl"></div>';}
document.addEventListener('input',function(e){if(e.target.id==='opSearch'&&SS.learn){SS.learn.q=e.target.value;var l=$('#opList');if(l)l.innerHTML=learnList(SS.learn);}});
function pickRandomLine(side){var pool=LEARN_OPEN.filter(function(o){return opStars(o,side)<3;});if(!pool.length)pool=LEARN_OPEN;var q=SS.learn&&SS.learn.q?SS.learn.q.toLowerCase():'';
  if(q){var f=pool.filter(function(o){return (o.name+' '+o.eco).toLowerCase().indexOf(q)>=0;});if(f.length)pool=f;}
  return pool[Math.floor(Math.random()*pool.length)];}

/* ======================================================================
   Actions
   ====================================================================== */
var _onAct=onAct;onAct=function(e){
  var a=e.target.closest('[data-act]');if(!a){_onAct(e);return;}var act=a.dataset.act,S=cur(),k=a.dataset.k;
  switch(act){
    case 'stab':if(k==='daily'&&isAccount())netSend({t:'daily_list'});break;
    /* daily */
    case 'dopen':netSend({t:'daily_open',gid:a.dataset.gid});return;
    case 'dlist':setup.tab='daily';SS.play.setup=SS.play.setup||!(SS.play.active&&!SS.play.over);if(SS.play.setup){go('play');netSend({t:'daily_list'});}else go('play');return;
    case 'ddays':dailySet.days=+k;store.set('dailyset',dailySet);renderPanel();return;
    case 'dcolor':dailySet.color=k;store.set('dailyset',dailySet);renderPanel();return;
    case 'dseek':ac();netSend({t:'daily_seek',days:dailySet.days,color:dailySet.color});toast('Open game posted. You will be notified when someone joins.');return;
    case 'dseekno':netSend({t:'daily_seek_cancel',id:a.dataset.id});return;
    case 'dseekyes':ac();netSend({t:'daily_seek_accept',id:a.dataset.id});return;
    case 'dinvyes':ac();netSend({t:'daily_invite_reply',id:a.dataset.id,accept:true});return;
    case 'dinvno':netSend({t:'daily_invite_reply',id:a.dataset.id,accept:false});return;
    case 'dinvite':{var sel=$('#dfriend');if(sel&&sel.value)netSend({t:'daily_invite',to:sel.value,days:dailySet.days,color:dailySet.color});}return;
    case 'dinvto':if(modalStack.length)closeModal();dailyInviteModal(a.dataset.id,a.dataset.name);return;
    case 'dimpick':{var box=a.parentNode;$$('button',box).forEach(function(b){b.classList.toggle('on',b===a);});if(box.id==='dimDays')dailySet.days=+k;else dailySet.color=k;store.set('dailyset',dailySet);}return;
    case 'dimsend':netSend({t:'daily_invite',to:a.dataset.id,days:dailySet.days,color:dailySet.color});closeModal();return;
    case 'ddraw':if(!S||S.kind!=='daily')return;if(S.drawFrom===(S.userColor^1)){netSend({t:'daily_draw',gid:S.gid});return;}
      if(settings.confirm&&!S.armDraw){S.armDraw=true;S.armResign=false;updatePanel();setTimeout(function(){if(S.armDraw){S.armDraw=false;if(cur()===S)updatePanel();}},3000);return;}
      S.armDraw=false;netSend({t:'daily_draw',gid:S.gid});toast('Draw offered');updatePanel();return;
    case 'ddrawyes':netSend({t:'daily_draw',gid:S.gid});return;
    case 'ddrawno':netSend({t:'daily_draw_decline',gid:S.gid});S.drawFrom=-1;updatePanel();return;
    case 'dresign':if(!S||S.kind!=='daily')return;if(settings.confirm&&!S.armResign){S.armResign=true;S.armDraw=false;updatePanel();setTimeout(function(){if(S.armResign){S.armResign=false;if(cur()===S)updatePanel();}},3000);return;}
      S.armResign=false;netSend({t:'daily_resign',gid:S.gid});return;
    case 'dreview':if(S&&S.kind==='daily'){startReview({id:S.gid,online:true,startFen:START,moves:S.moves.map(function(m){return m.uci;}),result:S.over.result,reason:S.over.reason,userColor:S.userColor,tc:'none',date:S.over.ts||Date.now(),
        players:S.players.map(function(p){return {name:p.name,avatar:p.avatar,rating:p.rating};})});}return;
    /* messages */
    case 'dmto':if(modalStack.length)closeModal();NET.dm.openId=a.dataset.id;NET.dm.thread=null;if(route==='inbox'){renderInbox();netSend({t:'dm_open',id:a.dataset.id});}else go('inbox');return;
    case 'dmopen':NET.dm.openId=a.dataset.id;if(!NET.dm.thread||NET.dm.thread.id!==a.dataset.id)NET.dm.thread=null;renderInbox();netSend({t:'dm_open',id:a.dataset.id});return;
    case 'dmback':NET.dm.openId=null;NET.dm.thread=null;renderInbox();netSend({t:'dm_list'});return;
    case 'dmsend':dmSend();return;
    /* profile */
    case 'editprof':editProfileModal();return;
    /* share */
    case 'share5':if(S&&S.rec)shareModal(S);return;
    case 'gif5':if(S&&S.rec){shareModal(S);var g=$('[data-act=makegif]');if(g)g.click();}return;
    case 'sharegame':{var P=SS.play,rec=(S&&S.kind==='daily')?{online:true,id:a.dataset.id,result:S.over&&S.over.result}:(P.rec||{online:true,id:a.dataset.id});var T=S&&S.rec?S:{rec:rec,fens:S.fens,moves:S.moves,orient:S.orient,over:S.over,kind:S.kind,players:S.players,userColor:S.userColor,pos:S.pos,setup:false,online:true,opp:S.opp,local:S.local,bot:S.bot};if(!T.rec)T.rec=rec;shareModal(T);}return;
    case 'sharecopy':copyText($('#shareIn').value,'Link');return;
    case 'sharenative':try{navigator.share({title:'Chess game on Rookery',url:$('#shareIn').value}).catch(function(){});}catch(er){}return;
    case 'makegif':{var GS=shareModal.S,box=$('#gifBox');if(!GS||!box)return;box.innerHTML='<div class="prog"><i id="gifProg" style="width:0"></i></div><p class="fine">Rendering '+GS.fens.length+' frames…</p>';
      makeGif(GS,function(blob){var url=URL.createObjectURL(blob),bx=$('#gifBox');if(!bx)return;bx.innerHTML='<img class="gifprev" src="'+url+'" alt="Animated replay of the game"><div class="row"><a class="btn pri" href="'+url+'" download="rookery-game.gif">Download GIF</a><span class="fine" style="align-self:center">'+(blob.size/1024/1024).toFixed(1)+' MB</span></div>';},
        function(p){var pr=$('#gifProg');if(pr)pr.style.width=(p*100).toFixed(0)+'%';});}return;
    /* trainer */
    case 'opside':S.side=+k;S.orient=S.side;store.set('opside',S.side);renderPanel();renderBoard();return;
    case 'opstart':{var o=OPEN[+a.dataset.i];if(o)startLine(o,SS.learn?SS.learn.side:0);}return;
    case 'oprandom':{var sd=SS.learn?SS.learn.side:0;startLine(pickRandomLine(sd),sd);}return;
    case 'opagain':if(S&&S.op)startLine(S.op,S.side);return;
    case 'oplist':{var L=learnSession();L.side=S.side;L.orient=S.side;L.q=S.q||'';SS.learn=L;renderAll();}return;
    case 'ophint':if(S&&S.op&&!S.done&&S.pos.turn===S.side){var wm=S.pos.parseUci(S.op.uci[S.ply]);if(wm){S.hint=[wm&63,(wm>>6)&63];S.miss++;S.note={ok:false,t:'Hint shown. This run counts as a mistake.'};renderBoard();updatePanel();}}return;
  }
  _onAct(e);};

/* ---------- start ---------- */
(function(){var h=location.hash.slice(1);if(h==='daily'){setup.tab='daily';try{history.replaceState(null,'',location.pathname+location.search+'#play');}catch(e){}}
  SS.learn=learnSession();})();
if(ONLINE)setInterval(function(){if(NET.ok&&isAccount()&&(route==='home'||(route==='play'&&SS.play.setup&&setup.tab==='daily')))netSend({t:'daily_list'});},60000);
