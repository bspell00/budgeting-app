import { NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';

export interface NextApiResponseServerIO extends NextApiResponse {
  socket: any & {
    server: any & {
      io?: IOServer;
    };
  };
}