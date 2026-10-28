/* Rookery chess core: rules + engine (runs in page and in worker) */
var now = function(){ return (typeof performance!=='undefined'?performance:Date).now(); };
var START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
var FILES='abcdefgh';
var M120=new Int8Array(120).fill(-1), M64=new Int8Array(64);
for(var s_=0;s_<64;s_++){var i_=21+(s_>>3)*10+(s_&7);M64[s_]=i_;M120[i_]=s_;}
var NDIR=[-21,-19,-12,-8,8,12,19,21],BDIR=[-11,-9,9,11],RDIR=[-10,-1,1,10],KDIR=[-11,-10,-9,-1,1,9,10,11];
var _seed=0x2545F491;
function rnd32(){_seed^=_seed<<13;_seed^=_seed>>>17;_seed^=_seed<<5;return _seed|0;}
var Z1=new Int32Array(1024),Z2=new Int32Array(1024);
for(var z_=0;z_<1024;z_++){Z1[z_]=rnd32();Z2[z_]=rnd32();}
var ZS1=rnd32(),ZS2=rnd32();
var ZC1=new Int32Array(16),ZC2=new Int32Array(16),ZE1=new Int32Array(8),ZE2=new Int32Array(8);
for(var c_=0;c_<16;c_++){ZC1[c_]=rnd32();ZC2[c_]=rnd32();}
for(var e_=0;e_<8;e_++){ZE1[e_]=rnd32();ZE2[e_]=rnd32();}
var CMASK=new Uint8Array(64).fill(15);
CMASK[63]=14;CMASK[56]=13;CMASK[60]=12;CMASK[7]=11;CMASK[0]=7;CMASK[4]=3;
var VAL=[0,100,320,330,500,900,0];
var PHW=[0,0,1,1,2,4,0];
function mv(f,t,fl,pr){return f|(t<<6)|(pr<<12)|(fl<<15);}
function sqn(s){return FILES[s&7]+(8-(s>>3));}
function sqi(n){return (8-(+n[1]))*8+FILES.indexOf(n[0]);}

var PST=[null,
[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20]];
var KMG=[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20];
var KEG=[-50,-40,-30,-20,-20,-30,-40,-50,-30,-20,-10,0,0,-10,-20,-30,-30,-10,20,30,30,20,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,20,30,30,20,-10,-30,-30,-30,0,0,0,0,-30,-30,-50,-30,-30,-30,-30,-30,-30,-50];
var PASSED=[0,120,80,50,30,15,10,0];

