/* ==========================================================================
   Rookery 3.2: account security. Recovery codes, forgot password,
   signed-in devices, sign-in alerts, stronger passwords.
   ========================================================================== */
I.key=ic('<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>');
I.devices=ic('<rect x="2" y="5" width="14" height="10" rx="1.5"/><path d="M6 19h6M9 15v4"/><rect x="17" y="9" width="5" height="10" rx="1.2"/>');
I.lock=ic('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
NET.sessions=null;

/* ---------- forgot password ---------- */
var _authModal7=authModal;authModal=function(mode){_authModal7(mode);if(mode!=='login')return;var f=$('.modal form[data-form=login] .err');if(!f)return;
  f.insertAdjacentHTML('afterend','<button type="button" class="linkbtn" data-act="forgot">Forgot your password?</button>');};
function recoverModal(){if(modalStack.length)closeModal();
  openModal('<h2>Reset your password</h2><p class="note">Use one of the recovery codes you saved when you created your account. Each code works once.</p>'+
    '<form class="form" data-form="recover7"><label>Username<input id="rcU" autocomplete="username" maxlength="20" spellcheck="false" required></label>'+
    '<label>Recovery code<input id="rcC" autocomplete="one-time-code" maxlength="14" spellcheck="false" placeholder="XXXXX-XXXXX" style="text-transform:uppercase;letter-spacing:.08em" required></label>'+
    '<label>New password<input id="rcP" type="password" autocomplete="new-password" minlength="8" required></label><p class="fine">At least 8 characters. Avoid common passwords and your username.</p>'+
    '<div class="err" role="alert"></div><button class="btn pri lg" type="submit">Reset password</button>'+
    '<p class="fine">No recovery codes? Send a request through the <a href="#contact" data-close>contact form</a> from the device you usually play on.</p></form>');}

/* ---------- recovery codes ---------- */
function codesModal(codes,fresh){NET.lastCodes=codes;
  openModal('<h2>'+(fresh?'Save your recovery codes':'Your new recovery codes')+'</h2><p class="note">If you ever forget your password, one of these codes lets you set a new one. Each code works once. Keep them somewhere safe, like a notes app or a photo, and do not share them.'+(fresh?'':' Your old codes no longer work.')+'</p>'+
    '<div class="codes">'+codes.map(function(c){return '<code>'+esc(c)+'</code>';}).join('')+'</div>'+
    '<div class="row"><button class="btn" data-act="codescopy">'+I.copy+'Copy</button><button class="btn" data-act="codesdl">'+I.download+'Download</button></div>'+
    '<div class="form"><button class="btn pri lg" data-close>I saved them</button></div>',{noclose:true});}
function passwordPrompt(title,note,form){openModal('<h2>'+title+'</h2><p class="note">'+note+'</p><form class="form" data-form="'+form+'"><label>Your password<input id="ppPw" type="password" autocomplete="current-password" required></label><div class="err" role="alert"></div><button class="btn pri lg" type="submit">Continue</button></form>');}

/* ---------- devices ---------- */
function devicesModal(){NET.sessions=null;netSend({t:'sessions'});openModal('<h2>Signed-in devices</h2><div id="devBox"><div class="search"><div class="spin"></div></div></div>',{wide:true});}
function renderDevices(){var box=$('#devBox'),S=NET.sessions;if(!box||!S)return;
  var row=function(x){return '<div class="li">'+'<span class="dev">'+(x.device==='phone'?'📱':'💻')+'</span><span class="tx"><b>'+(x.device==='phone'?'Phone':'Computer')+(x.current?' <span class="pill on">This device</span>':'')+'</b><small>Signed in '+new Date(x.created).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})+', last active '+ago(x.last)+(x.ip?', network '+esc(x.ip):'')+'</small></span>'+(x.current?'':'<button class="btn sm" data-act="devend" data-id="'+x.id+'">Sign out</button>')+'</div>';};
  box.innerHTML='<div class="list">'+S.list.map(row).join('')+'</div>'+(S.list.length>1?'<div class="row" style="margin-top:12px"><button class="btn bad" data-act="devothers">Sign out all other devices</button></div>':'')+
    (S.logins&&S.logins.length?'<div class="h" style="margin:20px 0 6px">Recent sign-ins</div><div class="list">'+S.logins.map(function(l){return '<div class="li"><span class="tx"><b>'+(l.device==='phone'?'Phone':'Computer')+'</b><small>'+new Date(l.ts).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+(l.ip?', network '+esc(l.ip):'')+'</small></span></div>';}).join('')+'</div>':'')+
    '<p class="fine" style="margin-top:14px">See a device you do not recognise? Sign it out and change your password.</p>';}

