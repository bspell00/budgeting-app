import { NextApiRequest, NextApiResponse } from 'next';
import { initSocket } from '../../lib/websocket-server';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Initialize Socket.IO server
    const io = initSocket(res);
    res.end();
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}