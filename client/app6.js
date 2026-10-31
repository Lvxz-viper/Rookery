/* ==========================================================================
   Rookery 3.1: legal pages, consent, privacy controls, blocking and
   reporting, contact form, and commercial-safe piece sets.
   ========================================================================== */
var LEGAL_UPDATED='31 October 2026';
var NC_SETS=['staunty','gioco','tatiana','maestro','cardinal'];
var ALL_SET_NAMES=Object.assign({},SET_NAMES);
I.shield=ic('<path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6z"/><path d="m9 12 2 2 4-4"/>');
I.ban=ic('<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>');
I.download=ic('<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M5 19h14"/>');
I.trash=ic('<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>');

/* ---------- commercial mode: only sets whose license allows commercial use ---------- */
function applyCommercial(){var on=!!(NET.cfg&&NET.cfg.commercial);
  Object.keys(SET_NAMES).forEach(function(k){delete SET_NAMES[k];});
  Object.keys(ALL_SET_NAMES).forEach(function(k){if(!on||NC_SETS.indexOf(k)<0)SET_NAMES[k]=ALL_SET_NAMES[k];});
  if(on&&NC_SETS.indexOf(settings.pieces)>=0){settings.pieces='papercut';saveAll();}}
var _applyTheme=applyTheme;applyTheme=function(){if(NET.cfg&&NET.cfg.commercial&&NC_SETS.indexOf(settings.pieces)>=0)applyCommercial();_applyTheme();};

/* ---------- routes ---------- */
var LEGAL_ROUTES=['terms','privacy','rules','licenses','contact'];
LEGAL_ROUTES.forEach(function(r){ROUTES.push(r);});
var LEGAL_TITLES={terms:'Terms of Service',privacy:'Privacy Policy',rules:'Community Rules',licenses:'Licenses and Credits',contact:'Contact'};
var _renderPage6=renderPage;renderPage=function(){
  if(LEGAL_ROUTES.indexOf(route)>=0){setPage(legalPage(route));return;}
  _renderPage6();};
var _setPage6=setPage;setPage=function(h){_setPage6(h+footerHTML());};
function footerHTML(){return '<footer class="sitefoot"><nav>'+LEGAL_ROUTES.map(function(r){return '<a href="#'+r+'">'+(r==='licenses'?'Licenses':r==='rules'?'Community rules':LEGAL_TITLES[r].replace(' of Service','').replace(' Policy',''))+'</a>';}).join('')+'</nav><small>© '+new Date().getFullYear()+' Rookery</small></footer>';}
function contactLine(){var e=NET.cfg&&NET.cfg.contact;return e?'by email at <a href="mailto:'+esc(e)+'">'+esc(e)+'</a> or through the <a href="#contact">contact form</a>':'through the <a href="#contact">contact form</a>';}
function legalNav(cur){return '<nav class="legalnav">'+LEGAL_ROUTES.map(function(r){return '<a href="#'+r+'" class="'+(r===cur?'on':'')+'">'+LEGAL_TITLES[r]+'</a>';}).join('')+'</nav>';}
function legalPage(r){
  var body=r==='terms'?termsHTML():r==='privacy'?privacyHTML():r==='rules'?rulesHTML():r==='licenses'?licensesHTML():contactHTML();
  return '<header class="ptitle"><div><h1>'+LEGAL_TITLES[r]+'</h1><p>'+(r==='contact'?'Questions, privacy requests and copyright notices.':'Last updated '+LEGAL_UPDATED+'.')+'</p></div></header><div class="legal">'+legalNav(r)+'<article class="doc card">'+body+'</article></div>';}

