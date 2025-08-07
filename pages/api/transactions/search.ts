import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { generateSearchEmbedding, findSimilarTransactions } from '../../../lib/embeddings';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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
    const { 
      q: query, 
      limit = '20', 
      threshold = '0.7',
      useEmbeddings = 'true',
      fallbackToText = 'true'
    } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const searchLimit = parseInt(limit as string) || 20;
    const similarityThreshold = parseFloat(threshold as string) || 0.7;
    const shouldUseEmbeddings = useEmbeddings === 'true';
    const shouldFallbackToText = fallbackToText === 'true';

    let results = [];
    let searchMethod = 'text';

    // Try semantic search first if enabled and API key available
    if (shouldUseEmbeddings && process.env.OPENAI_API_KEY) {
      console.log(`🔍 Performing semantic search for: "${query}"`);

      try {
        // Generate embedding for search query
        const queryEmbedding = await generateSearchEmbedding(query);

        if (queryEmbedding) {
          // Get all transactions with embeddings for this user
          const transactionsWithEmbeddings = await (prisma as any).transaction.findMany({
            where: { 
              userId,
              embedding: { not: null }
            },
            select: {
              id: true,
              description: true,
              amount: true,
              date: true,
              category: true,
              embedding: true,
              account: {
                select: {
                  accountName: true
                }
              },
              budget: {
                select: {
                  name: true
                }
              }
            },
            orderBy: { date: 'desc' },
            take: 2000 // Limit for performance
          });

          if (transactionsWithEmbeddings.length > 0) {
            // Parse embeddings and perform similarity search
            const parsedEmbeddings = transactionsWithEmbeddings
              .map((t: any) => {
                try {
                  return {
                    id: t.id,
                    description: t.description,
                    embedding: JSON.parse(t.embedding!),
                    transaction: t
                  };
                } catch {
                  return null;
                }
              })
              .filter(Boolean) as Array<{
                id: string;
                description: string; 
                embedding: number[];
                transaction: any;
              }>;

            // Find similar transactions
            const similarTransactions = findSimilarTransactions(
              queryEmbedding,
              parsedEmbeddings,
              similarityThreshold,
              searchLimit
            );

            // Map back to full transaction data
            results = similarTransactions.map(similar => {
              const transaction = parsedEmbeddings.find(t => t.id === similar.id)?.transaction;
              return {
                ...transaction,
                similarity: similar.similarity,
                searchScore: similar.similarity
              };
            });

            searchMethod = 'semantic';
            console.log(`✅ Found ${results.length} semantic matches`);
          }
        }
      } catch (error) {
        console.error('Semantic search failed:', error);
      }
    }

    // Fallback to traditional text search if no semantic results or disabled
    if (results.length === 0 && shouldFallbackToText) {
      console.log(`📝 Performing text search for: "${query}"`);

      const textResults = await prisma.transaction.findMany({
        where: {
          userId,
          description: {
            contains: query,
            mode: 'insensitive'
          }
        },
        include: {
          account: {
            select: {
              accountName: true
            }
          },
          budget: {
            select: {
              name: true
            }
          }
        },
        orderBy: { date: 'desc' },
        take: searchLimit
      });

      results = textResults.map(t => ({
        ...t,
        searchScore: 1.0, // Text matches get perfect score
        similarity: null
      }));

      searchMethod = 'text';
      console.log(`✅ Found ${results.length} text matches`);
    }

    // Get statistics about embeddings
    const embeddingStats = await (prisma as any).transaction.aggregate({
      where: { userId },
      _count: {
        id: true,
        embedding: true
      }
    });

    const totalTransactions = embeddingStats._count.id;
    const embeddedTransactions = embeddingStats._count.embedding || 0;
    const embeddingCoverage = totalTransactions > 0 ? 
      Math.round((embeddedTransactions / totalTransactions) * 100) : 0;

    res.json({
      query,
      results,
      searchMethod,
      resultsCount: results.length,
      similarity: {
        threshold: similarityThreshold,
        enabled: shouldUseEmbeddings && !!process.env.OPENAI_API_KEY
      },
      embeddings: {
        total: totalTransactions,
        embedded: embeddedTransactions,
        coverage: embeddingCoverage,
        available: !!process.env.OPENAI_API_KEY
      }
    });

  } catch (error) {
    console.error('Transaction search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Search failed',
      details: errorMessage
    });
  }
}