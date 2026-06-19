/**
 * 커스텀 Next.js + Socket.io 서버
 *
 * Next.js 14 App Router는 WebSocket을 직접 지원하지 않으므로
 * 커스텀 HTTP 서버에 Socket.io를 통합합니다.
 *
 * 실행: npx ts-node --project tsconfig.server.json server/index.ts
 * 또는: npm run dev:server
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeSocketServer } from './socket/SocketServer';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Socket.io 서버 초기화
  const io = initializeSocketServer(httpServer);

  // 전역 접근용 (디버깅)
  (global as any).__io = io;

  httpServer.listen(port, () => {
    console.log(`
┌──────────────────────────────────────────────┐
│                                              │
│   🏌️ Prompt Golf Server                      │
│                                              │
│   > Ready on http://${hostname}:${port}             │
│   > Socket.io enabled                        │
│   > Mode: ${dev ? 'development' : 'production'}                       │
│                                              │
└──────────────────────────────────────────────┘
    `);
  });
});