function termsHTML(){return ''+
 '<p>These terms apply to everyone who uses Rookery, with or without an account. By using Rookery you agree to them and to the <a href="#privacy">Privacy Policy</a>. If you do not agree, please do not use the site.</p>'+
 '<h2>1. Who can use Rookery</h2><p>You must be at least 13 years old. If you are under the age of adulthood where you live, you confirm that a parent or guardian has agreed to these terms for you. You may not use Rookery if you have been suspended from it.</p>'+
 '<h2>2. Your account</h2><ul><li>Keep your password private. You are responsible for what happens on your account.</li><li>One account per person. Do not create accounts to get around a suspension or to change ratings.</li><li>Choose a username that does not impersonate others, including Rookery staff, and is not offensive.</li><li>You can delete your account at any time in <a href="#prefs">Settings</a>.</li></ul>'+
 '<h2>3. Fair play</h2><p>In games against other people you must play on your own. Using a chess engine, another person, opening books during play, or any other outside help is not allowed. Deliberately losing, sandbagging, or arranging results is not allowed. Analysis, the opening trainer and the engine are for your own study outside live games. Rated games are checked automatically with a chess engine; results are reviewed by a person before any action is taken.</p><p>Rated games need two players with accounts on different networks. Games between players on the same network, and more than five a day between the same two players, are casual.</p>'+
 '<h2>4. Behaviour</h2><p>Follow the <a href="#rules">Community Rules</a>. Do not harass, threaten or insult others, post hateful or sexual content, spam, share other people\'s personal information, or try to break, overload or gain unauthorised access to the service.</p>'+
 '<h2>5. Your content</h2><p>You keep ownership of what you write, such as your bio and messages. You allow Rookery to store, show and process it to run the service. Games are public: moves, results, usernames and ratings may be shown to anyone, shared by link and kept in the game history. Do not post anything you do not have the right to share.</p>'+
 '<h2>6. Moderation</h2><p>We may remove content, turn off chat, end games, adjust ratings or results, and suspend or delete accounts that break these terms or the rules, with or without notice. Automated filters may hide words in chat. If you think a decision was wrong, write to us '+contactLine()+'.</p>'+
 '<h2>7. The service</h2><p>Rookery is provided as is and as available. We do our best to keep it running and your data safe, but we do not promise that it will always be available, error free, or that data will never be lost. We may change, pause or stop any part of the service.</p>'+
 '<h2>8. Liability</h2><p>To the extent the law allows, Rookery and the people who run it are not liable for indirect or consequential losses, lost data, or anything other users say or do. Nothing in these terms limits rights you have under laws that cannot be excluded.</p>'+
 '<h2>9. Other people\'s rights</h2><p>Rookery uses open source software and artwork under their licenses, listed on the <a href="#licenses">Licenses page</a>. If you believe something on Rookery infringes your rights, see the <a href="#contact">Contact page</a>.</p>'+
 '<h2>10. Changes</h2><p>We may update these terms. When the change is important we will show a notice on the site. Using Rookery after a change means you accept the new terms.</p>'+
 '<h2>11. Contact</h2><p>Questions about these terms can be sent '+contactLine()+'.</p>';}

function privacyHTML(){return ''+
 '<p>This policy explains what Rookery collects, why, how long it is kept and the choices you have. We collect as little as possible, we do not sell your data, we do not show ads and we do not use third party trackers or analytics.</p>'+
 '<h2>What we collect</h2><table class="ptab"><thead><tr><th>Data</th><th>Why</th><th>How long</th></tr></thead><tbody>'+
 '<tr><td>Username and password</td><td>To sign you in. Passwords are stored only as a salted, one-way hash; nobody can read them.</td><td>Until you delete your account</td></tr>'+
 '<tr><td>Games, ratings, puzzles, achievements</td><td>To run games, ratings, profiles, reviews and leaderboards. Games are public. Rated games are also checked automatically with a chess engine to detect cheating.</td><td>Until you delete your account; finished games stay in the history with your name replaced by “Deleted player”</td></tr>'+
 '<tr><td>Bio, country, avatar</td><td>Optional. Shown on your public profile.</td><td>Until you change them or delete your account</td></tr>'+
 '<tr><td>Game chat</td><td>Delivered to your opponent and kept with reports so staff can review abuse.</td><td>Not saved with the game; recent lines are kept in memory until the server restarts</td></tr>'+
 '<tr><td>Private messages</td><td>Delivered to the friend you write to and stored encrypted. Staff only see them if one of you reports the conversation.</td><td>1 year, then deleted automatically</td></tr>'+
 '<tr><td>Network address (IP) and device type</td><td>Security, preventing abuse and spam, and enforcing suspensions.</td><td>Deleted after 90 days without a visit</td></tr>'+
 '<tr><td>Reports and contact messages</td><td>To handle your request or report.</td><td>Up to 180 days after they are handled</td></tr>'+
 '<tr><td>Browser storage</td><td>Your settings, offline progress and sign-in token are kept in your own browser. We use no tracking cookies.</td><td>Until you clear your browser data</td></tr></tbody></table>'+
 '<h2>Legal basis</h2><p>We process data to provide the service you asked for, with your consent when you create an account, and for our legitimate interest in keeping Rookery safe and fair.</p>'+
 '<h2>Who can see your data</h2><ul><li><b>Everyone:</b> your username, avatar, title, country, bio, ratings, achievements, online status and finished games.</li><li><b>Your friends:</b> private messages you send them.</li><li><b>Rookery staff:</b> account details, reports and reported conversations, only to moderate and run the service.</li><li><b>Service providers:</b> traffic passes through Cloudflare, which provides the secure connection to the site. Cloudflare processes it under its own privacy policy.</li></ul><p>We never sell or rent personal data. We share it with authorities only when the law requires us to.</p>'+
 '<h2>Your rights</h2><ul><li><b>Access and copy:</b> download all your data from <a href="#prefs">Settings</a>.</li><li><b>Correction:</b> edit your profile at any time.</li><li><b>Deletion:</b> delete your account from Settings. It is removed right away and cannot be undone.</li><li><b>Other requests or questions:</b> write to us '+contactLine()+'.</li></ul>'+
 '<h2>Children</h2><p>Rookery is not meant for children under 13 and we do not knowingly collect their data. If you believe a child under 13 has an account, contact us and we will delete it.</p>'+
 '<h2>Security</h2><p>Connections are encrypted, passwords and sign-in tokens are stored only as one-way hashes, private messages and backups are encrypted, accounts lock after repeated wrong passwords, and the server is not exposed directly to the internet. No system is perfectly secure, so please use a password you do not use elsewhere.</p>'+
 '<h2>Changes</h2><p>If this policy changes in an important way, we will show a notice on the site.</p>';}

