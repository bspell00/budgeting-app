import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import CreditCardPaymentHandler from '../../../lib/credit-card-payment-handler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  if (req.method === 'POST') {
    const { fromAccountId, toAccountId, amount, date } = req.body;

    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({ error: 'Missing required fields: fromAccountId, toAccountId, amount' });
    }

    try {
      const paymentDate = date ? new Date(date) : new Date();
      const paymentAmount = parseFloat(amount);

      if (paymentAmount <= 0) {
        return res.status(400).json({ error: 'Payment amount must be positive' });
      }

      const result = await CreditCardPaymentHandler.createCreditCardPayment({
        fromAccountId,
        toAccountId,
        amount: paymentAmount,
        date: paymentDate,
        userId
      });

      res.status(201).json({
        success: true,
        transactions: result,
        message: 'Credit card payment created successfully'
      });
    } catch (error) {
      console.error('Error creating credit card payment:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('access denied')) {
          return res.status(403).json({ error: error.message });
        }
        if (error.message.includes('Invalid payment')) {
          return res.status(400).json({ error: error.message });
        }
      }
      
      res.status(500).json({ error: 'Failed to create credit card payment' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}