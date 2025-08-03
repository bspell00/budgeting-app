import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PayeeService } from '../../../lib/payee-service';

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
      // Get all payees for the user
      const allPayees = await PayeeService.getUserPayees(userId);
      
      // Separate credit card payment payees from regular payees
      const creditCardPayees = await PayeeService.getCreditCardPaymentPayees(userId);
      const regularPayees = allPayees.filter(p => !p.isInternal || !p.name.startsWith('Payment: '));
      
      res.json({
        success: true,
        payees: {
          all: allPayees,
          creditCardPayments: creditCardPayees,
          regular: regularPayees
        },
        total: allPayees.length
      });
      
    } catch (error) {
      console.error('Error fetching payees:', error);
      res.status(500).json({
        error: 'Failed to fetch payees',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } 
  
  else if (req.method === 'POST') {
    try {
      const { name, category, isInternal } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Payee name is required' });
      }
      
      // Create or get the payee
      const payee = await PayeeService.getOrCreatePayee(userId, name, {
        category: category || null,
        isInternal: isInternal || false
      });
      
      res.json({
        success: true,
        payee
      });
      
    } catch (error) {
      console.error('Error creating payee:', error);
      res.status(500).json({
        error: 'Failed to create payee',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}