function rulesHTML(){return ''+
 '<p>Rookery is for everyone who enjoys chess. These rules keep it that way.</p>'+
 '<ol class="rules"><li><b>Be respectful.</b> Good luck and well played go a long way. No insults, threats, harassment or hate based on who someone is.</li>'+
 '<li><b>Play fair.</b> No engines, no help from others, no extra accounts and no throwing games.</li>'+
 '<li><b>Keep it clean.</b> No sexual, violent or shocking content in chat, names, bios or messages.</li>'+
 '<li><b>Protect privacy.</b> Never share anyone\'s personal information, including your own address or phone number.</li>'+
 '<li><b>No spam or advertising.</b> No links to other sites, selling, or flooding chat.</li>'+
 '<li><b>Do not impersonate.</b> Do not pretend to be staff or another player.</li>'+
 '<li><b>Use the tools.</b> If someone bothers you, block them from their profile and report them. Do not argue back.</li></ol>'+
 '<h2>What happens if rules are broken</h2><p>Depending on how serious it is: a warning, chat turned off for a while, rating or result changes, a temporary suspension, or a permanent ban. Repeated use of blocked words turns chat off automatically.</p>'+
 '<h2>Blocking and reporting</h2><p>Open a player\'s profile to block or report them. Blocked players cannot message, challenge or invite you, and you will not be paired with them. Reports go to the moderators.</p>';}

