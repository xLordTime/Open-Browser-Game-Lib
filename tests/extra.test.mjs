import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/vendor/chess.mjs';
import {createApp} from '../server.mjs';
import {createState,applyAction,publicState} from '../lib/room-engine.mjs';
import {isMeld,initialMeldPlan,createRummy,rummyAction,rummyBot,createProperty,propertyAction,propertyBot,ownsGroup,propertyWealth,chooseChessMove} from '../dist/extra-rules.mjs';
const c=(id,rank,suit='♥')=>({id,rank,suit});
test('Schach: Zugrecht, Matt, Rochade, en passant und Umwandlung',()=>{
  const s=createState('chess',2);
  assert.throws(()=>applyAction(s,1,{type:'move',from:'e7',to:'e5'}));
  assert.throws(()=>applyAction(s,0,{type:'move',from:'e2',to:'e5'}));
  for(const[from,to]of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']])applyAction(s,s.turn,{type:'move',from,to});
  assert.equal(s.winner,1);assert.equal(s.check,true);
  const castle=new Chess();for(const m of ['e4','e5','Nf3','Nc6','Bc4','Nf6','O-O'])castle.move(m);
  assert.equal(castle.get('g1').type,'k');assert.equal(castle.get('f1').type,'r');
  const ep=new Chess();for(const m of ['e4','a6','e5','d5','exd6'])ep.move(m);assert.equal(ep.get('d5'),undefined);assert.equal(ep.get('d6').type,'p');
  const promotion=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');promotion.move({from:'a7',to:'a8',promotion:'n'});assert.equal(promotion.get('a8').type,'n');
});
test('Schach-Bots: drei legale Stärken, Mittel und Schwer finden einzügiges Matt',()=>{
  const chess=new Chess('7k/5K2/6Q1/8/8/8/8/8 w - - 0 1');const before=chess.fen();
  for(const level of ['easy','medium','hard']){const m=chooseChessMove(chess,level);assert.equal(chess.fen(),before);const copy=new Chess(before);copy.move(m);if(level!=='easy')assert.equal(copy.isCheckmate(),true)}
});
test('Memory: alle Paarzahlen, verdeckte Daten und Ende bei variabler Größe',()=>{
  for(const pairs of [4,6,8,12,16,24]){const s=createState('memory',1,()=>0,{pairs});assert.equal(s.deck.length,pairs*2);assert.equal(new Set(s.deck).size,pairs);assert.equal(publicState(s,0).board.every(v=>v===null),true);for(let value=0;value<pairs;value++){const indices=s.deck.flatMap((v,i)=>v===value?[i]:[]);for(const index of indices)applyAction(s,0,{type:'flip',index})}assert.equal(s.winner,0);assert.equal(s.points[0],pairs)}
  assert.throws(()=>createState('memory',2,()=>0,{pairs:999}));
});
test('Rommé: Reihen, gleiche Werte, Ass niedrig und Erstauslage mit mehreren Gruppen',()=>{
  assert.equal(isMeld([c(1,1),c(2,2),c(3,3)]),true);
  assert.equal(isMeld([c(1,12),c(2,13),c(3,1)]),false);
  assert.equal(isMeld([c(1,4,'♥'),c(2,4,'♠'),c(3,4,'♣')]),true);
  assert.equal(isMeld([c(1,4),c(2,4),c(3,4,'♣')]),false);
  const s=createRummy(6);s.hands[0]=[c(1,3,'♥'),c(2,3,'♠'),c(3,3,'♣'),c(4,7,'♥'),c(5,7,'♠'),c(6,7,'♣'),c(7,11)];s.drawn=true;
  assert.throws(()=>rummyAction(s,0,{type:'meld',groups:[[1,2,3]]}),/30/);assert.equal(s.hands[0].length,7);
  assert.equal(initialMeldPlan(s.hands[0]).length,2);
  rummyAction(s,0,{type:'meld',groups:[[1,2,3],[4,5,6]]});assert.equal(s.opened[0],true);assert.equal(s.hands[0].length,1);
  rummyAction(s,0,{type:'discard',id:7});assert.equal(s.winner,0);
});
test('Rommé: Bots legal bis sechs Plätze, Auslegen, Anlegen und Stapel-Recycling',()=>{
  for(const level of ['easy','medium','hard']){const s=createRummy(6);for(let n=0;n<35&&s.winner===null;n++)rummyBot(s,s.turn,level);const all=[...s.deck,...s.hands.flat(),...s.discard,...s.melds.flat()];assert.equal(all.length,104);assert.equal(new Set(all.map(c=>c.id)).size,104)}
  const s=createRummy(2);s.melds=[[c(101,4),c(102,5),c(103,6)]];s.hands[0]=[c(1,7),c(2,9)];s.opened[0]=true;s.drawn=true;rummyAction(s,0,{type:'extend',group:0,id:1});assert.equal(s.melds[0].length,4);assert.equal(s.hands[0].length,1);
  const t=createRummy(2);t.deck=[];t.discard=[c(200,2),c(201,3)];rummyAction(t,0,{type:'draw'});assert.equal(t.discard.at(-1).id,201);assert.equal(t.hands[0].at(-1).id,200);
});
test('Grundstücksspiel: Startgeld, Kauf, Gruppen, Miete und Häuser',()=>{
  const s=createProperty(6);s.players[0].position=19;propertyAction(s,0,{type:'roll'},()=>0);assert.equal(s.players[0].position,1);assert.equal(s.players[0].cash,1700);
  propertyAction(s,0,{type:'buy'});assert.equal(s.owners[1],0);assert.throws(()=>propertyAction(s,0,{type:'buy'}));
  s.owners[2]=0;s.owners[4]=0;assert.equal(ownsGroup(s,0,1),true);propertyAction(s,0,{type:'build',index:1});assert.equal(s.houses[1],1);
  propertyAction(s,0,{type:'end'});s.players[1].position=19;const before=s.players[0].cash;propertyAction(s,1,{type:'roll'},()=>0);assert.equal(s.players[0].cash,before+60);assert.equal(s.players[1].cash,1640);assert.ok(propertyWealth(s,0)>s.players[0].cash);
});
test('Grundstücksspiel: Auszeit, Zahlungsunfähigkeit und Bots beenden Züge',()=>{
  const s=createProperty(2);s.players[0].position=8;propertyAction(s,0,{type:'roll'},()=>0);assert.equal(s.players[0].position,5);assert.equal(s.players[0].jail,1);propertyAction(s,0,{type:'end'});propertyAction(s,1,{type:'roll'},()=>0);propertyAction(s,1,{type:'end'});propertyAction(s,0,{type:'roll'},()=>0);assert.equal(s.players[0].position,5);assert.equal(s.players[0].jail,0);
  const t=createProperty(2);t.players[0].cash=1;t.players[0].position=1;propertyAction(t,0,{type:'roll'},()=>0);assert.equal(t.players[0].out,true);assert.equal(t.winner,1);
  for(const level of ['easy','medium','hard']){const game=createProperty(6);for(let i=0;i<30&&game.winner===null;i++){const turn=game.turn;propertyBot(game,turn,level);assert.notEqual(game.turn,turn);assert.equal(game.phase,'roll')}assert.ok(game.players.every(p=>p.cash>=0))}
});
test('Netzwerk: Schach-Züge synchronisieren; Memory-Paarzahl bleibt beim Neustart',async()=>{
  const {server}=createApp();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  const send=async(path,body,token)=>{const res=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const data=await res.json();assert.ok(res.ok,JSON.stringify(data));return data};
  try{
    const host=await send('/api/rooms',{game:'chess',seats:2,name:'Weiß'});const guest=await send('/api/rooms/'+host.id+'/join',{name:'Schwarz'});
    let room=await send('/api/rooms/'+host.id+'/action',{version:guest.version,action:{type:'start'}},host.token);
    room=await send('/api/rooms/'+host.id+'/action',{version:room.version,action:{type:'move',from:'e2',to:'e4'}},host.token);
    assert.equal(room.state.history[0],'e4');assert.equal(room.state.turn,1);
    const peer=await fetch(origin+'/api/rooms/'+host.id,{headers:{Authorization:'Bearer '+guest.token}}).then(r=>r.json());assert.equal(peer.state.fen,room.state.fen);
    room=await send('/api/rooms/'+host.id+'/action',{version:peer.version,action:{type:'move',from:'e7',to:'e5'}},guest.token);assert.equal(room.state.history.length,2);
    const memory=await send('/api/rooms',{game:'memory',seats:2,name:'A',options:{pairs:24}});const joined=await send('/api/rooms/'+memory.id+'/join',{name:'B'});
    const started=await send('/api/rooms/'+memory.id+'/action',{version:joined.version,action:{type:'start'}},memory.token);assert.equal(started.state.board.length,48);assert.equal(started.state.pairs,24);
    const reset=await send('/api/rooms/'+memory.id+'/action',{version:started.version,action:{type:'restart'}},memory.token);assert.equal(reset.state.board.length,48);
    const module=await fetch(origin+'/games-extra.mjs');assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
