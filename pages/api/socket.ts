// pages/api/socket.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import { initWebSocket } from '../../lib/websocket-server';

export const config = { api: { bodyParser: false } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Next's types don't declare `server` on the socket, but it's there at runtime.
  const server: HTTPServer | undefined = (res as any)?.socket?.server;
  if (!server) {
    console.error('[ws] No HTTP server on res.socket.server');
    return res.status(500).end('No server');
  }

  initWebSocket(server);
  res.end(); // 200 OK, empty body
}