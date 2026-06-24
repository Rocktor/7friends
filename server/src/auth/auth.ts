import { randomBytes } from 'node:crypto';
import type { DB } from '../persistence/db';
import { hashPassword, verifyPassword } from './password';

export type RegisterResult = { ok: true; userId: number } | { ok: false; error: string };
export type LoginResult = { ok: true; token: string; userId: number } | { ok: false; error: string };

/** 注册 / 登录 / token 校验（会话 token 内存态，重连座位 token 见 2.3）*/
export class AuthService {
  private readonly tokens = new Map<string, number>(); // token → userId

  constructor(private readonly db: DB) {}

  register(username: string, plain: string): RegisterResult {
    if (!username.trim() || !plain) return { ok: false, error: 'empty username or password' };
    if (username.length > 32 || plain.length > 256) return { ok: false, error: 'username/password too long' };
    const existing = this.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return { ok: false, error: 'username taken' };
    const info = this.db
      .prepare('INSERT INTO users (username, pwd_hash, created_at) VALUES (?, ?, ?)')
      .run(username, hashPassword(plain), Date.now());
    return { ok: true, userId: Number(info.lastInsertRowid) };
  }

  login(username: string, plain: string): LoginResult {
    const row = this.db.prepare('SELECT id, pwd_hash FROM users WHERE username = ?').get(username) as
      | { id: number; pwd_hash: string }
      | undefined;
    if (!row || !verifyPassword(plain, row.pwd_hash)) return { ok: false, error: 'bad credentials' };
    const token = randomBytes(24).toString('hex');
    this.tokens.set(token, row.id);
    return { ok: true, token, userId: row.id };
  }

  verify(token: string): number | null {
    return this.tokens.get(token) ?? null;
  }

  /** 按 userId 取用户名（座位显示用）*/
  usernameOf(userId: number): string | null {
    const row = this.db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as
      | { username: string }
      | undefined;
    return row ? row.username : null;
  }
}
