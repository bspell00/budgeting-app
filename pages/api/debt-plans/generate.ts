import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Debt {
  id: string;
  accountName: string;
  balance: number;
  interestRate?: number;
  minimumPayment: number;
}

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
    const { strategy, debts, extraPayment = 200 } = req.body;

    if (!strategy || !debts || !Array.isArray(debts)) {
      return res.status(400).json({ error: 'Strategy and debts are required' });
    }

    if (!['snowball', 'avalanche'].includes(strategy)) {
      return res.status(400).json({ error: 'Strategy must be either "snowball" or "avalanche"' });
    }

    if (debts.length === 0) {
      return res.status(400).json({ error: 'At least one debt is required to create a payoff plan' });
    }

    // Validate debt objects
    const invalidDebts = debts.filter(debt => 
      !debt.id || !debt.accountName || typeof debt.balance !== 'number' || debt.balance <= 0
    );
    
    if (invalidDebts.length > 0) {
      return res.status(400).json({ error: 'All debts must have id, accountName, and positive balance' });
    }

    // First, deactivate any existing active debt plans
    await prisma.aIPlan.updateMany({
      where: {
        userId,
        category: 'debt',
        status: 'active'
      },
      data: {
        status: 'paused'
      }
    });

    // Generate the appropriate strategy
    const planData = strategy === 'snowball' 
      ? generateSnowballPlan(debts, extraPayment)
      : generateAvalanchePlan(debts, extraPayment);

    // Create the new plan in the database
    const newPlan = await prisma.aIPlan.create({
      data: {
        userId,
        title: planData.title,
        description: planData.description,
        category: 'debt',
        priority: 'high',
        timeframe: planData.estimatedMonths.toString(),
        estimatedImpact: 'significant',
        steps: JSON.stringify(planData.steps),
        status: 'active',
        aiGenerated: false, // These are system-generated, not AI-generated
        metadata: JSON.stringify({
          strategy: strategy,
          totalDebt: planData.totalDebt,
          monthlyPayment: planData.monthlyPayment,
          progress: 0,
          payments: [],
          debtOrder: planData.debtOrder,
          originalDebts: debts
        })
      }
    });

    // Return the formatted plan
    const formattedPlan = {
      id: newPlan.id,
      title: newPlan.title,
      description: newPlan.description,
      strategy: strategy,
      steps: planData.steps,
      totalDebt: planData.totalDebt,
      monthlyPayment: planData.monthlyPayment,
      estimatedMonths: planData.estimatedMonths,
      progress: 0,
      status: 'active',
      createdAt: newPlan.createdAt.toISOString(),
      payments: []
    };

    return res.status(201).json({
      success: true,
      plan: formattedPlan
    });
  } catch (error) {
    console.error('Error generating debt plan:', error);
    return res.status(500).json({ 
      error: 'Failed to generate debt plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateSnowballPlan(debts: Debt[], extraPayment: number) {
  // Sort debts by balance (smallest first)
  const sortedDebts = [...debts].sort((a, b) => a.balance - b.balance);
  
  const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalMinimums = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  const totalMonthlyPayment = totalMinimums + extraPayment;
  
  // Calculate estimated payoff time (simplified calculation)
  const estimatedMonths = Math.ceil(totalDebt / totalMonthlyPayment);
  
  const steps = [
    "Pay minimum payments on all debts",
    `Put extra $${extraPayment}/month toward smallest debt: ${sortedDebts[0]?.accountName}`,
    ...sortedDebts.slice(1).map((debt, index) => 
      `After ${sortedDebts[index]?.accountName} is paid off → Focus on ${debt.accountName}`
    ),
    "Celebrate becoming debt-free! 🎉"
  ];

  return {
    title: "🔥 Debt Snowball Strategy",
    description: `Pay off smallest debts first for quick wins. Target payoff in ${estimatedMonths} months.`,
    steps,
    totalDebt,
    monthlyPayment: totalMonthlyPayment,
    estimatedMonths,
    debtOrder: sortedDebts.map(d => d.id)
  };
}

function generateAvalanchePlan(debts: Debt[], extraPayment: number) {
  // Sort debts by interest rate (highest first)
  const sortedDebts = [...debts].sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
  
  const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalMinimums = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  const totalMonthlyPayment = totalMinimums + extraPayment;
  
  // Calculate estimated payoff time (simplified calculation)
  const estimatedMonths = Math.ceil(totalDebt / totalMonthlyPayment);
  
  const steps = [
    "Pay minimum payments on all debts",
    `Put extra $${extraPayment}/month toward highest interest debt: ${sortedDebts[0]?.accountName}${sortedDebts[0]?.interestRate ? ` (${sortedDebts[0].interestRate}% APR)` : ''}`,
    ...sortedDebts.slice(1).map((debt, index) => 
      `After ${sortedDebts[index]?.accountName} is paid off → Focus on ${debt.accountName}${debt.interestRate ? ` (${debt.interestRate}% APR)` : ''}`
    ),
    "Celebrate becoming debt-free! 🎉"
  ];

  return {
    title: "⚡ Debt Avalanche Strategy",
    description: `Pay off highest interest debts first to save money. Target payoff in ${estimatedMonths} months.`,
    steps,
    totalDebt,
    monthlyPayment: totalMonthlyPayment,
    estimatedMonths,
    debtOrder: sortedDebts.map(d => d.id)
  };
}