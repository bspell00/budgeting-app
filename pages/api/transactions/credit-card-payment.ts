// pages/api/transactions/credit-card-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import CreditCardPaymentHandler from '../../../lib/credit-card-payment-handler';

// WebSocket integration for real-time updates
let triggerFinancialSync: ((userId: string, payload?: { accountId?: string | null, reason?: string }) => Promise<void>) | null = null;
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const websocketServer = require('../../../lib/websocket-server');
    triggerFinancialSync = websocketServer.triggerFinancialSync;
  } catch {
    console.log('[credit-card-payment] WebSocket server not available');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const userId = (session.user as any).id as string | undefined;
  if (!userId) return res.status(401).json({ error: 'No user ID found' });

  const { fromAccountId, toAccountId, amount, date } = (req.body ?? {}) as {
    fromAccountId?: string;
    toAccountId?: string;
    amount?: number | string;
    date?: string;
  };

  if (!fromAccountId || !toAccountId || amount == null) {
    return res.status(400).json({ error: 'Missing required fields: fromAccountId, toAccountId, amount' });
  }

  // Coerce/validate amount
  const paymentAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be a positive number' });
  }

  // Coerce/validate date
  const paymentDate = date ? new Date(date) : new Date();
  if (isNaN(paymentDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date' });
  }

  try {
    const result = await CreditCardPaymentHandler.createCreditCardPayment({
      fromAccountId,
      toAccountId,
      amount: paymentAmount,
      date: paymentDate,
      userId,
    });

    // 🔔 Realtime: notify both accounts, then global
    const emit = async (accountId: string | null, reason: 'create' | 'update' | 'delete' | 'recat' | 'import' | 'sync' = 'create') => {
      if (!triggerFinancialSync) return;
      try {
        await (triggerFinancialSync as any)(userId, { accountId, reason });
      } catch (e: any) {
        console.warn('[credit-card-payment] ws emit failed:', e?.message || e);
      }
    };

    await emit(fromAccountId, 'create');
    await emit(toAccountId, 'create');

    return res.status(201).json({
      success: true,
      transactions: result,
      message: 'Credit card payment created successfully',
    });
  } catch (error: any) {
    console.error('Error creating credit card payment:', error?.response?.data || error);

    const msg = (error instanceof Error && error.message) || '';
    if (msg.includes('not found') || msg.includes('access denied')) {
      return res.status(403).json({ error: msg });
    }
    if (msg.includes('Invalid payment')) {
      return res.status(400).json({ error: msg });
    }
    return res.status(500).json({ error: 'Failed to create credit card payment' });
  }
}