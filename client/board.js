/* ---------- board view (drag, click, arrows, promotion, premoves) ---------- */
function Board(el){
  var self=this;this.el=el;
  el.innerHTML='<div class="sqs"></div><div class="pcs"></div><svg class="arrows" viewBox="0 0 800 800"></svg><div class="badges"></div><div class="promo" hidden></div>';
  this.sqL=el.querySelector('.sqs');this.pcL=el.querySelector('.pcs');this.svg=el.querySelector('.arrows');this.bdL=el.querySelector('.badges');this.promoEl=el.querySelector('.promo');
  this.orient=0;this.sel=-1;this.uArrows=[];this.uMarks={};this.sArrows=[];this.badge=null;this.legal=[];this.pickColor=null;this.interactive=false;this.hov=-1;this.premove=null;this.preColor=null;this.hintSq=-1;
  this.sqEls=[];for(var v=0;v<64;v++){var d=document.createElement('div');this.sqL.appendChild(d);this.sqEls.push(d);}
  this.buildCoords();
  el.addEventListener('contextmenu',function(e){e.preventDefault();});
  el.addEventListener('pointerdown',function(e){self.down(e);});
  el.addEventListener('pointermove',function(e){self.move(e);});
  el.addEventListener('pointerup',function(e){self.up(e);});
  el.addEventListener('pointercancel',function(){if(self.drag){self.drag.el.classList.remove('drag');self.place(self.drag.el,self.drag.sq);self.drag=null;}});
}
Board.prototype.vis=function(sq){return this.orient?63-sq:sq;};
Board.prototype.buildCoords=function(){
  for(var v=0;v<64;v++){var sq=this.orient?63-v:v,r=v>>3,c=v&7,d=this.sqEls[v];
    d.className='sq '+(((r+c)&1)?'d':'l');d.innerHTML='';
    if(settings.coords){if(c===0)d.innerHTML+='<span class="coord r">'+(8-(sq>>3))+'</span>';if(r===7)d.innerHTML+='<span class="coord f">'+FILES[sq&7]+'</span>';}
    d._base=d.className;}};
Board.prototype.setOrient=function(o){if(o!==this.orient){this.orient=o;this.buildCoords();}};
Board.prototype.sqAt=function(x,y){var r=this.el.getBoundingClientRect(),c=Math.floor((x-r.left)/r.width*8),w=Math.floor((y-r.top)/r.height*8);if(c<0||c>7||w<0||w>7)return -1;var v=w*8+c;return this.orient?63-v:v;};
Board.prototype.place=function(el,sq){var v=this.vis(sq);el.style.transform='translate('+(v&7)*100+'%,'+(v>>3)*100+'%)';};
Board.prototype.set=function(pos,o){
  o=o||{};this.pos=pos;this.last=o.last||null;this.chk=o.check==null?-1:o.check;this.interactive=!!o.interactive;this.preColor=o.premove==null?null:o.premove;
  this.legal=this.interactive?pos.legal():[];
  if(this.sel>=0&&!this.interactive&&this.preColor==null)this.sel=-1;
  if(this.sel>=0&&this.interactive&&!this.legal.some(function(m){return (m&63)===this.sel;},this))this.sel=-1;
  this.hidePromo();this.renderPieces(o.anim);this.renderSquares();this.renderArrows();};
Board.prototype.renderPieces=function(anim){
  var L=this.pcL,b=this.pos.b,map={};L.innerHTML='';
  for(var sq=0;sq<64;sq++){var p=b[sq];if(!p)continue;var d=document.createElement('div');d.className='pc';d.style.backgroundImage=PIMG[p];this.place(d,sq);L.appendChild(d);map[sq]=d;}
  this.map=map;
  if(anim&&settings.anim){var m=anim.m,f=m&63,t=(m>>6)&63,fl=m>>15,self=this,moves=[[f,t]];
    if(fl&4){if(t===62)moves.push([63,61]);else if(t===58)moves.push([56,59]);else if(t===6)moves.push([7,5]);else moves.push([0,3]);}
    if(anim.cap){var g=document.createElement('div');g.className='pc';g.style.backgroundImage=PIMG[anim.cap];this.place(g,anim.capSq);L.insertBefore(g,L.firstChild);
      requestAnimationFrame(function(){requestAnimationFrame(function(){g.classList.add('ghost');setTimeout(function(){g.remove();},240);});});}
    moves.forEach(function(mm){var el=map[mm[1]];if(!el)return;el.style.transition='none';self.place(el,mm[0]);el.getBoundingClientRect();el.style.transition='';self.place(el,mm[1]);});}};
