import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { ROOM_GAMES,GameError,createState,applyAction,publicState,settleState } from './lib/room-engine.mjs';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const TTL=2*60*60*1000;
export function createApp({allowedOrigins=(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)}={}){
  const rooms=new Map(),limits=new Map();
  const clean=()=>{const now=Date.now();for(const[id,r]of rooms)if(now-r.updated>TTL)rooms.delete(id);for(const[ip,l]of limits)if(now-l.start>60000)limits.delete(ip);};
  const timer=setInterval(clean,60000);timer.unref();
  const token=()=>randomBytes(24).toString('base64url');
  const username=n=>typeof n==='string'?n.trim().slice(0,24)||'Mitspieler':'Mitspieler';
  const view=(r,seat)=>({id:r.id,game:r.game,seats:r.seats,players:r.players.map(p=>p?{name:p.name,online:Date.now()-p.seen<12000}:null),phase:r.phase,version:r.version,you:seat,state:r.phase==='playing'?publicState(r.state,seat):null});
  const server=http.createServer(async(req,res)=>{
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    try{
      const origin=req.headers.origin;
      const localOrigins=[`http://${req.headers.host}`,`https://${req.headers.host}`];
      const allowed=!origin||localOrigins.includes(origin)||allowedOrigins.includes(origin);
      if(origin&&allowed){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
      if(req.method==='OPTIONS'){if(!allowed)throw new GameError('Diese Website ist nicht für den Server freigegeben.',403);res.writeHead(204);res.end();return;}
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')){
        if(!allowed)throw new GameError('Diese Website ist nicht für den Server freigegeben.',403);
        const ip=req.socket.remoteAddress,now=Date.now();let rate=limits.get(ip);
        if(!rate||now-rate.start>60000){rate={start:now,n:0};limits.set(ip,rate);}
        if(++rate.n>1200)throw new GameError('Zu viele Anfragen. Bitte kurz warten.',429);
        if(url.pathname==='/api/health'&&req.method==='GET'){json(200,{ok:true,games:ROOM_GAMES,roomTTLMinutes:120,networkAddresses:Object.entries(os.networkInterfaces()).filter(([name])=>!/(nord|vpn|virtual|vEthernet|WSL)/i.test(name)).flatMap(([,entries])=>(entries||[]).filter(n=>n.family==='IPv4'&&!n.internal&&!n.address.startsWith('169.254.')).map(n=>`http://${n.address}:${server.address()?.port}`))});return;}
        let body={};
        if(req.method==='POST'){
          if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new GameError('JSON erforderlich.',415);
          let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>16384)throw new GameError('Anfrage ist zu groß.',413);chunks.push(chunk);}
          try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new GameError('Ungültige JSON-Anfrage.');}
          if(!body||Array.isArray(body)||typeof body!=='object')throw new GameError('Ungültige Anfrage.');
        }
        if(url.pathname==='/api/rooms'&&req.method==='POST'){
          clean();if(rooms.size>=500)throw new GameError('Der Server ist voll.',503);
          const state=createState(body.game,body.seats);let id;do{id=randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(id));
          const secret=token(),players=Array(body.seats).fill(null);players[0]={name:username(body.name),token:secret,seen:now};
          const room={id,game:body.game,seats:body.seats,players,phase:'lobby',state,version:0,updated:now};rooms.set(id,room);json(201,{token:secret,...view(room,0)});return;
        }
        const match=url.pathname.match(/^\/api\/rooms\/([A-F0-9]{8})(?:\/(join|action))?$/);
        if(!match)throw new GameError('Nicht gefunden.',404);
        const r=rooms.get(match[1]);if(!r||now-r.updated>TTL)throw new GameError('Spielraum abgelaufen oder nicht gefunden.',404);
        if(settleState(r.state,now))r.version++;
        const bearer=String(req.headers.authorization||'').replace(/^Bearer /,'');
        const seat=bearer?r.players.findIndex(p=>p&&p.token===bearer):-1;
        if(bearer&&seat<0)throw new GameError('Dein Platz ist nicht mehr gültig.',401);
        if(req.method==='GET'&&!match[2]){if(seat>=0){r.players[seat].seen=now;r.updated=now;}json(200,view(r,seat));return;}
        if(req.method==='POST'&&match[2]==='join'){
          if(seat>=0){json(200,view(r,seat));return;}
          if(r.phase!=='lobby')throw new GameError('Diese Runde läuft bereits.');
          const free=r.players.findIndex(p=>!p);if(free<0)throw new GameError('Alle Plätze sind vergeben.');
          const secret=token();r.players[free]={name:username(body.name),token:secret,seen:now};r.version++;r.updated=now;json(200,{token:secret,...view(r,free)});return;
        }
        if(req.method==='POST'&&match[2]==='action'){
          if(seat<0)throw new GameError('Bitte zuerst beitreten.',401);
          if(!Number.isInteger(body.version)||body.version!==r.version)throw new GameError('Der Spielstand hat sich geändert. Bitte erneut versuchen.',409);
          const a=body.action;if(!a||typeof a!=='object')throw new GameError('Ungültiger Zug.');
          if(a.type==='start'||a.type==='restart'||a.type==='lobby'){
            if(seat!==0)throw new GameError('Nur die Gastgeberperson darf starten.',403);
            if(a.type!=='lobby'&&r.players.some(p=>!p))throw new GameError('Warte, bis alle Plätze besetzt sind.');
            r.state=createState(r.game,r.seats);r.phase=a.type==='lobby'?'lobby':'playing';
          }else if(a.type==='kick'){
            if(seat!==0||r.phase!=='lobby'||!Number.isInteger(a.seat)||a.seat<=0||a.seat>=r.seats)throw new GameError('Dieser Platz kann nicht freigegeben werden.',403);
            r.players[a.seat]=null;
          }else{
            if(r.phase!=='playing')throw new GameError('Die Runde wurde noch nicht gestartet.');
            applyAction(r.state,seat,a);
          }
          r.version++;r.updated=now;r.players[seat].seen=now;json(200,view(r,seat));return;
        }
        throw new GameError('Methode nicht unterstützt.',405);
      }
      if(!['GET','HEAD'].includes(req.method)){json(405,{error:'Methode nicht unterstützt.'});return;}
      const decoded=decodeURIComponent(url.pathname),filename=path.resolve(ROOT,'.'+(decoded==='/'?'/index.html':decoded));
      if(!filename.startsWith(ROOT+path.sep)||decoded.split('/').some(p=>p.startsWith('.')))throw new GameError('Nicht gefunden.',404);
      const ext=path.extname(filename),mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'}[ext];
      if(!mime)throw new GameError('Nicht gefunden.',404);
      let data;try{data=await readFile(filename);}catch{throw new GameError('Nicht gefunden.',404);}
      res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(req.method==='HEAD'?undefined:data);
    }catch(error){json(error instanceof GameError?error.status:500,{error:error instanceof GameError?error.message:'Serverfehler. Bitte erneut versuchen.'});}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.on('close',()=>clearInterval(timer));
  return {server,rooms};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||5173),host=process.env.HOST||'0.0.0.0';
  const {server}=createApp();server.listen(port,host,()=>{
    console.log(`Spielraum: http://127.0.0.1:${port}`);
    for(const values of Object.values(os.networkInterfaces()))for(const n of values||[])if(n.family==='IPv4'&&!n.internal)console.log(`Netzwerk: http://${n.address}:${port}`);
    console.log('Räume bleiben bis zum Server-Neustart oder 2 Stunden ohne Aktivität erhalten.');
  });
}
