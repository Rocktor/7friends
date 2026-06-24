import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';

// node:sqlite 是较新内置模块，部分打包器静态解析不了 → 用 createRequire 交给 Node 运行时解析
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync: DatabaseSyncCtor } = nodeRequire('node:sqlite') as {
  DatabaseSync: typeof DatabaseSync;
};

export type DB = DatabaseSync;

/** 打开数据库并建表（§7 schema）。path=':memory:' 用于测试 */
export function openDb(path = ':memory:'): DB {
  const db = new DatabaseSyncCtor(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT UNIQUE NOT NULL,
      pwd_hash   TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS matches (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      dealer     INTEGER NOT NULL,
      level      TEXT NOT NULL,
      trump      TEXT,
      result_json TEXT,
      seed       INTEGER
    );
    CREATE TABLE IF NOT EXISTS match_events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id  INTEGER NOT NULL,
      seq       INTEGER NOT NULL,
      event_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS live_snapshots (
      table_id   TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return db;
}