function Pos(fen){this.b=new Int8Array(64);this.k=[0,0];this.load(fen||START);}
Pos.prototype.load=function(fen){
  var p=fen.trim().split(/\s+/),b=this.b,r=0,c=0,i,ch;
  b.fill(0);
  for(i=0;i<p[0].length;i++){ch=p[0][i];
    if(ch==='/'){r++;c=0;continue;}
    if(ch>='1'&&ch<='8'){c+=+ch;continue;}
    var t=' PNBRQK'.indexOf(ch.toUpperCase()); if(t<1) throw new Error('bad fen');
    var col=(ch===ch.toUpperCase())?0:1; if(r>7||c>7) throw new Error('bad fen');
    b[r*8+c]=t|(col<<3); if(t===6)this.k[col]=r*8+c; c++;}
  this.turn=(p[1]==='b')?1:0;
  var cs=p[2]||'-';this.castle=0;
  if(cs.indexOf('K')>=0)this.castle|=1;if(cs.indexOf('Q')>=0)this.castle|=2;if(cs.indexOf('k')>=0)this.castle|=4;if(cs.indexOf('q')>=0)this.castle|=8;
  this.ep=(p[3]&&p[3]!=='-')?sqi(p[3]):-1;
  this.half=+(p[4]||0);this.full=+(p[5]||1);
  this.U=[];this.H=[];
  var h1=0,h2=0;
  for(i=0;i<64;i++)if(b[i]){h1^=Z1[b[i]*64+i];h2^=Z2[b[i]*64+i];}
  if(this.turn){h1^=ZS1;h2^=ZS2;}
  h1^=ZC1[this.castle];h2^=ZC2[this.castle];
  if(this.ep>=0){h1^=ZE1[this.ep&7];h2^=ZE2[this.ep&7];}
  this.h1=h1;this.h2=h2;
  return this;
};
Pos.prototype.fen=function(){
  var s='',b=this.b;
  for(var r=0;r<8;r++){var e=0;for(var c=0;c<8;c++){var p=b[r*8+c];
    if(!p){e++;continue;} if(e){s+=e;e=0;} var ch=' PNBRQK'[p&7]; s+=(p>>3)?ch.toLowerCase():ch;}
    if(e)s+=e; if(r<7)s+='/';}
  var cs=(this.castle&1?'K':'')+(this.castle&2?'Q':'')+(this.castle&4?'k':'')+(this.castle&8?'q':'');
  return s+' '+(this.turn?'b':'w')+' '+(cs||'-')+' '+(this.ep>=0?sqn(this.ep):'-')+' '+this.half+' '+this.full;
};
Pos.prototype.make=function(m){
  var f=m&63,t=(m>>6)&63,pr=(m>>12)&7,fl=m>>15,b=this.b,us=this.turn;
  var p=b[f],capSq=t;
  if(fl&2)capSq=t+(us===0?8:-8);
  var cap=b[capSq];
  this.U.push([m,cap,this.castle,this.ep,this.half,this.h1,this.h2]);
  this.H.push(this.h1);
  var h1=this.h1^Z1[p*64+f],h2=this.h2^Z2[p*64+f];
  if(cap){h1^=Z1[cap*64+capSq];h2^=Z2[cap*64+capSq];b[capSq]=0;}
  b[f]=0;
  var np=pr?(pr|(us<<3)):p;
  b[t]=np;h1^=Z1[np*64+t];h2^=Z2[np*64+t];
  if(fl&4){var rf,rt;
    if(t===62){rf=63;rt=61;}else if(t===58){rf=56;rt=59;}else if(t===6){rf=7;rt=5;}else{rf=0;rt=3;}
    var rk=b[rf];b[rf]=0;b[rt]=rk;h1^=Z1[rk*64+rf]^Z1[rk*64+rt];h2^=Z2[rk*64+rf]^Z2[rk*64+rt];}
  if((p&7)===6)this.k[us]=t;
  h1^=ZC1[this.castle];h2^=ZC2[this.castle];
  this.castle&=CMASK[f]&CMASK[t];
  h1^=ZC1[this.castle];h2^=ZC2[this.castle];
  if(this.ep>=0){h1^=ZE1[this.ep&7];h2^=ZE2[this.ep&7];}
  this.ep=(fl&8)?((f+t)>>1):-1;
  if(this.ep>=0){h1^=ZE1[this.ep&7];h2^=ZE2[this.ep&7];}
  this.half=((p&7)===1||cap)?0:this.half+1;
  if(us===1)this.full++;
  this.turn=us^1;h1^=ZS1;h2^=ZS2;
  this.h1=h1;this.h2=h2;
};
Pos.prototype.unmake=function(){
  var u=this.U.pop();this.H.pop();
  var m=u[0],f=m&63,t=(m>>6)&63,pr=(m>>12)&7,fl=m>>15,b=this.b;
  this.turn^=1;var us=this.turn;if(us===1)this.full--;
  var p=pr?(1|(us<<3)):b[t];
  b[f]=p;b[t]=0;
  if(u[1]){b[(fl&2)?t+(us===0?8:-8):t]=u[1];}
  if(fl&4){var rf,rt;
    if(t===62){rf=63;rt=61;}else if(t===58){rf=56;rt=59;}else if(t===6){rf=7;rt=5;}else{rf=0;rt=3;}
    b[rf]=b[rt];b[rt]=0;}
  if((p&7)===6)this.k[us]=f;
  this.castle=u[2];this.ep=u[3];this.half=u[4];this.h1=u[5];this.h2=u[6];
};
Pos.prototype.makeNull=function(){
  this.U.push([0,0,this.castle,this.ep,this.half,this.h1,this.h2]);this.H.push(this.h1);
  var h1=this.h1,h2=this.h2;
  if(this.ep>=0){h1^=ZE1[this.ep&7];h2^=ZE2[this.ep&7];}
  this.ep=-1;this.turn^=1;h1^=ZS1;h2^=ZS2;this.h1=h1;this.h2=h2;this.half++;
};
Pos.prototype.unmakeNull=function(){
  var u=this.U.pop();this.H.pop();this.turn^=1;
  this.castle=u[2];this.ep=u[3];this.half=u[4];this.h1=u[5];this.h2=u[6];
};
Pos.prototype.attacked=function(s,by){
  var b=this.b,i=M64[s],j,k,d,q,n;
  if(by===0){j=M120[i+9];if(j>=0&&b[j]===1)return true;j=M120[i+11];if(j>=0&&b[j]===1)return true;}
  else{j=M120[i-9];if(j>=0&&b[j]===9)return true;j=M120[i-11];if(j>=0&&b[j]===9)return true;}
  var N=2|(by<<3),K=6|(by<<3),B=3|(by<<3),R=4|(by<<3),Q=5|(by<<3);
  for(n=0;n<8;n++){j=M120[i+NDIR[n]];if(j>=0&&b[j]===N)return true;j=M120[i+KDIR[n]];if(j>=0&&b[j]===K)return true;}
  for(n=0;n<4;n++){d=BDIR[n];k=i+d;
    while(true){j=M120[k];if(j<0)break;q=b[j];if(q){if(q===B||q===Q)return true;break;}k+=d;}
    d=RDIR[n];k=i+d;
    while(true){j=M120[k];if(j<0)break;q=b[j];if(q){if(q===R||q===Q)return true;break;}k+=d;}}
  return false;
};
Pos.prototype.inCheck=function(){return this.attacked(this.k[this.turn],this.turn^1);};
Pos.prototype.gen=function(caps){
  var out=[],b=this.b,us=this.turn,them=us^1,s,p,ty,i,j,k,d,q,n,dirs;
  for(s=0;s<64;s++){p=b[s];if(!p||(p>>3)!==us)continue;ty=p&7;i=M64[s];
    if(ty===1){
      var fwd=us===0?-10:10,startRow=us===0?6:1,promoRow=us===0?0:7;
      j=M120[i+fwd];
      if(j>=0&&!b[j]){
        if((j>>3)===promoRow){out.push(mv(s,j,0,5),mv(s,j,0,2),mv(s,j,0,4),mv(s,j,0,3));}
        else if(!caps){out.push(mv(s,j,0,0));
          if((s>>3)===startRow){var j2=M120[i+2*fwd];if(!b[j2])out.push(mv(s,j2,8,0));}}}
      for(n=-1;n<=1;n+=2){j=M120[i+fwd+n];if(j<0)continue;q=b[j];
        if(q&&(q>>3)===them){
          if((j>>3)===promoRow)out.push(mv(s,j,1,5),mv(s,j,1,2),mv(s,j,1,4),mv(s,j,1,3));
          else out.push(mv(s,j,1,0));}
        else if(j===this.ep&&!q)out.push(mv(s,j,3,0));}
    } else if(ty===2||ty===6){dirs=ty===2?NDIR:KDIR;
      for(n=0;n<8;n++){j=M120[i+dirs[n]];if(j<0)continue;q=b[j];
        if(!q){if(!caps)out.push(mv(s,j,0,0));}else if((q>>3)===them)out.push(mv(s,j,1,0));}
    } else {dirs=ty===3?BDIR:ty===4?RDIR:KDIR;
      for(n=0;n<dirs.length;n++){d=dirs[n];k=i+d;
        while(true){j=M120[k];if(j<0)break;q=b[j];
          if(!q){if(!caps)out.push(mv(s,j,0,0));}
          else{if((q>>3)===them)out.push(mv(s,j,1,0));break;}
          k+=d;}}}
  }
  if(!caps){var cs=this.castle;
    if(us===0){
      if((cs&1)&&b[60]===6&&b[63]===4&&!b[61]&&!b[62]&&!this.attacked(60,1)&&!this.attacked(61,1)&&!this.attacked(62,1))out.push(mv(60,62,4,0));
      if((cs&2)&&b[60]===6&&b[56]===4&&!b[59]&&!b[58]&&!b[57]&&!this.attacked(60,1)&&!this.attacked(59,1)&&!this.attacked(58,1))out.push(mv(60,58,4,0));
    } else {
      if((cs&4)&&b[4]===14&&b[7]===12&&!b[5]&&!b[6]&&!this.attacked(4,0)&&!this.attacked(5,0)&&!this.attacked(6,0))out.push(mv(4,6,4,0));
      if((cs&8)&&b[4]===14&&b[0]===12&&!b[3]&&!b[2]&&!b[1]&&!this.attacked(4,0)&&!this.attacked(3,0)&&!this.attacked(2,0))out.push(mv(4,2,4,0));
    }}
  return out;
};
Pos.prototype.legal=function(){
  var ms=this.gen(false),out=[],us=this.turn;
  for(var i=0;i<ms.length;i++){this.make(ms[i]);if(!this.attacked(this.k[us],us^1))out.push(ms[i]);this.unmake();}
  return out;
};
Pos.prototype.uci=function(m){var pr=(m>>12)&7;return sqn(m&63)+sqn((m>>6)&63)+(pr?' pnbrqk'[pr]:'');};
Pos.prototype.parseUci=function(u){
  if(!u||u.length<4)return 0;var f=sqi(u.slice(0,2)),t=sqi(u.slice(2,4)),pr=u[4]?' pnbrqk'.indexOf(u[4].toLowerCase()):0;
  var lg=this.legal();for(var i=0;i<lg.length;i++){var m=lg[i];if((m&63)===f&&((m>>6)&63)===t&&((m>>12)&7)===(pr>0?pr:0))return m;}
  return 0;
};
Pos.prototype.san=function(m,lg){
  lg=lg||this.legal();
  var f=m&63,t=(m>>6)&63,pr=(m>>12)&7,fl=m>>15,p=this.b[f],ty=p&7,s;
  if(fl&4)s=((t&7)===6)?'O-O':'O-O-O';
  else if(ty===1){s=(fl&1)?FILES[f&7]+'x':'';s+=sqn(t);if(pr)s+='='+' PNBRQK'[pr];}
  else{s=' PNBRQK'[ty];
    if(ty!==6){var amb=false,sf=false,sr=false;
      for(var i=0;i<lg.length;i++){var o=lg[i],of=o&63;
        if(of!==f&&((o>>6)&63)===t&&(this.b[of]&7)===ty){amb=true;if((of&7)===(f&7))sf=true;if((of>>3)===(f>>3))sr=true;}}
      if(amb){if(!sf)s+=FILES[f&7];else if(!sr)s+=(8-(f>>3));else s+=sqn(f);}}
    if(fl&1)s+='x';s+=sqn(t);}
  this.make(m);if(this.inCheck())s+=this.legal().length?'+':'#';this.unmake();
  return s;
};
Pos.prototype.parseSan=function(str){
  var c=str.replace(/[+#!?]/g,'').replace(/0-0-0/,'O-O-O').replace(/0-0/,'O-O').replace(/=/,'');
  var lg=this.legal();
  for(var i=0;i<lg.length;i++){var s=this.san(lg[i],lg).replace(/[+#]/g,'').replace('=','');if(s===c)return lg[i];}
  // lenient: piece letter missing for pawn promos like e8Q handled above; try with = removal
  return 0;
};
Pos.prototype.repCount=function(){var n=1,H=this.H;for(var i=H.length-2;i>=0;i-=2)if(H[i]===this.h1)n++;return n;};
Pos.prototype.isRep=function(){var H=this.H,lim=Math.max(0,H.length-this.half);for(var i=H.length-2;i>=lim;i-=2)if(H[i]===this.h1)return true;return false;};
Pos.prototype.insufficient=function(){
  var minors=[],b=this.b;
  for(var s=0;s<64;s++){var p=b[s];if(!p)continue;var t=p&7;
    if(t===1||t===4||t===5)return false;
    if(t===2||t===3)minors.push([t,((s>>3)+(s&7))&1]);}
  if(minors.length<=1)return true;
  for(var i=0;i<minors.length;i++)if(minors[i][0]!==3||minors[i][1]!==minors[0][1])return false;
  return true;
};
Pos.prototype.status=function(){
  var lg=this.legal();
  if(!lg.length)return this.inCheck()?{over:true,result:this.turn===0?'0-1':'1-0',reason:'checkmate'}:{over:true,result:'1/2-1/2',reason:'stalemate'};
  if(this.insufficient())return {over:true,result:'1/2-1/2',reason:'insufficient material'};
  if(this.half>=100)return {over:true,result:'1/2-1/2',reason:'50-move rule'};
  if(this.repCount()>=3)return {over:true,result:'1/2-1/2',reason:'repetition'};
  return {over:false};
};
Pos.prototype.hasPieces=function(c){var b=this.b;for(var s=0;s<64;s++){var p=b[s];if(p&&(p>>3)===c){var t=p&7;if(t>1&&t<6)return true;}}return false;};
Pos.prototype.evaluate=function(){
  var b=this.b,s=0,phase=0,mat0=0,mat1=0,bw=0,bb=0,sq,p,t,c,idx,v;
  var pf0=[0,0,0,0,0,0,0,0],pf1=[0,0,0,0,0,0,0,0],wpRow=[9,9,9,9,9,9,9,9],bpRow=[-1,-1,-1,-1,-1,-1,-1,-1];
  var wMost=[-1,-1,-1,-1,-1,-1,-1,-1],bMost=[9,9,9,9,9,9,9,9];
  for(sq=0;sq<64;sq++){p=b[sq];if(!p)continue;t=p&7;c=p>>3;if(t===6)continue;
    idx=c?(sq^56):sq;v=VAL[t]+PST[t][idx];
    if(c){s-=v;mat1+=VAL[t];}else{s+=v;mat0+=VAL[t];}
    phase+=PHW[t];
    if(t===3){if(c)bb++;else bw++;}
    if(t===1){var f=sq&7,r=sq>>3;
      if(c){pf1[f]++;if(r<bMost[f])bMost[f]=r;if(r>bpRow[f])bpRow[f]=r;}
      else{pf0[f]++;if(r>wMost[f])wMost[f]=r;if(r<wpRow[f])wpRow[f]=r;}}}
  if(phase>24)phase=24;
  var wk=this.k[0],bk=this.k[1];
  s+=((KMG[wk]*phase+KEG[wk]*(24-phase))/24)|0;
  s-=((KMG[bk^56]*phase+KEG[bk^56]*(24-phase))/24)|0;
  if(bw>=2)s+=30;if(bb>=2)s-=30;
  var eg=(24-phase);
  for(var f2=0;f2<8;f2++){
    if(pf0[f2]>1)s-=12*(pf0[f2]-1);if(pf1[f2]>1)s+=12*(pf1[f2]-1);
    var iso0=pf0[f2]&&!(f2>0&&pf0[f2-1])&&!(f2<7&&pf0[f2+1]);if(iso0)s-=10;
    var iso1=pf1[f2]&&!(f2>0&&pf1[f2-1])&&!(f2<7&&pf1[f2+1]);if(iso1)s+=10;
    if(pf0[f2]){var r0=wpRow[f2],pass=true;
      for(var g=Math.max(0,f2-1);g<=Math.min(7,f2+1);g++)if(bpRow[g]>=0&&bMost[g]<r0)pass=false;
      if(pass)s+=((PASSED[r0]*(8+eg))/32)|0;}
    if(pf1[f2]){var r1=bpRow[f2],pass1=true;
      for(var g2=Math.max(0,f2-1);g2<=Math.min(7,f2+1);g2++)if(wMost[g2]>=0&&wMost[g2]>r1)pass1=false;
      if(pass1)s-=((PASSED[7-r1]*(8+eg))/32)|0;}}
  var diff=mat0-mat1;
  if((diff>=300||diff<=-300)&&phase<=12){
    var win=diff>0?0:1,lk=this.k[win^1],lr=lk>>3,lc=lk&7;
    var cd=Math.max(3-lr,lr-4)+Math.max(3-lc,lc-4);
    var kd=Math.abs((wk>>3)-(bk>>3))+Math.abs((wk&7)-(bk&7));
    var bonus=cd*12+(14-kd)*5;
    s+=win===0?bonus:-bonus;}
  s+=this.turn===0?10:-10;
  return this.turn===0?s:-s;
};

/* ---------------- search ---------------- */
var MATE=100000,INF=1000000;
var TTB=1<<19,TTM=TTB-1;
var ttK=new Int32Array(TTB),ttMv=new Int32Array(TTB),ttS=new Int32Array(TTB),ttD=new Int8Array(TTB),ttF=new Int8Array(TTB);
function think(pos,o){
  o=o||{};
  var t0=now(),tl=o.timeMs||1000,maxD=Math.min(o.maxDepth||64,64);
  var root=pos.legal(),us=pos.turn;
  if(!root.length){var chk=pos.inCheck();
    return {best:null,depth:0,pv:[],score:chk?-MATE:0,scoreW:chk?(us===0?-10000:10000):0,mateW:0,mate:0,term:chk?'mate':'stalemate'};}
  if(o.rand&&Math.random()<o.rand){var rm=root[(Math.random()*root.length)|0];
    return {best:pos.uci(rm),depth:0,pv:[pos.uci(rm)],score:0,scoreW:0,mateW:0,mate:0};}
  var nodes=0,stop=false;
  var killers=new Int32Array(140),hist=new Int32Array(4096),rootBest=0;
  function tick(){if((++nodes&1023)===0&&now()-t0>tl)stop=true;return stop;}
  function order(ms,ttm,ply){var n=ms.length,sc=new Int32Array(n),b=pos.b;
    for(var i=0;i<n;i++){var m=ms[i];if(m===ttm){sc[i]=1<<29;continue;}
      var fl=m>>15,f=m&63,t=(m>>6)&63,pr=(m>>12)&7;
      if(fl&1){var vv=(fl&2)?1:(b[t]&7);sc[i]=(1<<27)+vv*16-(b[f]&7)+(pr===5?1000:0);}
      else if(pr){sc[i]=(1<<26)+pr;}
      else if(killers[ply*2]===m)sc[i]=(1<<25)+2;
      else if(killers[ply*2+1]===m)sc[i]=(1<<25)+1;
      else sc[i]=hist[f*64+t];}
    return sc;}
  function pick(ms,sc,i){var bi=i;for(var j=i+1;j<ms.length;j++)if(sc[j]>sc[bi])bi=j;
    if(bi!==i){var t=ms[i];ms[i]=ms[bi];ms[bi]=t;t=sc[i];sc[i]=sc[bi];sc[bi]=t;}return ms[i];}
  function qs(alpha,beta,ply){
    if(tick())return 0;
    var stand=pos.evaluate();
    if(ply>=62)return stand;
    if(stand>=beta)return stand;
    if(stand>alpha)alpha=stand;
    var ms=pos.gen(true),sc=order(ms,0,0),us2=pos.turn;
    for(var i=0;i<ms.length;i++){var m=pick(ms,sc,i);
      pos.make(m);if(pos.attacked(pos.k[us2],us2^1)){pos.unmake();continue;}
      var v=-qs(-beta,-alpha,ply+1);pos.unmake();
      if(stop)return 0;
      if(v>alpha){alpha=v;if(v>=beta)return v;}}
    return alpha;}
  function nm(depth,alpha,beta,ply,allowNull){
    if(tick())return 0;
    if(ply>0&&(pos.half>=100||pos.isRep()))return 0;
    if(ply>=60)return pos.evaluate();
    var inChk=pos.inCheck();
    if(inChk)depth++;
    if(depth<=0)return qs(alpha,beta,ply);
    var idx=pos.h1&TTM,ttm=0;
    if(ttK[idx]===pos.h2&&ttF[idx]){ttm=ttMv[idx];
      if(ply>0&&ttD[idx]>=depth){var ts=ttS[idx];
        if(ts>MATE-500)ts-=ply;else if(ts<-MATE+500)ts+=ply;
        var fg=ttF[idx];
        if(fg===1)return ts;if(fg===2&&ts>=beta)return ts;if(fg===3&&ts<=alpha)return ts;}}
    if(allowNull&&!inChk&&depth>=3&&ply>0&&beta<MATE-500&&pos.hasPieces(pos.turn)&&pos.evaluate()>=beta){
      pos.makeNull();var nv=-nm(depth-3,-beta,-beta+1,ply+1,false);pos.unmakeNull();
      if(stop)return 0;if(nv>=beta)return beta;}
    var ms=pos.gen(false),sc=order(ms,ttm,ply),best=-INF,bestM=0,legal=0,a0=alpha,us2=pos.turn;
    for(var i=0;i<ms.length;i++){var m=pick(ms,sc,i);
      pos.make(m);if(pos.attacked(pos.k[us2],us2^1)){pos.unmake();continue;}
      legal++;var v;
      if(legal===1)v=-nm(depth-1,-beta,-alpha,ply+1,true);
      else{
        var red=0;
        if(depth>=3&&legal>4&&!inChk&&!(m>>15&1)&&!((m>>12)&7)&&!pos.inCheck())red=1;
        v=-nm(depth-1-red,-alpha-1,-alpha,ply+1,true);
        if(v>alpha&&(red||v<beta))v=-nm(depth-1,-beta,-alpha,ply+1,true);}
      pos.unmake();
      if(stop)return 0;
      if(v>best){best=v;bestM=m;if(ply===0)rootBest=m;
        if(v>alpha){alpha=v;
          if(alpha>=beta){
            if(!((m>>15)&1)){if(killers[ply*2]!==m){killers[ply*2+1]=killers[ply*2];killers[ply*2]=m;}
              var hi=(m&63)*64+((m>>6)&63);hist[hi]+=depth*depth;if(hist[hi]>(1<<24))for(var q=0;q<4096;q++)hist[q]>>=1;}
            break;}}}}
    if(!legal)return inChk?-MATE+ply:0;
    var st=best;if(st>MATE-500)st+=ply;else if(st<-MATE+500)st-=ply;
    ttK[idx]=pos.h2;ttMv[idx]=bestM;ttS[idx]=st;ttD[idx]=depth;ttF[idx]=best>=beta?2:(best>a0?1:3);
    return best;}
  function pvFrom(first,n){var pv=[pos.uci(first)],c=1;pos.make(first);
    for(var i=1;i<n;i++){var idx=pos.h1&TTM;if(ttK[idx]!==pos.h2||!ttF[idx])break;var m=ttMv[idx];if(!m)break;
      var lg=pos.legal();if(lg.indexOf(m)<0)break;pv.push(pos.uci(m));pos.make(m);c++;}
    while(c--)pos.unmake();return pv;}
  function pack(sc,best,d){
    var mate=0,cp=sc;
    if(sc>MATE-500){mate=Math.ceil((MATE-sc)/2);cp=10000-mate*10;}
    else if(sc<-MATE+500){mate=-Math.ceil((MATE+sc)/2);cp=-10000-mate*10;}
    var w=us===0?1:-1;
    return {best:pos.uci(best),score:sc,scoreW:cp*w,mate:mate,mateW:mate*w,depth:d,pv:pvFrom(best,Math.max(2,Math.min(d,12))),nodes:nodes};}
  var bestMove=root[0],bestScore=0,done=0,scored=null;
  for(var d=1;d<=maxD;d++){
    if(o.noise){var arr=[];
      for(var i=0;i<root.length;i++){pos.make(root[i]);var v=-nm(d-1,-INF,INF,1,true);pos.unmake();if(stop)break;arr.push([root[i],v]);}
      if(stop&&d>1)break;
      if(arr.length===root.length){scored=arr;arr.sort(function(a,b){return b[1]-a[1];});bestMove=arr[0][0];bestScore=arr[0][1];}
      else break;
    } else {
      rootBest=0;var vv=nm(d,-INF,INF,0,true);
      if(stop&&d>1)break;
      bestScore=vv;if(rootBest)bestMove=rootBest;
      if(stop)break;}
    done=d;
    if(o.onInfo)o.onInfo(pack(bestScore,bestMove,d));
    if(Math.abs(bestScore)>MATE-500&&d>=(MATE-Math.abs(bestScore))+1)break;
    if(now()-t0>tl*0.5)break;
    if(root.length===1&&d>=3&&!o.analysis)break;}
  if(o.noise&&scored){var bv=-INF;
    for(var k=0;k<scored.length;k++){var nv=scored[k][1]+(Math.random()*2-1)*o.noise;
      if(Math.abs(scored[k][1])>MATE-500)nv=scored[k][1];
      if(nv>bv){bv=nv;bestMove=scored[k][0];bestScore=scored[k][1];}}}
  return pack(bestScore,bestMove,done||1);
}
