// pages/api/socket.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import { initWebSocket } from '../../lib/websocket-server';

export const config = { api: { bodyParser: false } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const server = res.socket?.server as unknown as HTTPServer;
  if (!server) return res.status(500).end('No server');
  initWebSocket(server);
  res.end();
}