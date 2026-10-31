/* ---------- utilities ---------- */
var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var store={get:function(k,d){try{var v=localStorage.getItem('rookery:'+k);return v?JSON.parse(v):d;}catch(e){return d;}},set:function(k,v){try{localStorage.setItem('rookery:'+k,JSON.stringify(v));}catch(e){}}};
function ago(ts){var s=(Date.now()-ts)/1000;if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';if(s<86400*30)return Math.floor(s/86400)+' d ago';return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
function wp(cp){return 50+50*(2/(1+Math.exp(-0.00368208*cp))-1);}
function fmtEval(cp,mate,term){if(term==='mate')return '#';if(term==='stalemate')return '½';if(mate)return (mate>0?'M':'−M')+Math.abs(mate);var v=cp/100;return (v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(Math.abs(v)>=10?0:1);}
function fmtClock(ms,tenths){ms=Math.max(0,ms);if(ms<10000&&tenths!==false){var s=ms/1000;return '0:0'+s.toFixed(1);}var t=Math.ceil(ms/1000),h=Math.floor(t/3600),m=Math.floor(t%3600/60),s2=t%60;return (h?h+':'+(m<10?'0':''):'')+m+':'+(s2<10?'0':'')+s2;}
function greeting(){var h=new Date().getHours();return h<5?'Good evening':h<12?'Good morning':h<18?'Good afternoon':'Good evening';}

/* ---------- pieces ---------- */
var PIECE_SVGS=/*PIECES*/;
var PIMG={},PIMG_SET='';
function loadPieces(set){if(!PIECE_SVGS[set])set='staunty';if(PIMG_SET===set)return;PIMG_SET=set;var S=PIECE_SVGS[set];
  for(var c=0;c<2;c++)for(var t=1;t<=6;t++){var k=(c?'b':'w')+' PNBRQK'[t];PIMG[t|(c<<3)]="url('data:image/svg+xml;utf8,"+encodeURIComponent(S[k]).replace(/'/g,'%27')+"')";}}
function pieceUrl(set,k){return "url('data:image/svg+xml;utf8,"+encodeURIComponent(PIECE_SVGS[set][k]).replace(/'/g,'%27')+"')";}
/* avatar silhouettes */
var GLYPH={
 p:'<path d="M38 78C38 66 42 58 46 52H54C58 58 62 66 62 78Z"/><rect x="39" y="46" width="22" height="7" rx="3.5"/><circle cx="50" cy="34" r="11.5"/><rect x="28" y="78" width="44" height="9" rx="4"/>',
 n:'<path d="M35 80C33 68 39 60 46 54C39 56 33 60 27 60C21 60 19 54 22 48C27 39 33 31 40 25L38 14C44 16 48 19 51 22C65 22 75 35 75 53C75 64 71 73 68 80Z"/><rect x="26" y="78" width="50" height="9" rx="4"/>',
 b:'<path d="M36 78C38 66 42 61 44 57H56C58 61 62 66 64 78Z"/><rect x="39" y="51" width="22" height="7" rx="3.5"/><path d="M50 17C62 26 65 40 58 52H42C35 40 38 26 50 17Z"/><circle cx="50" cy="13" r="4.5"/><rect x="28" y="78" width="44" height="9" rx="4"/>',
 r:'<path d="M33 78L36 44H64L67 78Z"/><path d="M28 17H38V25H45V17H55V25H62V17H72V38L66 44H34L28 38Z"/><rect x="25" y="78" width="50" height="9" rx="4"/>',
 q:'<path d="M30 78L24 33L38 56L40 26L50 53L60 26L62 56L76 33L70 78Z"/><circle cx="24" cy="29" r="4.5"/><circle cx="40" cy="22" r="4.5"/><circle cx="60" cy="22" r="4.5"/><circle cx="76" cy="29" r="4.5"/><rect x="25" y="78" width="50" height="9" rx="4"/>',
 k:'<path d="M30 78C27 62 30 50 40 46C44 44 47 46 50 50C53 46 56 44 60 46C70 50 73 62 70 78Z"/><path d="M46 11H54V20H62V28H54V41H46V28H38V20H46Z"/><rect x="25" y="78" width="50" height="9" rx="4"/>'};
function avatar(a,cls,st){a=a||{p:'p',c:0};if(!PIMG_SET)loadPieces(typeof settings!=='undefined'?settings.pieces:'staunty');var t=' pnbrqk'.indexOf(a.p);if(t<1)t=1;return '<span class="av '+(cls||'')+'" style="--t:'+TINTS[a.c%8]+'"><i style="background-image:'+PIMG[t]+'"></i>'+(st?'<i class="st '+(st==='online'?'':st==='playing'?'play':'off')+'"></i>':'')+'</span>';}

/* ---------- icons ---------- */
function ic(d){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';}
var I={
 home:ic('<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>'),
 play:ic('<path d="M8 20.5h9.5l-1-3h-7.5z"/><path d="M9.3 17.5c0-2.8 1.3-4.1 2.4-5.1-1.4.5-2.8.9-3.9.5-1-.4-1.2-1.6-.6-2.6 1.2-2 2.7-3.9 4.4-5.4L11.2 3c1.6.5 2.6 1.3 3.2 2.1 3 .3 4.6 3 4.6 6.9 0 2.3-.6 4-1.2 5.5"/>'),
 puzzle:ic('<path d="M10 3.5h4V6a1.6 1.6 0 1 0 3.2 0V3.5h3.3v7h-2.3a1.6 1.6 0 1 0 0 3.2h2.3v6.8h-7v-2.3a1.6 1.6 0 1 0-3.2 0v2.3H3.5v-7h2.3a1.6 1.6 0 1 0 0-3.2H3.5v-7z"/>'),
 analysis:ic('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/><path d="m7.5 12 2-2.5 2 1.5 2-3"/>'),
 watch:ic('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10.5 9 3.5 2-3.5 2z" fill="currentColor"/>'),
 community:ic('<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M17.5 14.7c2 .7 3.2 2.6 3.5 5.3"/>'),
 profile:ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.4-4 4.4-6 8-6s6.6 2 8 6"/>'),
 prefs:ic('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
 first:ic('<path d="m18 6-6 6 6 6M7 6v12"/>'),prev:ic('<path d="m15 6-6 6 6 6"/>'),next:ic('<path d="m9 6 6 6-6 6"/>'),last:ic('<path d="m6 6 6 6-6 6M17 6v12"/>'),
 flip:ic('<path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"/>'),
 hint:ic('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>'),
 undo:ic('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
 draw:ic('<path d="M5 9h14M5 15h14"/>'),
 flag:ic('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
 x:ic('<path d="M6 6l12 12M18 6 6 18"/>'),
 copy:ic('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
 bolt:ic('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
 clock:ic('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M10 2h4"/>'),
 bot:ic('<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>'),
 friend:ic('<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M19 8v6M16 11h6"/>'),
 users:ic('<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2.5 19c.5-2.8 2.6-4.5 5.5-4.5s5 1.7 5.5 4.5M13 15c.9-.3 1.9-.5 3-.5 2.9 0 5 1.7 5.5 4.5"/>'),
 eye:ic('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
 check:ic('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
 warn:ic('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
 chat:ic('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/>'),
 star:ic('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
 cal:ic('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
 out:ic('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>'),
 trophy:ic('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
 link:ic('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
 search:ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
 board:ic('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 12h17M12 3.5v17M3.5 7.75h4.25V3.5M12 12h4.25v4.25H20.5M7.75 12v4.25H12M16.25 3.5v4.25H12"/>'),
 report:ic('<path d="M4 21V4h12l-1.5 4L16 12H4"/>')
};

/* ---------- sound (synthesized, wooden) ---------- */
var AC=null;
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){AC=null;}}if(AC&&AC.state==='suspended')AC.resume();return AC;}
function tone(f,d,type,vol,delay){var a=ac();if(!a)return;var t=a.currentTime+(delay||0),o=a.createOscillator(),g=a.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol||.1,t+.006);g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(g).connect(a.destination);o.start(t);o.stop(t+d+.03);}
function knock(freq,d,vol,delay,body){var a=ac();if(!a)return;var t=a.currentTime+(delay||0),len=Math.floor(a.sampleRate*d),buf=a.createBuffer(1,len,a.sampleRate),ch=buf.getChannelData(0);
  for(var i=0;i<len;i++)ch[i]=(Math.random()*2-1)*Math.pow(1-i/len,6);
  var s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=buf;f.type='bandpass';f.frequency.value=freq;f.Q.value=2.2;g.gain.value=vol;s.connect(f).connect(g).connect(a.destination);s.start(t);
  var o=a.createOscillator(),og=a.createGain();o.type='sine';o.frequency.setValueAtTime(body||210,t);o.frequency.exponentialRampToValueAtTime((body||210)*.7,t+.07);og.gain.setValueAtTime(.0001,t);og.gain.exponentialRampToValueAtTime(.16,t+.004);og.gain.exponentialRampToValueAtTime(.0001,t+.09);o.connect(og).connect(a.destination);o.start(t);o.stop(t+.12);}
function sfx(k){if(!settings.sound)return;try{
  if(k==='move')knock(2100,.05,1.3,0,240);
  else if(k==='capture'){knock(1300,.09,1.6,0,170);knock(2600,.04,.6,.012,300);}
  else if(k==='castle'){knock(2100,.05,1.1,0,240);knock(1900,.05,1.1,.1,220);}
  else if(k==='check'){knock(1700,.06,1.2,0,230);tone(880,.16,'triangle',.06,.02);}
  else if(k==='start'){tone(587,.14,'sine',.07);tone(880,.24,'sine',.07,.11);}
  else if(k==='end'){tone(523,.16,'sine',.07);tone(392,.3,'sine',.07,.14);}
  else if(k==='win'){tone(523,.12,'triangle',.06);tone(659,.12,'triangle',.06,.1);tone(784,.3,'triangle',.06,.2);}
  else if(k==='illegal')tone(160,.1,'square',.03);
  else if(k==='ok'){tone(740,.1,'sine',.07);tone(988,.18,'sine',.07,.08);}
  else if(k==='no'){tone(260,.16,'triangle',.08);tone(196,.24,'triangle',.06,.1);}
  else if(k==='low')tone(1046,.08,'sine',.05);
  else if(k==='notify'){tone(880,.09,'sine',.06);tone(1175,.16,'sine',.06,.09);}
}catch(e){}}

/* ---------- toasts & modals ---------- */
function toast(msg,ms){var box=$('#toasts');var d=document.createElement('div');d.className='toast';d.textContent=msg;box.appendChild(d);
  while(box.children.length>3)box.firstChild.remove();
  setTimeout(function(){d.classList.add('out');setTimeout(function(){d.remove();},260);},ms||2600);}
var modalStack=[];
function openModal(html,opts){opts=opts||{};var s=document.createElement('div');s.className='scrim';s.innerHTML='<div class="modal '+(opts.wide?'wide':'')+'" role="dialog" aria-modal="true">'+(opts.noclose?'':'<button class="x" data-close aria-label="Close">'+I.x+'</button>')+html+'</div>';
  document.body.appendChild(s);modalStack.push(s);
  s.addEventListener('pointerdown',function(e){if(e.target===s&&!opts.noclose)closeModal(s);});
  s.addEventListener('click',function(e){if(e.target.closest('[data-close]'))closeModal(s);else onAct(e);});
  s.addEventListener('submit',function(e){e.preventDefault();if(opts.onSubmit)opts.onSubmit(e.target,s);else onSubmit(e.target);});
  s._onclose=opts.onClose;var f=s.querySelector('input');if(f&&opts.focus!==false)setTimeout(function(){f.focus();},60);return s;}
function closeModal(s){s=s||modalStack[modalStack.length-1];if(!s)return;var i=modalStack.indexOf(s);if(i>=0)modalStack.splice(i,1);if(s._onclose)s._onclose();s.remove();}
function copyText(t,label){var done=function(){toast((label||'Text')+' copied');};
  try{navigator.clipboard.writeText(t).then(done,function(){fallbackCopy(t,label);});}catch(e){fallbackCopy(t,label);}}
function fallbackCopy(t,label){openModal('<h2>Copy '+esc((label||'text').toLowerCase())+'</h2><p class="note">Select the text below and copy it.</p><div class="form"><textarea id="copyBox" readonly>'+esc(t)+'</textarea></div>');var b=$('#copyBox');if(b){b.focus();b.select();}}