function licensesHTML(){var com=NET.cfg&&NET.cfg.commercial;
  var sets=[['Papercut','Nikolay Anzarov','CC BY 4.0','https://creativecommons.org/licenses/by/4.0/'],['Chessnut','Alexis Luengas','Apache 2.0','https://www.apache.org/licenses/LICENSE-2.0'],['Modern (mpchess)','Maxime Chupin','GPLv3+','https://www.gnu.org/licenses/gpl-3.0.html'],['Merida','Armando Hernandez Marroquin','GPLv2+','https://www.gnu.org/licenses/gpl-2.0.html'],['Royal (a recolor of Celtic)','Maurizio Monge','MIT','https://github.com/maurimo/chess-art/blob/main/LICENSE'],['Classic (cburnett)','Colin M.L. Burnett','GPLv2+','https://www.gnu.org/licenses/gpl-2.0.html']];
  if(!com)sets=sets.concat([['Staunty, Gioco, Tatiana, Maestro, Cardinal','sadsnake1','CC BY-NC-SA 4.0 (non-commercial use only)','https://creativecommons.org/licenses/by-nc-sa/4.0/']]);
  return '<p>Rookery is built on the work of others. Thank you to everyone below.</p>'+
   '<h2>Source code</h2><p>The Rookery source code is public at <a href="https://github.com/Lvxz-viper/Rookery" target="_blank" rel="noopener">github.com/Lvxz-viper/Rookery</a>.</p>'+
   '<h2>Chess engine</h2><p><b>Stockfish 18</b> by the Stockfish developers, licensed under the <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU GPL v3</a>. WebAssembly build by Chess.com. The complete source code is available at <a href="https://github.com/official-stockfish/Stockfish" target="_blank" rel="noopener">github.com/official-stockfish/Stockfish</a>, and the files Rookery serves are in the Rookery repository above. The built-in fallback engine is part of Rookery.</p>'+
   '<h2>Piece sets</h2><table class="ptab"><thead><tr><th>Set</th><th>Author</th><th>License</th></tr></thead><tbody>'+sets.map(function(x){return '<tr><td>'+x[0]+'</td><td>'+x[1]+'</td><td><a href="'+x[3]+'" target="_blank" rel="noopener">'+x[2]+'</a></td></tr>';}).join('')+'</tbody></table><p class="fine">Piece artwork collected by the Lichess project. Sets are used unmodified, except Royal.</p>'+
   '<h2>Puzzles and openings</h2><p>Puzzles from the <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noopener">Lichess puzzle database</a>, released under CC0. Opening names follow the Lichess chess-openings list, released under CC0.</p>'+
   '<h2>Fonts</h2><p>Bodoni Moda by Owen Earl and Onest by Dmitri Voloshin, both under the <a href="https://openfontlicense.org" target="_blank" rel="noopener">SIL Open Font License 1.1</a>.</p>'+
   '<h2>Trademarks</h2><p>Rookery is an independent project and is not affiliated with Chess.com, Lichess or any other chess site.</p>';}

function contactHTML(){var e=NET.cfg&&NET.cfg.contact;
  if(!ONLINE)return '<p>The contact form works on the Rookery server.</p>';
  return (e?'<p>Email: <a href="mailto:'+esc(e)+'">'+esc(e)+'</a>. Or use the form below.</p>':'<p>Send a message to the people who run Rookery. Add an email address if you want a reply.</p>')+
   '<form class="form" data-form="contact6" id="contactForm"><label>Topic<select id="ctKind"><option value="question">A question or idea</option><option value="report">A problem or a player</option><option value="privacy">My data or privacy</option><option value="copyright">Copyright or license notice</option><option value="other">Something else</option></select></label>'+
   '<label>Your email (optional)<input id="ctEmail" type="email" maxlength="120" autocomplete="email" placeholder="Only needed if you want a reply"></label>'+
   '<label>Message<textarea id="ctText" maxlength="3000" rows="6" required placeholder="How can we help?"></textarea></label><div class="err" role="alert"></div><button class="btn pri lg" type="submit">Send message</button></form>'+
   '<h2>Copyright and license notices</h2><p>If you believe something on Rookery uses your work without permission, pick “Copyright or license notice” and include: what the work is, where it appears on Rookery, how we can reach you, and a statement that you own the rights or act for the owner. We review every notice and remove material that should not be here.</p>';}

/* ---------- signup consent and first-visit notice ---------- */
var _authModal=authModal;authModal=function(mode){_authModal(mode);if(mode!=='signup')return;var f=$('.modal form[data-form=signup] .err');if(!f)return;
  f.insertAdjacentHTML('beforebegin','<label class="agree"><input type="checkbox" id="authAgree" required><span>I am at least 13 years old and I agree to the <a href="#terms" data-close>Terms of Service</a>, the <a href="#privacy" data-close>Privacy Policy</a> and the <a href="#rules" data-close>Community Rules</a>.</span></label>');};
function legalNotice(){if(!ONLINE)return;var v=NET.cfg&&NET.cfg.terms||'1';if(store.get('legalok','')===v||$('#legalbar'))return;
  var d=document.createElement('div');d.id='legalbar';d.className='legalbar';d.innerHTML='<span>By using Rookery you agree to the <a href="#terms">Terms</a> and the <a href="#privacy">Privacy Policy</a>. We store your settings in this browser and use no tracking cookies.</span><button class="btn sm pri" data-act="legalok">OK</button>';document.body.appendChild(d);}