/* ---------- settings: security section ---------- */
var _prefsPage7=prefsPage;prefsPage=function(){var h=_prefsPage7(),me=NET.me;if(!ONLINE||!me||me.guest)return h;
  var left=me.recoveryLeft||0;
  var sec='<section class="blk"><h2>Security</h2><div class="card" style="display:grid;gap:14px">'+
    (!me.hasRecovery||left<=2?'<div class="msg '+(me.hasRecovery?'info':'no')+'">'+I.warn.replace('<svg','<svg width="18" height="18"')+'<span>'+(me.hasRecovery?'Only '+left+' recovery code'+(left===1?'':'s')+' left. Create new ones.':'You have no recovery codes. If you forget your password you cannot get back in.')+'</span></div>':'')+
    '<div class="set" style="padding:0;border:0"><div><b>Recovery codes</b><small>'+(me.hasRecovery?left+' of 8 left. Each one resets your password once.':'Not set up yet')+'</small></div><button class="btn'+(me.hasRecovery?'':' pri')+'" data-act="codesnew">'+I.key+(me.hasRecovery?'New codes':'Create codes')+'</button></div>'+
    '<div class="set" style="padding:0;border:0"><div><b>Signed-in devices</b><small>See where your account is open and sign devices out</small></div><button class="btn" data-act="devices">'+I.devices+'Devices</button></div>'+
    '<div class="set" style="padding:0;border:0"><div><b>Password</b><small>Changing it signs out every other device</small></div><button class="btn" data-act="password">'+I.lock+'Change</button></div>'+
    '</div></section>';
  var mk='<section class="blk"><h2>Privacy and account</h2>';return h.indexOf(mk)>=0?h.replace(mk,sec+mk):h+sec;};

/* ---------- actions, forms, messages ---------- */
var _onAct7=onAct;onAct=function(e){var a=e.target.closest('[data-act]');if(!a){_onAct7(e);return;}
  switch(a.dataset.act){
    case 'forgot':recoverModal();return;
    case 'codesnew':passwordPrompt('Create new recovery codes','Your old codes stop working once you create new ones.','codes7');return;
    case 'codescopy':copyText((NET.lastCodes||[]).join('\n'),'Recovery codes');return;
    case 'codesdl':{try{var b=new Blob(['Rookery recovery codes for '+(NET.me?NET.me.name:'')+'\r\nEach code works once.\r\n\r\n'+(NET.lastCodes||[]).join('\r\n')+'\r\n'],{type:'text/plain'}),u=URL.createObjectURL(b),l=document.createElement('a');l.href=u;l.download='rookery-recovery-codes.txt';document.body.appendChild(l);l.click();l.remove();setTimeout(function(){URL.revokeObjectURL(u);},3000);}catch(er){}}return;
    case 'devices':devicesModal();return;
    case 'devend':netSend({t:'session_end',id:a.dataset.id});return;
    case 'devothers':if(a.dataset.armed){netSend({t:'session_end',others:true});}else{a.dataset.armed='1';a.textContent='Click again to confirm';}return;
  }
  _onAct7(e);};
var _onSubmit7=onSubmit;onSubmit=function(form){var f=form.dataset.form;
  if(f==='recover7'){var b=form.querySelector('button[type=submit]');form.querySelector('.err').textContent='';b.disabled=true;
    if(!netSend({t:'recover',username:$('#rcU').value.trim(),code:$('#rcC').value.trim(),password:$('#rcP').value}))b.disabled=false;return;}
  if(f==='codes7'){var b2=form.querySelector('button[type=submit]');b2.disabled=true;NET.codesPending=true;if(!netSend({t:'recovery_new',password:$('#ppPw').value}))b2.disabled=false;return;}
  if(f==='signup'||f==='password'){var pw=f==='signup'?$('#authP'):$('#pwNew');if(pw&&pw.value.length<8){var er=form.querySelector('.err');if(er)er.textContent='Use at least 8 characters for your password.';else toast('Use at least 8 characters for your password.');return;}}
  _onSubmit7(form);};
var _netMsg7=netMsg;netMsg=function(m){
  switch(m.t){
    case 'recovery_codes':if(m.fresh){setTimeout(function(){codesModal(m.codes,true);},350);}else{while(modalStack.length)closeModal();codesModal(m.codes,false);}NET.codesPending=false;return;
    case 'sessions':NET.sessions=m;renderDevices();return;
    case 'session_ended':store.set('token',null);NET.ok=false;var w=NET.ws;NET.ws=null;try{w&&w.close();}catch(e){}
      while(modalStack.length)closeModal();openModal('<h2>Signed out</h2><p class="note">'+esc(m.msg||'You were signed out on this device.')+'</p><div class="form"><button class="btn pri" data-act="reloadsite">OK</button></div>',{noclose:true});return;
    case 'login_alert':if(NET.justSignedIn){NET.justSignedIn=false;return;}sfx('notify');toast('New sign-in to your account on a '+(m.device==='phone'?'phone':'computer')+'. Not you? Open Settings, then Devices.',7000);return;
    case 'error':if(NET.codesPending){NET.codesPending=false;var er=$('.modal form[data-form=codes7] .err');if(er){er.textContent=m.msg;var bt=$('.modal form[data-form=codes7] button[type=submit]');if(bt)bt.disabled=false;return;}}break;
    case 'auth_error':{var rf=$('.modal form[data-form=recover7]');if(rf){rf.querySelector('.err').textContent=m.msg;rf.querySelector('button[type=submit]').disabled=false;return;}}break;
  }
  if(m.t==='auth_ok')NET.justSignedIn=true;
  _netMsg7(m);
  if(m.t==='auth_ok')setTimeout(function(){NET.justSignedIn=false;},3000);
  if(m.t==='welcome'&&NET.me&&!NET.me.guest&&!NET.me.hasRecovery&&!store.get('rcnag:'+NET.me.id,false)){store.set('rcnag:'+NET.me.id,true);setTimeout(function(){toast('Protect your account: create recovery codes in Settings, under Security.',8000);},1500);}
  if(m.t==='me'&&route==='prefs')renderPage();};

/* ---------- start ---------- */
boot();
