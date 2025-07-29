import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    const { planId, amount, date } = req.body;

    if (!planId || !amount || !date) {
      return res.status(400).json({ error: 'Plan ID, amount, and date are required' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    if (amount > 50000) {
      return res.status(400).json({ error: 'Payment amount seems unusually large. Please verify.' });
    }

    // Validate date
    const paymentDate = new Date(date);
    if (isNaN(paymentDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Get the current plan
    const plan = await prisma.aIPlan.findUnique({
      where: { 
        id: planId,
        userId // Ensure user owns the plan
      }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Parse current metadata
    const metadata = plan.metadata ? JSON.parse(plan.metadata) : {};
    const payments = metadata.payments || [];

    // Add new payment
    const paymentDateTime = new Date(date);
    const monthYear = paymentDateTime.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    const newPayment = {
      id: `payment_${Date.now()}`,
      amount: amount,
      targetDebt: metadata.debtOrder?.[0] || 'primary', // Target the current focus debt
      date: date,
      month: monthYear
    };

    payments.unshift(newPayment); // Add to beginning for chronological order
    
    // Calculate new progress (simplified - based on total payments vs total debt)
    const totalPaid = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
    const totalDebt = metadata.totalDebt || 1;
    const newProgress = Math.min((totalPaid / totalDebt) * 100, 100);

    // Update metadata
    const updatedMetadata = {
      ...metadata,
      payments: payments.slice(0, 12), // Keep last 12 payments
      progress: newProgress,
      totalPaid: totalPaid,
      lastPaymentDate: date
    };

    // Update the plan
    const updatedPlan = await prisma.aIPlan.update({
      where: { id: planId },
      data: {
        metadata: JSON.stringify(updatedMetadata),
        updatedAt: new Date()
      }
    });

    // Format response
    const formattedPlan = {
      id: updatedPlan.id,
      title: updatedPlan.title,
      description: updatedPlan.description,
      strategy: metadata.strategy || 'custom',
      steps: updatedPlan.steps ? JSON.parse(updatedPlan.steps) : [],
      totalDebt: metadata.totalDebt || 0,
      monthlyPayment: metadata.monthlyPayment || 0,
      estimatedMonths: parseInt(updatedPlan.timeframe) || 12,
      progress: newProgress,
      status: updatedPlan.status,
      createdAt: updatedPlan.createdAt.toISOString(),
      payments: payments.slice(0, 6) // Return last 6 payments for UI
    };

    return res.status(200).json({
      success: true,
      updatedPlan: formattedPlan,
      message: `Payment of $${amount} recorded successfully!`
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    return res.status(500).json({ 
      error: 'Failed to record payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}