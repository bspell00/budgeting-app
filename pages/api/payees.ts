import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PayeeService } from '../../lib/payee-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  if (req.method === 'GET') {
    try {
      const { type } = req.query;
      
      let payees;
      if (type === 'credit-card-payments') {
        // Get only credit card payment payees
        payees = await PayeeService.getCreditCardPaymentPayees(userId);
      } else {
        // Get all payees
        payees = await PayeeService.getUserPayees(userId);
      }

      res.json({ payees });
    } catch (error) {
      console.error('Error fetching payees:', error);
      res.status(500).json({ error: 'Failed to fetch payees' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, category, isInternal } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Payee name is required' });
      }

      const payee = await PayeeService.getOrCreatePayee(userId, name, {
        category,
        isInternal
      });

      res.status(201).json(payee);
    } catch (error) {
      console.error('Error creating payee:', error);
      res.status(500).json({ error: 'Failed to create payee' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}