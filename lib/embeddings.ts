import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Check if OpenAI API key is configured
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

/**
 * Generate embedding vector for transaction description
 */
export async function generateTransactionEmbedding(description: string): Promise<number[] | null> {
  if (!hasOpenAIKey) {
    console.warn('OpenAI API key not configured, skipping embedding generation');
    return null;
  }

  try {
    // Clean and prepare the text for embedding
    const cleanText = cleanTransactionText(description);
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small", // Cost-effective, good performance
      input: cleanText,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    return null;
  }
}

/**
 * Generate embedding for search query
 */
export async function generateSearchEmbedding(query: string): Promise<number[] | null> {
  if (!hasOpenAIKey) {
    console.warn('OpenAI API key not configured, skipping search embedding generation');
    return null;
  }

  try {
    // Enhance query for better semantic matching
    const enhancedQuery = enhanceSearchQuery(query);
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small", 
      input: enhancedQuery,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Failed to generate search embedding:', error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Clean transaction text for better embedding
 */
function cleanTransactionText(description: string): string {
  return description
    .toLowerCase()
    // Remove common transaction prefixes/suffixes
    .replace(/^(debit card|credit card|online|pos|ach|wire|check)/i, '')
    .replace(/\b(transaction|purchase|payment|debit|credit)\b/gi, '')
    // Remove transaction IDs and reference numbers
    .replace(/\b[a-z0-9]{10,}\b/gi, '')
    .replace(/\b\d{4,}\b/g, '')
    // Clean up merchant names
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Enhance search query for better semantic matching
 */
function enhanceSearchQuery(query: string): string {
  const enhancements = {
    'coffee': 'coffee shop cafe starbucks dunkin espresso latte cappuccino',
    'food': 'restaurant dining meal lunch dinner breakfast fast food',
    'gas': 'gas station fuel gasoline petrol shell chevron exxon bp',
    'grocery': 'grocery store supermarket food market walmart target kroger',
    'shopping': 'retail store shopping mall department store amazon walmart target',
    'entertainment': 'movie theater cinema netflix spotify entertainment streaming',
    'transport': 'uber lyft taxi rideshare transportation public transit metro',
    'health': 'pharmacy medical doctor hospital clinic health insurance',
    'utility': 'electric gas water internet phone utility bill service'
  };

  const lowerQuery = query.toLowerCase();
  
  // Check if query matches any enhancement category
  for (const [key, enhancement] of Object.entries(enhancements)) {
    if (lowerQuery.includes(key)) {
      return `${query} ${enhancement}`;
    }
  }

  return query;
}

/**
 * Batch process transactions for embedding generation
 */
export async function batchGenerateEmbeddings(descriptions: string[]): Promise<(number[] | null)[]> {
  if (!hasOpenAIKey || descriptions.length === 0) {
    return descriptions.map(() => null);
  }

  try {
    // Process in batches of 100 (OpenAI limit)
    const batchSize = 100;
    const results: (number[] | null)[] = [];
    
    for (let i = 0; i < descriptions.length; i += batchSize) {
      const batch = descriptions.slice(i, i + batchSize);
      const cleanedBatch = batch.map(cleanTransactionText);
      
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: cleanedBatch,
        encoding_format: "float",
      });

      results.push(...response.data.map(item => item.embedding));
    }

    return results;
  } catch (error) {
    console.error('Failed to generate batch embeddings:', error);
    return descriptions.map(() => null);
  }
}

/**
 * Search transactions by semantic similarity
 */
export function findSimilarTransactions(
  queryEmbedding: number[], 
  transactionEmbeddings: { id: string, embedding: number[], description: string }[],
  threshold: number = 0.7,
  limit: number = 20
): { id: string, similarity: number, description: string }[] {
  
  const similarities = transactionEmbeddings
    .map(({ id, embedding, description }) => ({
      id,
      description,
      similarity: cosineSimilarity(queryEmbedding, embedding)
    }))
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return similarities;
}