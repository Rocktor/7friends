// 密码哈希：node:crypto scrypt（零原生依赖，可移植）
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

/** 把明文密码哈希成 "salt:hash" 存储串 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

/** 校验明文是否匹配存储串（timing-safe）*/
export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(plain, salt, KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
