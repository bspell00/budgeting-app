import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PayeeService } from '../../../lib/payee-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  try {
    console.log(`🔧 Initializing payees for user: ${userId}`);
    
    // Create credit card payment payees for all credit cards
    await PayeeService.createCreditCardPaymentPayees(userId);
    
    // Get all created payees to return
    const creditCardPayees = await PayeeService.getCreditCardPaymentPayees(userId);
    
    console.log(`✅ Ensured ${creditCardPayees.length} credit card payment payees exist`);
    
    res.json({
      success: true,
      payees: creditCardPayees,
      message: `Initialized ${creditCardPayees.length} credit card payment payees`
    });
    
  } catch (error) {
    console.error('Error initializing payees:', error);
    res.status(500).json({
      error: 'Failed to initialize payees',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}