/* ---------- settings: privacy and account ---------- */
var _prefsPage=prefsPage;prefsPage=function(){var h=_prefsPage();if(!ONLINE||!NET.me)return h;var me=NET.me,bl=me.blocked||[];
  var sec='<section class="blk"><h2>Privacy and account</h2><div class="card" style="display:grid;gap:14px">'+
    (me.guest?'<p class="note">You are playing as a guest. Guest data is removed after a period without visits.</p>':
    '<div class="set" style="padding:0;border:0"><div><b>Download my data</b><small>Your account, games, daily games and private messages as a file</small></div><button class="btn" data-act="exportme">'+I.download+'Download</button></div>'+
    '<div><b style="font-weight:600">Blocked players</b>'+(bl.length?'<div class="list" style="margin-top:6px">'+bl.map(function(b){return '<div class="li"><span class="tx"><b>'+esc(b.name)+'</b></span><button class="btn sm" data-act="unblock6" data-id="'+b.id+'">Unblock</button></div>';}).join('')+'</div>':'<p class="fine" style="margin-top:4px">Nobody. Block players from their profile.</p>')+'</div>'+
    '<div class="set" style="padding:0;border:0"><div><b>Delete my account</b><small>Removes your account, ratings, messages and daily games for good</small></div><button class="btn bad" data-act="deleteme">'+I.trash+'Delete</button></div>')+
    '<p class="fine"><a href="#privacy">Privacy Policy</a> · <a href="#terms">Terms</a> · <a href="#rules">Community rules</a> · <a href="#contact">Contact</a></p></div></section>';
  var mk='<section class="blk"><h2>About Rookery</h2>';return h.indexOf(mk)>=0?h.replace(mk,sec+mk):h+sec;};
function deleteModal(){openModal('<h2>Delete your account</h2><p class="note">This removes your account, ratings, achievements, private messages and daily games right away. Running daily games are lost. Finished games stay in the history as “Deleted player”. This cannot be undone.</p><form class="form" data-form="delete6"><label>Type your password to confirm<input id="delPw" type="password" autocomplete="current-password" required></label><div class="err" role="alert"></div><button class="btn bad lg" type="submit">Delete my account for good</button></form>');}
function downloadJSON(obj,name){try{var b=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u);},3000);}catch(e){toast('Download failed');}}

/* ---------- player card: block and report ---------- */
var _showPlayer6=showPlayer;showPlayer=function(p){_showPlayer6(p);var me=NET.me;if(!me||me.id===p.id)return;
  var m=modalStack[modalStack.length-1],md=m&&m.querySelector('.modal');if(!md)return;var row=md.querySelector('.row');if(!row)return;
  var isB=(me.blocked||[]).some(function(b){return b.id===p.id;});
  row.insertAdjacentHTML('afterend','<div class="row safety"><button class="btn ghost sm" data-act="'+(isB?'unblock6':'block6')+'" data-id="'+p.id+'" data-name="'+esc(p.name)+'">'+I.ban+(isB?'Unblock':'Block')+'</button><button class="btn ghost sm" data-act="report6" data-id="'+p.id+'" data-name="'+esc(p.name)+'" data-where="profile">'+I.report+'Report</button></div>');};
var _dmThreadHTML=dmThreadHTML;dmThreadHTML=function(){var h=_dmThreadHTML(),T=NET.dm.thread;if(!T||T.id!==NET.dm.openId)return h;
  return h.replace('<button class="btn ghost sm" data-act="player"','<button class="btn ghost sm" data-act="report6" data-id="'+T.id+'" data-name="'+esc(T.who.name)+'" data-where="dm" title="Report">'+I.report+'</button><button class="btn ghost sm" data-act="player"');};
function reportModal(id,name,where){openModal('<h2>Report '+esc(name)+'</h2><p class="note">'+(where==='dm'?'Your recent messages with them are attached so a moderator can see what happened.':'A moderator will look at their account.')+'</p><form class="form" data-form="report6" data-id="'+id+'" data-where="'+where+'"><label>Reason<select id="rpWhy"><option>Harassment or insults</option><option>Cheating</option><option>Hate or threats</option><option>Inappropriate name or bio</option><option>Spam</option><option>Underage user</option><option>Other</option></select></label><label>Details (optional)<textarea id="rpNote" maxlength="300" rows="3"></textarea></label><label class="agree"><input type="checkbox" id="rpBlock" checked><span>Also block '+esc(name)+'</span></label><button class="btn pri lg" type="submit">Send report</button></form>');}

