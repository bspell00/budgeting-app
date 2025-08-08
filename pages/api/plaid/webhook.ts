import type { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import prisma from '../../../lib/prisma';
// If you’ll sync immediately, import your Plaid client:
// import { plaidClient } from '../../../lib/plaid';

let triggerFinancialSync: ((userId: string) => Promise<void>) | null = null;
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const websocketServer = require('../../../lib/websocket-server');
    triggerFinancialSync = websocketServer.triggerFinancialSync;
  } catch (e) {
    console.log('WebSocket server not available', e);
  }
}

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  let evt: any = {};
  try {
    const raw = (await buffer(req)).toString();
    evt = JSON.parse(raw);
  } catch {
    return res.status(200).json({ ok: true });
  }

  const itemId = evt?.item_id;
  if (!itemId) return res.status(200).json({ ok: true });

  try {
    const mapping = await prisma.plaidItem.findUnique({ where: { itemId } });
    if (!mapping?.userId) return res.status(200).json({ ok: true });
    const userId = mapping.userId;

    // Trigger automatic sync when Plaid notifies us of new transactions
    console.log(`[webhook] Received webhook for item ${itemId}, user ${userId}, triggering sync...`);
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/plaid/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'plaid-webhook-sync',
        },
        body: JSON.stringify({ webhookUserId: userId }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[webhook] Sync completed: ${result.message}`);
      } else {
        console.warn(`[webhook] Sync failed: ${response.status} ${response.statusText}`);
      }
    } catch (syncError) {
      console.error('[webhook] Failed to trigger sync:', syncError);
    }

    if (triggerFinancialSync) await triggerFinancialSync(userId);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Plaid webhook handler error', e);
    return res.status(200).json({ ok: true });
  }
}