Board.prototype.targets=function(sq){return this.legal.filter(function(m){return (m&63)===sq;});};
/* squares a piece could reach on a later move, ignoring blockers: used for premoves */
Board.prototype.preTargets=function(sq){var b=this.pos.b,p=b[sq];if(!p)return [];var t=p&7,c=p>>3,out=[],r=sq>>3,f=sq&7;
  function add(rr,ff){if(rr<0||rr>7||ff<0||ff>7)return;var s=rr*8+ff,q=b[s];if(q&&(q>>3)===c&&(q&7)!==1&&(q&7)!==6)out.push(s);else if(!q||(q>>3)!==c)out.push(s);}
  function addFree(rr,ff){if(rr<0||rr>7||ff<0||ff>7)return;var s=rr*8+ff,q=b[s];if(!q||(q>>3)!==c)out.push(s);}
  if(t===1){var d=c===0?-1:1;addFree(r+d,f);if((c===0&&r===6)||(c===1&&r===1))addFree(r+2*d,f);addFree(r+d,f-1);addFree(r+d,f+1);}
  else if(t===2){[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(function(x){addFree(r+x[0],f+x[1]);});}
  else if(t===6){for(var dr=-1;dr<=1;dr++)for(var df=-1;df<=1;df++)if(dr||df)addFree(r+dr,f+df);
    var home=c===0?60:4;if(sq===home){var cs=this.pos.castle;if(c===0){if(cs&1)out.push(62);if(cs&2)out.push(58);}else{if(cs&4)out.push(6);if(cs&8)out.push(2);}}}
  else{var dirs=t===3?[[1,1],[1,-1],[-1,1],[-1,-1]]:t===4?[[1,0],[-1,0],[0,1],[0,-1]]:[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    dirs.forEach(function(x){for(var k=1;k<8;k++){var rr=r+x[0]*k,ff=f+x[1]*k;if(rr<0||rr>7||ff<0||ff>7)break;addFree(rr,ff);}});}
  return out;};
Board.prototype.renderSquares=function(){
  var tg={},self=this;
  if(this.sel>=0&&settings.legal){if(this.interactive)this.targets(this.sel).forEach(function(m){tg[(m>>6)&63]=1;});else if(this.preColor!=null)this.preTargets(this.sel).forEach(function(s){tg[s]=1;});}
  for(var v=0;v<64;v++){var sq=this.orient?63-v:v,d=this.sqEls[v],c=d._base;
    if(this.last&&(this.last[0]===sq||this.last[1]===sq))c+=' last';
    if(this.premove&&(this.premove[0]===sq||this.premove[1]===sq))c+=' pre';
    if(sq===this.sel)c+=(this.interactive?' sel':' pre');
    if(this.uMarks[sq]||sq===this.hintSq)c+=' mk';
    if(sq===this.chk)c+=' chk';
    if(tg[sq])c+=this.pos.b[sq]&&(this.pos.b[sq]>>3)!==(this.pos.b[this.sel]>>3)?' cap':' dot';
    if(sq===this.hov&&this.drag)c+=' hov';
    if(d.className!==c)d.className=c;}};
Board.prototype.center=function(sq){var v=this.vis(sq);return [(v&7)*100+50,(v>>3)*100+50];};
Board.prototype.arrowSvg=function(f,t,color,op,w){
  var a=this.center(f),b=this.center(t),dx=b[0]-a[0],dy=b[1]-a[1],pts=[a],head=30,sw=w||15,hw=38;
  var adx=Math.abs(dx),ady=Math.abs(dy);
  if((adx===100&&ady===200)||(adx===200&&ady===100)){if(ady>adx)pts.push([a[0],b[1]]);else pts.push([b[0],a[1]]);}
  pts.push(b);
  var p1=pts[pts.length-2],ux=b[0]-p1[0],uy=b[1]-p1[1],L=Math.hypot(ux,uy);ux/=L;uy/=L;
  var end=[b[0]-ux*head,b[1]-uy*head],start=pts.length===2?[a[0]+ux*22,a[1]+uy*22]:a;
  var path='M'+start[0]+' '+start[1];for(var i=1;i<pts.length-1;i++)path+=' L'+pts[i][0]+' '+pts[i][1];path+=' L'+end[0]+' '+end[1];
  var nx=-uy,ny=ux,tip=[b[0]-ux*6,b[1]-uy*6];
  var poly=[tip,[end[0]+nx*hw/2,end[1]+ny*hw/2],[end[0]-nx*hw/2,end[1]-ny*hw/2]].map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}).join(' ');
  return '<g opacity="'+(op||.85)+'"><path d="'+path+'" stroke="'+color+'" stroke-width="'+sw+'" fill="none" stroke-linejoin="round"/><polygon points="'+poly+'" fill="'+color+'"/></g>';};