/* ---------- actions, forms, messages ---------- */
var _onAct6=onAct;onAct=function(e){var a=e.target.closest('[data-act]');if(!a){_onAct6(e);return;}var act=a.dataset.act;
  switch(act){
    case 'legalok':store.set('legalok',NET.cfg&&NET.cfg.terms||'1');var lb=$('#legalbar');if(lb)lb.remove();return;
    case 'exportme':if(netSend({t:'export_data'}))toast('Preparing your data');return;
    case 'deleteme':deleteModal();return;
    case 'block6':netSend({t:'block',id:a.dataset.id});if(modalStack.length)closeModal();return;
    case 'unblock6':netSend({t:'unblock',id:a.dataset.id});if(modalStack.length)closeModal();return;
    case 'report6':if(modalStack.length)closeModal();reportModal(a.dataset.id,a.dataset.name,a.dataset.where||'profile');return;
  }
  _onAct6(e);};
var _onSubmit6=onSubmit;onSubmit=function(form){var f=form.dataset.form;
  if(f==='contact6'){var t=$('#ctText').value.trim();if(t.length<10){form.querySelector('.err').textContent='Please write a little more so we can help.';return;}
    form.querySelector('button[type=submit]').disabled=true;if(!netSend({t:'contact',kind:$('#ctKind').value,email:$('#ctEmail').value.trim(),text:t}))form.querySelector('button[type=submit]').disabled=false;return;}
  if(f==='delete6'){var b=form.querySelector('button[type=submit]');b.disabled=true;NET.deleting=true;if(!netSend({t:'delete_account',password:$('#delPw').value}))b.disabled=false;return;}
  if(f==='report6'){var id=form.dataset.id;netSend({t:'report_player',id:id,where:form.dataset.where,reason:$('#rpWhy').value,note:$('#rpNote').value});if($('#rpBlock').checked)netSend({t:'block',id:id});closeModal();return;}
  _onSubmit6(form);};
var _netMsg6=netMsg;netMsg=function(m){
  switch(m.t){
    case 'contact_ok':{var fm=$('#contactForm');if(fm)fm.outerHTML='<div class="msg ok">Thank you. Your message has been sent'+($('#ctEmail')&&$('#ctEmail').value?' and we will reply by email':'')+'.</div>';else toast('Message sent');}return;
    case 'export':downloadJSON(m.data,'rookery-my-data-'+new Date().toISOString().slice(0,10)+'.json');toast('Your data was downloaded');return;
    case 'banned':if(NET.wasDeleted)return;break;
    case 'deleted':NET.deleting=false;NET.wasDeleted=true;store.set('token',null);try{localStorage.removeItem('rookery:profile');}catch(e){}NET.ok=false;var w=NET.ws;NET.ws=null;try{w&&w.close();}catch(e){}
      while(modalStack.length)closeModal();openModal('<h2>Your account was deleted</h2><p class="note">Everything connected to it has been removed. Thank you for playing on Rookery.</p><div class="form"><button class="btn pri" data-act="reloadsite">OK</button></div>',{noclose:true});return;
    case 'error':if(NET.deleting){NET.deleting=false;var er=$('.modal form[data-form=delete6] .err');if(er){er.textContent=m.msg;var bt=$('.modal form[data-form=delete6] button[type=submit]');if(bt)bt.disabled=false;return;}}
      {var cf=$('#contactForm');if(cf){var b2=cf.querySelector('button[type=submit]');if(b2&&b2.disabled){b2.disabled=false;cf.querySelector('.err').textContent=m.msg;return;}}}break;
  }
  _netMsg6(m);
  if(m.t==='welcome'||m.t==='cfg'){applyCommercial();applyTheme();legalNotice();if(LEGAL_ROUTES.indexOf(route)>=0||route==='prefs')renderPage();}
  if(m.t==='me'&&route==='prefs')renderPage();};
document.addEventListener('click',function(e){var a=e.target.closest('[data-act=reloadsite]');if(a)location.href=location.pathname;});

