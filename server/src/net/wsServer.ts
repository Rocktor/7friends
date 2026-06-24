import { createServer as createHttp, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { WebSocketServer, type WebSocket } from 'ws';
import { AuthService } from '../auth/auth';
import { Room } from '../room/room';
import { runStrongAI as runAITurns } from '../ai/search';
import type { DB } from '../persistence/db';

interface Client {
  ws: WebSocket;
  userId: number;
  seat: number;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => resolve(b));
  });
}

function json(res: ServerResponse, code: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(s) });
  res.end(s);
}

/** 创建对局服务器：HTTP(注册/登录 + 静态客户端) + WS(实时对局)。db 注入便于测试。 */
export function createGameServer(db: DB, clientHtmlPath?: string) {
  const auth = new AuthService(db);
  const room = new Room();
  const clients = new Set<Client>();
  let seedCounter = 1000;

  const http = createHttp(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/api/register') {
        const { username, password } = JSON.parse((await readBody(req)) || '{}');
        const r = auth.register(String(username ?? ''), String(password ?? ''));
        return json(res, r.ok ? 200 : 400, r);
      }
      if (req.method === 'POST' && req.url === '/api/login') {
        const { username, password } = JSON.parse((await readBody(req)) || '{}');
        const r = auth.login(String(username ?? ''), String(password ?? ''));
        return json(res, r.ok ? 200 : 401, r);
      }
      if (req.method === 'GET' && clientHtmlPath && (req.url === '/' || req.url === '/index.html')) {
        const html = readFileSync(clientHtmlPath);
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(html);
      }
      json(res, 404, { ok: false, error: 'not found' });
    } catch {
      json(res, 400, { ok: false, error: 'bad request' });
    }
  });

  const wss = new WebSocketServer({ server: http, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const token = new URL(req.url ?? '', 'http://x').searchParams.get('token') ?? '';
    const userId = auth.verify(token);
    if (userId === null) return ws.close(4001, 'unauthorized');
    // 重连：原座（掉线交了 AI）交还真人；否则入新座
    let seat: number;
    const back = room.reclaim(userId);
    if (back.ok) {
      seat = back.seat;
    } else {
      const j = room.join(userId, auth.usernameOf(userId) ?? '玩家');
      if (!j.ok) return ws.close(4002, 'table full');
      seat = j.seat;
    }
    const client: Client = { ws, userId, seat };
    clients.add(client);
    send(ws, { type: back.ok ? 'reconnected' : 'joined', seat });
    broadcast();

    ws.on('message', (data) => {
      let msg: { type?: string; [k: string]: unknown };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      handleAction(client, msg);
    });
    ws.on('close', () => {
      clients.delete(client);
      // 掉线 → 座位交 AI（2.3 实装重连令牌）：标记 AI 接管，让 runAITurns 推进
      if (room.session && !room.session.isOver()) room.markAI(client.seat);
      runAITurns(room);
      broadcast();
    });
  });

  function handleAction(client: Client, msg: { type?: string; [k: string]: unknown }): void {
    if (msg.type === 'start') {
      room.fillWithAI();
      const r = room.startRound(seedCounter++);
      if (r.ok) runAITurns(room);
      return broadcast();
    }
    const seat = client.seat;
    let r: { ok: boolean; error?: string };
    switch (msg.type) {
      case 'declare': r = room.declare(seat, msg.suit as never, msg.count as number); break;
      case 'pass': r = room.pass(seat); break;
      case 'bury': r = room.bury(seat, msg.cards as never); break;
      case 'call': r = room.call(seat, msg.calls as never); break;
      case 'play': r = room.play(seat, msg.cards as never); break;
      default: return;
    }
    if (!r.ok) return send(client.ws, { type: 'error', error: r.error });
    runAITurns(room);
    broadcast();
  }

  function broadcast(): void {
    for (const c of clients) {
      send(c.ws, {
        type: 'state',
        view: room.session && !room.session.isOver() ? room.session.view(c.seat) : null,
        room: room.snapshot(),
        result: room.lastResult(),
      });
    }
  }

  return {
    http,
    wss,
    room,
    close: () =>
      new Promise<void>((r) => {
        for (const c of wss.clients) c.terminate();
        wss.close(() => http.close(() => r()));
      }),
  };
}

function send(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