Board.prototype.renderArrows=function(){
  var s='',self=this;
  this.sArrows.forEach(function(a){s+=self.arrowSvg(a[0],a[1],a[2]||'#6fae5a',a[3],a[4]);});
  this.uArrows.forEach(function(a){s+=self.arrowSvg(a[0],a[1],'#e3a43c',.82);});
  this.svg.innerHTML=s;this.bdL.innerHTML='';
  if(this.badge){var v=this.vis(this.badge.sq),d=document.createElement('div');d.className='badge';d.style.left=(v&7)*12.5+'%';d.style.top=(v>>3)*12.5+'%';d.innerHTML='<i style="background:'+this.badge.c+'">'+this.badge.g+'</i>';this.bdL.appendChild(d);}};
Board.prototype.clearUser=function(){if(this.uArrows.length||Object.keys(this.uMarks).length){this.uArrows=[];this.uMarks={};this.renderArrows();this.renderSquares();}};
Board.prototype.clearPremove=function(){if(this.premove||(!this.interactive&&this.sel>=0)){this.premove=null;this.sel=-1;this.renderSquares();if(this.onPremove)this.onPremove(null);}};
Board.prototype.down=function(e){
  if(e.button===2){this.rStart=this.sqAt(e.clientX,e.clientY);if(this.premove||this.sel>=0&&!this.interactive)this.clearPremove();return;}
  if(e.button!==0)return;
  this.clearUser();
  if(!this.promoEl.hidden)return;
  var sq=this.sqAt(e.clientX,e.clientY);if(sq<0)return;
  var p=this.pos.b[sq];
  if(this.interactive){
    if(this.sel>=0&&this.targets(this.sel).some(function(m){return ((m>>6)&63)===sq;})){this.tryMove(this.sel,sq,false);return;}
    if(p&&(p>>3)===this.pos.turn&&(this.pickColor==null||this.pickColor===this.pos.turn)){this.startDrag(e,sq);}
    else{this.sel=-1;this.renderSquares();}
    return;}
  if(this.preColor!=null){
    if(this.sel>=0&&this.preTargets(this.sel).indexOf(sq)>=0){this.setPremove(this.sel,sq);return;}
    if(p&&(p>>3)===this.preColor){this.premove=null;this.startDrag(e,sq);if(this.onPremove)this.onPremove(null);return;}
    this.clearPremove();}};
Board.prototype.startDrag=function(e,sq){var was=this.sel===sq;this.sel=sq;this.renderSquares();
  this.drag={sq:sq,el:this.map[sq],moved:false,was:was,x:e.clientX,y:e.clientY};try{this.el.setPointerCapture(e.pointerId);}catch(er){}};
Board.prototype.setPremove=function(f,t){this.premove=[f,t];this.sel=-1;this.renderSquares();if(this.onPremove)this.onPremove([f,t]);};
Board.prototype.move=function(e){var d=this.drag;if(!d||!d.el)return;
  if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<4)return;
  d.moved=true;d.el.classList.add('drag');
  var r=this.el.getBoundingClientRect(),s=r.width/8;
  d.el.style.transform='translate('+(e.clientX-r.left-s/2)+'px,'+(e.clientY-r.top-s/2)+'px)';
  var h=this.sqAt(e.clientX,e.clientY);if(h!==this.hov){this.hov=h;this.renderSquares();}};
