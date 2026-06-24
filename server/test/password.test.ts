import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password';

describe('password hashing (scrypt)', () => {
  it('hash is not the plaintext and has salt:hash shape', () => {
    const h = hashPassword('hunter2');
    expect(h).not.toBe('hunter2');
    expect(h).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it('same password hashes differently each time (random salt)', () => {
    expect(hashPassword('hunter2')).not.toBe(hashPassword('hunter2'));
  });

  it('verifyPassword accepts the correct password', () => {
    const h = hashPassword('correct horse');
    expect(verifyPassword('correct horse', h)).toBe(true);
  });

  it('verifyPassword rejects a wrong password', () => {
    const h = hashPassword('correct horse');
    expect(verifyPassword('wrong horse', h)).toBe(false);
  });

  it('verifyPassword rejects malformed stored strings', () => {
    expect(verifyPassword('x', 'not-a-valid-hash')).toBe(false);
  });
});
