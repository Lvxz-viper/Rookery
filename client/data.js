/* ---------- static data ---------- */
var OPEN_RAW=[
['A00',"King's Fianchetto Opening",'g3'],['A01','Nimzo-Larsen Attack','b3'],['A02',"Bird's Opening",'f4'],['A04','Réti Opening','Nf3'],
['A10','English Opening','c4'],['A20','English Opening: Reversed Sicilian','c4 e5'],['A30','English Opening: Symmetrical','c4 c5'],
['A40',"Queen's Pawn Opening",'d4'],['A45','Indian Defense','d4 Nf6'],['A80','Dutch Defense','d4 f5'],['A56','Benoni Defense','d4 Nf6 c4 c5'],
['A57','Benko Gambit','d4 Nf6 c4 c5 d5 b5'],['A46','London System','d4 Nf6 Nf3 e6 Bf4'],['D02','London System','d4 d5 Bf4'],['A48','London System','d4 Nf6 Bf4'],
['B00',"King's Pawn Opening",'e4'],['C20',"King's Pawn Game",'e4 e5'],['C20','Wayward Queen Attack','e4 e5 Qh5'],['C44','Open Game','e4 e5 Nf3 Nc6'],
['C60','Ruy Lopez','e4 e5 Nf3 Nc6 Bb5'],['C70','Ruy Lopez: Morphy Defense','e4 e5 Nf3 Nc6 Bb5 a6'],['C65','Ruy Lopez: Berlin Defense','e4 e5 Nf3 Nc6 Bb5 Nf6'],
['C68','Ruy Lopez: Exchange Variation','e4 e5 Nf3 Nc6 Bb5 a6 Bxc6'],['C84','Ruy Lopez: Closed','e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'],
['C50','Italian Game','e4 e5 Nf3 Nc6 Bc4'],['C53','Giuoco Piano','e4 e5 Nf3 Nc6 Bc4 Bc5 c3'],['C50','Italian Game: Giuoco Pianissimo','e4 e5 Nf3 Nc6 Bc4 Bc5 d3'],
['C51','Evans Gambit','e4 e5 Nf3 Nc6 Bc4 Bc5 b4'],['C55','Two Knights Defense','e4 e5 Nf3 Nc6 Bc4 Nf6'],['C57','Fried Liver Attack','e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7'],
['C57','Two Knights Defense: Traxler','e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5'],['C45','Scotch Game','e4 e5 Nf3 Nc6 d4'],['C47','Four Knights Game','e4 e5 Nf3 Nc6 Nc3 Nf6'],
['C42',"Petrov's Defense",'e4 e5 Nf3 Nf6'],['C41','Philidor Defense','e4 e5 Nf3 d6'],['C40','Latvian Gambit','e4 e5 Nf3 f5'],['C30',"King's Gambit",'e4 e5 f4'],
['C33',"King's Gambit Accepted",'e4 e5 f4 exf4'],['C25','Vienna Game','e4 e5 Nc3'],['C23',"Bishop's Opening",'e4 e5 Bc4'],['C21','Center Game','e4 e5 d4 exd4'],
['C21','Danish Gambit','e4 e5 d4 exd4 c3'],['B20','Sicilian Defense','e4 c5'],['B54','Sicilian Defense: Open','e4 c5 Nf3 d6 d4 cxd4 Nxd4'],
['B90','Sicilian Defense: Najdorf','e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'],['B70','Sicilian Defense: Dragon','e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6'],
['B33','Sicilian Defense: Sveshnikov','e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5'],['B40','Sicilian Defense: French Variation','e4 c5 Nf3 e6'],
['B22','Sicilian Defense: Alapin','e4 c5 c3'],['B23','Sicilian Defense: Closed','e4 c5 Nc3'],['B21','Sicilian Defense: Smith-Morra Gambit','e4 c5 d4 cxd4 c3'],
['C00','French Defense','e4 e6'],['C02','French Defense: Advance','e4 e6 d4 d5 e5'],['C01','French Defense: Exchange','e4 e6 d4 d5 exd5'],
['C03','French Defense: Tarrasch','e4 e6 d4 d5 Nd2'],['C10','French Defense: Paulsen','e4 e6 d4 d5 Nc3'],['B10','Caro-Kann Defense','e4 c6'],
['B12','Caro-Kann Defense: Advance','e4 c6 d4 d5 e5'],['B13','Caro-Kann Defense: Exchange','e4 c6 d4 d5 exd5'],['B01','Scandinavian Defense','e4 d5'],
['B02',"Alekhine's Defense",'e4 Nf6'],['B07','Pirc Defense','e4 d6'],['B06','Modern Defense','e4 g6'],['B00','Owen Defense','e4 b6'],
['D00',"Queen's Pawn Game",'d4 d5'],['D06',"Queen's Gambit",'d4 d5 c4'],['D20',"Queen's Gambit Accepted",'d4 d5 c4 dxc4'],['D30',"Queen's Gambit Declined",'d4 d5 c4 e6'],
['D10','Slav Defense','d4 d5 c4 c6'],['D43','Semi-Slav Defense','d4 d5 c4 c6 Nf3 Nf6 Nc3 e6'],['D08','Albin Countergambit','d4 d5 c4 e5'],
['E60',"King's Indian Defense",'d4 Nf6 c4 g6 Nc3 Bg7'],['D80','Grünfeld Defense','d4 Nf6 c4 g6 Nc3 d5'],['E20','Nimzo-Indian Defense','d4 Nf6 c4 e6 Nc3 Bb4'],
['E12',"Queen's Indian Defense",'d4 Nf6 c4 e6 Nf3 b6'],['E01','Catalan Opening','d4 Nf6 c4 e6 g3'],['A51','Budapest Gambit','d4 Nf6 c4 e5'],
['D35',"Queen's Gambit Declined: Exchange",'d4 d5 c4 e6 Nc3 Nf6 cxd5']
];
var BOTS=[
 {id:'pip',name:'Pip',rating:250,av:{p:'p',c:5},title:'Beginner',bio:'A wind-up robot who learned the rules this morning. Hangs pieces, loves checks.',eng:{kind:'local',p:{maxDepth:1,noise:340,rand:.28,timeMs:500}},book:.2,
  lines:{start:'Beep. I know how the horse moves now. I think.',cap:'Ooh, a shiny piece for my collection.',lost:'Hey, I needed that one.',check:'Is that a check? I love checks.',win:'Wait, did I win? Beep beep.',lose:'You win. Can we play again?',draw:'A tie. Everybody gets a gear.',nodraw:'No draws, I am having too much fun.'}},
 {id:'marlowe',name:'Marlowe',rating:600,av:{p:'r',c:3},title:'Casual player',bio:'Retired postman. Forty years of deliveries and not one checkmate. Yet.',eng:{kind:'local',p:{maxDepth:2,noise:170,rand:.07,timeMs:700}},book:.5,
  lines:{start:'Afternoon. Let us see what the post brings today.',cap:'Signed, sealed, captured.',lost:'Ah. I seem to have misplaced that one.',check:'Special delivery for your king.',win:'Return to sender, I am afraid.',lose:'Well played. Postage paid in full.',draw:'Neither of us gets the mail today.',nodraw:'The route is not finished yet.'}},
 {id:'juno',name:'Juno',rating:1000,av:{p:'n',c:4},title:'Improving junior',bio:'Twelve years old, fearless, and has tried every gambit she has heard of.',eng:{kind:'local',p:{maxDepth:2,noise:55,rand:.02,timeMs:800}},book:.85,
  lines:{start:'My coach says I hang pieces. My coach is wrong. Mostly.',cap:'Yoink.',lost:'Okay, that was a test. You passed.',check:'Check. Run, little king.',win:'Good game. Tell my coach.',lose:'Rematch. Right now. Please.',draw:'A draw? Fine.',nodraw:'Nope. I can still win this.'}},
 {id:'odile',name:'Odile',rating:1400,av:{p:'b',c:2},title:'Café regular',bio:'Plays in the corner café for coffee money. Fast hands, sharp eyes.',eng:{kind:'sf',elo:1400,ms:700,fb:{maxDepth:3,noise:22,timeMs:1000}},book:1,
  lines:{start:'Espresso is hot and the clock is ticking. Shall we?',cap:'Merci for the gift.',lost:'That one costs you a coffee later.',check:'Your king looks nervous.',win:'Coffee is on you today.',lose:'Bravo. I owe you an espresso.',draw:'Split the bill, then.',nodraw:'Non. I like my position.'}},
 {id:'vasco',name:'Vasco',rating:1800,av:{p:'q',c:0},title:'Club champion',bio:'Club champion three years running. Loves a slow positional squeeze.',eng:{kind:'sf',elo:1850,ms:900,fb:{maxDepth:5,noise:0,timeMs:1100}},book:1,
  lines:{start:'Patience. Chess is won in the quiet moves.',cap:'Material is material.',lost:'Interesting. I did not expect that.',check:'Check.',win:'A long squeeze, but it worked.',lose:'Impressive. You earned that one.',draw:'A fair result.',nodraw:'There is still play here.'}},
 {id:'sable',name:'Sable',rating:2200,av:{p:'k',c:7},title:'Master',bio:'Says very little. Calculates everything. Bring your best game.',eng:{kind:'sf',elo:2300,ms:1100,fb:{maxDepth:40,noise:0,timeMs:2400}},book:1,
  lines:{start:'Begin.',cap:'Noted.',lost:'Accepted.',check:'Check.',win:'As calculated.',lose:'Well calculated. Rare.',draw:'Equal.',nodraw:'Declined.'}},
 {id:'oracle',name:'Oracle',rating:3000,av:{p:'k',c:1},title:'Full-strength Stockfish',bio:'The house engine at full strength. It does not get tired and it does not blunder.',eng:{kind:'sf',elo:0,ms:1500,fb:{maxDepth:40,noise:0,timeMs:3000}},book:.6,
  lines:{start:'Ready.',cap:'Material gained.',lost:'Material returned.',check:'Check.',win:'Checkmate.',lose:'Remarkable. Well played.',draw:'Drawn.',nodraw:'Declined.'}}
];
var TCS=[['1+0','Bullet'],['2+1','Bullet'],['3+0','Blitz'],['3+2','Blitz'],['5+0','Blitz'],['5+3','Blitz'],['10+0','Rapid'],['10+5','Rapid'],['15+10','Rapid'],['30+0','Classical']];
function tcParse(k){if(!k||k==='none')return {key:'none',base:0,inc:0,label:'No clock',cat:'Casual'};var a=k.split('+').map(Number),t=TCS.find(function(x){return x[0]===k;});return {key:k,base:a[0]*60000,inc:a[1]*1000,label:a[0]+' + '+a[1],cat:t?t[1]:'Rapid'};}
function tcCat(k){if(!k||k==='none')return 'rapid';var a=k.split('+').map(Number),e=a[0]*60+a[1]*40;return e<180?'bullet':e<480?'blitz':'rapid';}
var TINTS=['#5f7c66','#56718b','#8b4c45','#9a7b3f','#6c577e','#3f7b78','#776c60','#3e4b5d'];
var BOARDS={walnut:{n:'Walnut',l:'#e7d6b8',d:'#a57d58'},sage:{n:'Sage',l:'#e4e5d6',d:'#83977a'},slate:{n:'Slate',l:'#dfe4e6',d:'#6f8796'},rosewood:{n:'Rosewood',l:'#ecd9cc',d:'#a76a5e'},graphite:{n:'Graphite',l:'#cbccc6',d:'#6a6f6b'},tournament:{n:'Tournament',l:'#eeeed2',d:'#769656'}};
var SET_NAMES={staunty:'Staunty',papercut:'Papercut',gioco:'Gioco',tatiana:'Tatiana',maestro:'Maestro',cardinal:'Cardinal',chessnut:'Chessnut',mpchess:'Modern',merida:'Merida',royal:'Royal',cburnett:'Classic'};
var CLS={brilliant:{l:'Brilliant',g:'!!',c:'#26a8b8'},great:{l:'Great',g:'!',c:'#5b8bd0'},best:{l:'Best',g:'★',c:'#69a84f'},excellent:{l:'Excellent',g:'✓',c:'#86b85c'},good:{l:'Good',g:'•',c:'#7d9b8a'},book:{l:'Book',g:'≡',c:'#a88b62'},inaccuracy:{l:'Inaccuracy',g:'?!',c:'#e0b43a'},mistake:{l:'Mistake',g:'?',c:'#e5863a'},miss:{l:'Miss',g:'✕',c:'#d86a5b'},blunder:{l:'Blunder',g:'??',c:'#d2463a'}};
var CLS_ORDER=['brilliant','great','best','excellent','good','book','inaccuracy','mistake','miss','blunder'];
