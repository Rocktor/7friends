import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// 打包为单文件（解析 @engine 别名 + 内联 engine 源 + ws）；node:sqlite 等内置外置。
await build({
  entryPoints: [fileURLToPath(new URL('./src/main.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: fileURLToPath(new URL('./dist/server.mjs', import.meta.url)),
  alias: { '@engine': fileURLToPath(new URL('../engine/src/index.ts', import.meta.url)) },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
console.log('bundled -> dist/server.mjs');
