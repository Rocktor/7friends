import { fileURLToPath } from 'node:url';
import { openDb } from './persistence/db';
import { createGameServer } from './net/wsServer';

// 生产入口。nginx 反代到此端口（ws upgrade 透传）。Node ≥22（node:sqlite）。
const port = Number(process.env.PORT ?? 5080);
const dbPath = process.env.DB_PATH ?? './zpy.db';
const clientHtml = process.env.CLIENT_HTML ?? fileURLToPath(new URL('../../client/index.html', import.meta.url));

const srv = createGameServer(openDb(dbPath), clientHtml);
srv.http.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[zpy] 7friends server on :${port} (db=${dbPath}, client=${clientHtml})`);
});
