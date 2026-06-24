import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { openDb } from '../src/persistence/db';
import { createGameServer } from '../src/net/wsServer';

let srv: ReturnType<typeof createGameServer> | null = null;

afterEach(async () => {
  if (srv) await srv.close();
  srv = null;
});

function listen(): Promise<number> {
  srv = createGameServer(openDb(':memory:'));
  return new Promise((resolve) => srv!.http.listen(0, () => resolve((srv!.http.address() as AddressInfo).port)));
}

async function post(port: number, path: string, body: unknown) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** 缓冲所有消息，避免 once 监听器之间漏消息的竞态 */
function buffered(ws: WebSocket) {
  const q: any[] = [];
  const waiters: ((m: any) => void)[] = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    const w = waiters.shift();
    if (w) w(m);
    else q.push(m);
  });
  return {
    next(): Promise<any> {
      const m = q.shift();
      return m ? Promise.resolve(m) : new Promise((r) => waiters.push(r));
    },
  };
}

describe('ws 服务器集成 (Phase 2.2b)', () => {
  it('register → login → ws connect → start → state advances', async () => {
    const port = await listen();

    const reg = await post(port, '/api/register', { username: 'neo', password: 'matrix01' });
    expect(reg.ok).toBe(true);

    const login = await post(port, '/api/login', { username: 'neo', password: 'matrix01' });
    expect(login.ok).toBe(true);
    const token = login.token as string;

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
    const buf = buffered(ws);
    await new Promise<void>((r) => ws.once('open', () => r()));

    const joined = await buf.next(); // {type:'joined', seat}
    expect(joined.type).toBe('joined');
    expect(joined.seat).toBe(0);

    await buf.next(); // initial state broadcast

    ws.send(JSON.stringify({ type: 'start' }));
    const state = await buf.next();
    expect(state.type).toBe('state');
    // 开局后 AI 已把局面推进到人类(座0)该行动，或一局已结束
    expect(state.room.phase === 'playing' || state.result !== null).toBe(true);

    ws.close();
  });

  it('reconnect: 掉线后同 token 重连交还原座 (§2.3)', async () => {
    const port = await listen();
    await post(port, '/api/register', { username: 'rex', password: 'pw123456' });
    const login = await post(port, '/api/login', { username: 'rex', password: 'pw123456' });
    const token = login.token as string;

    const ws1 = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
    const b1 = buffered(ws1);
    await new Promise<void>((r) => ws1.once('open', () => r()));
    const j1 = await b1.next();
    expect(j1.type).toBe('joined');
    expect(j1.seat).toBe(0);

    await new Promise<void>((r) => { ws1.once('close', () => r()); ws1.close(); });
    await new Promise((r) => setTimeout(r, 150));

    const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
    const b2 = buffered(ws2);
    await new Promise<void>((r) => ws2.once('open', () => r()));
    const j2 = await b2.next();
    expect(j2.type).toBe('reconnected');
    expect(j2.seat).toBe(0);
    ws2.close();
  });

  it('rejects ws connection with a bad token', async () => {
    const port = await listen();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=bogus`);
    const code = await new Promise<number>((r) => ws.once('close', (c) => r(c)));
    expect(code).toBe(4001);
  });
});
