import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

/**
 * Generate embedding vector for text using OpenAI's text-embedding-3-small model
 * @param text - Text to embed (typically a documentation section)
 * @returns Array of 1536 numbers representing the embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  });

  return embedding;
}
