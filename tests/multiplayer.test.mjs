import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,applyAction,publicState,settleState,GameError,legalLudo} from '../lib/room-engine.mjs';
import {createApp} from '../server.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Netzwerk-Brettspiele prüfen Zugrecht und Sieg',()=>{
 const s=createState('tictactoe',2);
 assert.throws(()=>applyAction(s,1,{type:'place',index:0}),/am Zug/);
 for(const[seat,index]of [[0,0],[1,3],[0,1],[1,4],[0,2]])applyAction(s,seat,{type:'place',index});
 assert.equal(s.winner,0);assert.throws(()=>applyAction(s,1,{type:'place',index:5}),/beendet/);
 const c=createState('connect',2);for(const[seat,column]of [[0,0],[1,1],[0,0],[1,1],[0,0],[1,1],[0,0]])applyAction(c,seat,{type:'drop',column});assert.equal(c.winner,0);
});
test('Mühle schützt geschlossene Mühlen und erlaubt Springen mit drei Steinen',()=>{
 const s=createState('mill',2);s.placed=[9,9];s.board[0]=0;s.board[1]=0;s.board[9]=0;s.board[3]=1;s.board[4]=1;s.board[5]=1;s.board[21]=1;
 applyAction(s,0,{type:'move',from:9,to:2});assert.equal(s.capture,true);
 assert.throws(()=>applyAction(s,0,{type:'capture',index:3}),/Mühlenschutz/);
 applyAction(s,0,{type:'capture',index:21});assert.equal(s.turn,1);
 s.turn=0;applyAction(s,0,{type:'move',from:0,to:23});assert.equal(s.board[23],0);
});
test('Laufspiel würfelt auf dem Server, schlägt und blockiert eigene Zielfelder',()=>{
 const s=createState('ludo',2);applyAction(s,0,{type:'roll'},{rng:()=>5});assert.equal(s.die,6);assert.equal(legalLudo(s,0,0),true);
 applyAction(s,0,{type:'move',piece:0});assert.equal(s.pieces[0][0],0);assert.equal(s.turn,0);
 applyAction(s,0,{type:'roll'},{rng:()=>5});assert.equal(legalLudo(s,0,1),false);
 s.pieces[1][0]=25;s.die=5;s.waiting=true;applyAction(s,0,{type:'move',piece:0});assert.equal(s.pieces[1][0],-1);
 s.turn=0;s.pieces[0]=[39,41,-1,-1];s.waiting=true;s.die=3;assert.equal(legalLudo(s,0,0),false);
});
test('Memory sendet verdeckte Karten nicht und wechselt erst nach der Sichtpause',()=>{
 const s=createState('memory',2);assert(publicState(s,0).board.every(v=>v===null));assert.equal('deck' in publicState(s,0),false);
 const first=0,second=s.deck.findIndex(v=>v!==s.deck[0]);applyAction(s,0,{type:'flip',index:first});applyAction(s,0,{type:'flip',index:second},{now:100});
 assert.equal(s.turn,0);assert.equal(settleState(s,1299),false);assert.equal(settleState(s,1300),true);assert.equal(s.turn,1);
});
test('Crazy Eights wahrt Karten-Geheimnisse und prüft Wunschfarben',()=>{
 const s=createState('crazy8',2),a=publicState(s,0),b=publicState(s,1),spectator=publicState(s,-1);
 assert.equal(a.hand.length,7);assert.equal(b.hand.length,7);assert.equal(spectator.hand.length,0);
 for(const data of [a,b,spectator])for(const key of ['hands','deck','discard'])assert.equal(key in data,false);
 s.hands[0]=[{rank:'8',suit:'♠'},{rank:'A',suit:'♥'}];applyAction(s,0,{type:'card',index:0});assert(s.wish);
 assert.throws(()=>applyAction(s,0,{type:'wish',suit:'invalid'}),GameError);applyAction(s,0,{type:'wish',suit:'♥'});assert.equal(s.suit,'♥');assert.equal(s.turn,1);
});
test('Würfelbecher hält Würfel und begrenzt Würfe; Zusammenarbeit begrenzt Eingaben',()=>{
 const s=createState('dice',3);applyAction(s,0,{type:'roll'},{rng:()=>3});applyAction(s,0,{type:'hold',index:0});applyAction(s,0,{type:'roll'},{rng:()=>0});assert.equal(s.dice[0],4);assert.equal(s.dice[1],1);applyAction(s,0,{type:'roll'});assert.throws(()=>applyAction(s,0,{type:'roll'}),/Drei/);applyAction(s,0,{type:'next'});assert.equal(s.turn,1);
 const d=createState('draw',2);applyAction(d,1,{type:'stroke',points:[[0,.5],[1,.6]],color:'#336633',width:5});assert.equal(d.strokes.length,1);assert.throws(()=>applyAction(d,1,{type:'clear'}),/Gastgeber/);assert.throws(()=>applyAction(d,0,{type:'stroke',points:[[NaN,0]],color:'#fff000',width:5}),/Zeichenwerte/);
 const audio=createState('sound',2);applyAction(audio,1,{type:'tone',note:7});assert.equal(audio.tones[0].id,1);assert.throws(()=>applyAction(audio,0,{type:'tone',note:8}),/Ton/);
});
test('Handbücher für alle 51 Einträge; alle Kategorie-Grafiken vorhanden',async()=>{
 const ctx=vm.createContext({});vm.runInContext(await readFile('dist/catalog.js','utf8'),ctx);vm.runInContext(await readFile('dist/handbooks.js','utf8'),ctx);
 const missing=vm.runInContext('GAMES.filter(g=>!HANDBOOKS[g.id]||HANDBOOKS[g.id].length<3).map(g=>g.id)',ctx);assert.equal(missing.length,0);
 for(const cat of vm.runInContext('CATEGORIES.slice(1).map(c=>c.id)',ctx))assert((await readFile('dist/assets/category-'+cat+'.svg','utf8')).includes('<svg'));
});
test('Zwei getrennte HTTP-Clients: Lobby, Einladung, Versionsschutz, Sieg und keine fremden Karten',async(t)=>{
 const {server}=createApp();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
 const api=async(path,{token,body}={})=>{const res=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};};
 const a=(await api('/api/rooms',{body:{game:'tictactoe',seats:2,name:'Anna'}})).data;
 assert.equal((await api('/api/rooms/'+a.id+'/action',{token:a.token,body:{version:0,action:{type:'start'}}})).status,400);
 const b=(await api('/api/rooms/'+a.id+'/join',{body:{name:'Ben'}})).data;assert.equal(b.you,1);assert.equal(b.players[0].token,undefined);
 let state=(await api('/api/rooms/'+a.id+'/action',{token:a.token,body:{version:b.version,action:{type:'start'}}})).data;
 assert.equal((await api('/api/rooms/'+a.id+'/action',{token:b.token,body:{version:state.version,action:{type:'place',index:0}}})).status,403);
 assert.equal((await api('/api/rooms/'+a.id+'/action',{token:a.token,body:{version:-1,action:{type:'place',index:0}}})).status,409);
 for(const[token,index]of [[a.token,0],[b.token,3],[a.token,1],[b.token,4],[a.token,2]]){const response=await api('/api/rooms/'+a.id+'/action',{token,body:{version:state.version,action:{type:'place',index}}});assert.equal(response.status,200);state=response.data;}
 assert.equal((await api('/api/rooms/'+a.id,{token:b.token})).data.state.winner,0);
 const cardA=(await api('/api/rooms',{body:{game:'crazy8',seats:2,name:'A'}})).data;const cardB=(await api('/api/rooms/'+cardA.id+'/join',{body:{name:'B'}})).data;
 await api('/api/rooms/'+cardA.id+'/action',{token:cardA.token,body:{version:cardB.version,action:{type:'start'}}});
 const own=(await api('/api/rooms/'+cardA.id,{token:cardB.token})).data.state;assert.equal(own.hand.length,7);assert.equal(own.hands,undefined);assert.equal(own.deck,undefined);
 assert.equal((await api('/api/rooms/'+cardA.id)).data.state.hand.length,0);
 const bad=await fetch(base+'/api/rooms',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(bad.status,403);
 const leak=await fetch(base+'/%2eopenai/hosting.json');assert.equal(leak.status,404);
});
