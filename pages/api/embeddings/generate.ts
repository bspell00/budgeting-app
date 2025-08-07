import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { batchGenerateEmbeddings } from '../../../lib/embeddings';

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

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const { force = false } = req.body;

    console.log('🔍 Generating embeddings for user transactions...');

    // Find transactions without embeddings (or all if force=true)
    const whereClause = force 
      ? { userId }
      : { userId, embedding: null };

    const transactions = await (prisma as any).transaction.findMany({
      where: whereClause,
      select: {
        id: true,
        description: true,
        embedding: true
      },
      orderBy: { createdAt: 'desc' },
      take: 1000 // Process max 1000 at a time
    });

    if (transactions.length === 0) {
      return res.json({
        message: 'No transactions need embedding generation',
        processed: 0,
        total: 0
      });
    }

    console.log(`📊 Processing ${transactions.length} transactions for embeddings`);

    // Extract descriptions for batch processing
    const descriptions = transactions.map((t: any) => t.description);
    
    // Generate embeddings in batches
    const embeddings = await batchGenerateEmbeddings(descriptions);

    // Update transactions with embeddings
    let processed = 0;
    const updatePromises = [];

    for (let i = 0; i < transactions.length; i++) {
      const embedding = embeddings[i];
      if (embedding) {
        updatePromises.push(
          (prisma as any).transaction.update({
            where: { id: transactions[i].id },
            data: {
              embedding: JSON.stringify(embedding),
              embeddingCreatedAt: new Date()
            }
          })
        );
        processed++;
      }
    }

    // Execute all updates in parallel
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    console.log(`✅ Successfully generated embeddings for ${processed} transactions`);

    res.json({
      message: `Generated embeddings for ${processed} transactions`,
      processed,
      total: transactions.length,
      success: processed > 0
    });

  } catch (error) {
    console.error('Error generating embeddings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to generate embeddings',
      details: errorMessage
    });
  }
}