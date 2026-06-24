import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../src/persistence/db';
import { AuthService } from '../src/auth/auth';

describe('AuthService 注册/登录 (Phase 2.1)', () => {
  let auth: AuthService;
  beforeEach(() => {
    auth = new AuthService(openDb(':memory:'));
  });

  it('registers a new user', () => {
    const r = auth.register('alice', 'pw123456');
    expect(r.ok).toBe(true);
  });

  it('rejects duplicate username', () => {
    auth.register('bob', 'pw123456');
    const r = auth.register('bob', 'other');
    expect(r.ok).toBe(false);
  });

  it('login succeeds with correct password and returns a token', () => {
    auth.register('carol', 'secretpw');
    const r = auth.login('carol', 'secretpw');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.token).toMatch(/.+/);
  });

  it('login fails with wrong password', () => {
    auth.register('dave', 'secretpw');
    expect(auth.login('dave', 'nope').ok).toBe(false);
  });

  it('login fails for unknown user', () => {
    expect(auth.login('ghost', 'x').ok).toBe(false);
  });

  it('rejects over-long password (scrypt DoS guard)', () => {
    expect(auth.register('longpw', 'x'.repeat(300)).ok).toBe(false);
  });

  it('verify resolves a valid token to the userId, rejects junk', () => {
    auth.register('erin', 'secretpw');
    const r = auth.login('erin', 'secretpw');
    if (!r.ok) throw new Error('login should succeed');
    expect(auth.verify(r.token)).toBe(r.userId);
    expect(auth.verify('bogus-token')).toBeNull();
  });
});
