// pages/api/socket.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import { initWebSocket } from '../../lib/websocket-server';

export const config = { api: { bodyParser: false } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const server = (res as any)?.socket?.server as HTTPServer | undefined;
  if (!server) return res.status(500).end('No server');

  // Only initialize once per server
  if (!(server as any).__ioInited) {
    initWebSocket(server);
    (server as any).__ioInited = true;
  }

  res.status(204).end();
}