Board.prototype.up=function(e){
  if(e.button===2&&this.rStart!=null&&this.rStart>=0){var end=this.sqAt(e.clientX,e.clientY),st=this.rStart;this.rStart=-1;if(end<0)return;
    if(end===st){if(this.uMarks[st])delete this.uMarks[st];else this.uMarks[st]=1;}
    else{var i=this.uArrows.findIndex(function(a){return a[0]===st&&a[1]===end;});if(i>=0)this.uArrows.splice(i,1);else this.uArrows.push([st,end]);}
    this.renderArrows();this.renderSquares();return;}
  var d=this.drag;if(!d)return;this.drag=null;this.hov=-1;
  if(!d.el){this.renderSquares();return;}
  d.el.classList.remove('drag');
  var to=this.sqAt(e.clientX,e.clientY);
  if(d.moved&&to>=0&&to!==d.sq){
    if(this.interactive&&this.targets(d.sq).some(function(m){return ((m>>6)&63)===to;})){this.tryMove(d.sq,to,true);return;}
    if(!this.interactive&&this.preColor!=null&&this.preTargets(d.sq).indexOf(to)>=0){d.el.style.transition='none';this.place(d.el,d.sq);d.el.getBoundingClientRect();d.el.style.transition='';this.setPremove(d.sq,to);return;}}
  d.el.style.transition='none';this.place(d.el,d.sq);d.el.getBoundingClientRect();d.el.style.transition='';
  if(d.moved&&to>=0&&to!==d.sq&&this.interactive)sfx('illegal');
  if(!d.moved&&d.was)this.sel=-1;
  this.renderSquares();};
Board.prototype.tryMove=function(f,t,dragged){
  var c=this.legal.filter(function(m){return (m&63)===f&&((m>>6)&63)===t;});if(!c.length)return;
  if(c.length>1){if(settings.autoQueen)this.commit(c.find(function(m){return ((m>>12)&7)===5;}),dragged);else this.showPromo(f,t,c,dragged);return;}
  this.commit(c[0],dragged);};
Board.prototype.commit=function(m,dragged){this.sel=-1;if(this.onMove)this.onMove(m,dragged);};
Board.prototype.showPromo=function(f,t,c,dragged){
  var self=this,v=this.vis(t),col=v&7,top=(v>>3)===0,color=this.pos.turn,el=this.promoEl;
  if(dragged&&this.map[f])this.place(this.map[f],t);
  el.innerHTML='<div class="col" style="left:'+col*12.5+'%;'+(top?'top:0':'bottom:0')+'"></div>';
  var box=el.firstChild,order=top?[5,2,4,3]:[3,4,2,5];
  order.forEach(function(pt){var b=document.createElement('button');b.style.backgroundImage=PIMG[pt|(color<<3)];b.setAttribute('aria-label',['','','Knight','Bishop','Rook','Queen'][pt]);
    b.onclick=function(ev){ev.stopPropagation();self.hidePromo();self.commit(c.find(function(m){return ((m>>12)&7)===pt;}),true);};box.appendChild(b);});
  el.hidden=false;
  el.onpointerdown=function(ev){if(ev.target===el){ev.stopPropagation();self.hidePromo();self.sel=-1;self.renderPieces();self.renderSquares();}};};
Board.prototype.hidePromo=function(){this.promoEl.hidden=true;this.promoEl.innerHTML='';};

function miniBoard(fen,orient,last){var p=new Pos(fen),h='',ls=last?[sqi(last.slice(0,2)),sqi(last.slice(2,4))]:[];
  for(var v=0;v<64;v++){var sq=orient?63-v:v,pc=p.b[sq],d=((v>>3)+(v&7))&1;h+='<i class="'+(d?'d':'')+(ls.indexOf(sq)>=0?' l':'')+'">'+(pc?'<span style="background-image:'+PIMG[pc]+'"></span>':'')+'</i>';}
  return '<div class="mini">'+h+'</div>';}
