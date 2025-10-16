import { promises as fs } from 'fs';
import path from 'path';
import { prismaClientInstance as prisma } from '../../db/prismaClient.js';
import { generateEmbedding } from './embeddingService.js';

export interface DocumentChunk {
  id: string;
  documentId: string;
  sectionId: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  similarity?: number;
}

interface ParsedSection {
  id: string;
  title: string;
  content: string;
  level: number;
}

/**
 * Parse markdown file and split into sections by headings
 * Each heading becomes a separate chunk for better semantic search
 */
function parseMarkdownSections(markdown: string, filePath: string): ParsedSection[] {
  // Normalize line endings (CRLF → LF) to handle Windows files
  const normalizedMarkdown = markdown.replace(/\r\n/g, '\n');
  const lines = normalizedMarkdown.split('\n');
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    // Check if line is a heading (## or ###)
    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section if exists
      if (currentSection && currentContent.length > 0) {
        const content = currentContent.join('\n').trim();
        if (content.length > 50) { // Only save if substantial content (more than 50 chars)
          currentSection.content = content;
          sections.push(currentSection);
        }
      }

      // Start new section
      const level = headingMatch[1]!.length;
      const title = headingMatch[2]!.trim();
      currentSection = {
        id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        content: '',
        level,
      };
      currentContent = [];
    } else {
      // Add line to current section content
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection && currentContent.length > 0) {
    const content = currentContent.join('\n').trim();
    if (content.length > 50) {
      currentSection.content = content;
      sections.push(currentSection);
    }
  }

  return sections;
}

/**
 * Extract category from file path
 * e.g., "docs/stock-transfers/overview.md" → "stock-transfers"
 */
function extractCategory(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  if (parts.length >= 2 && parts[1]) {
    return parts[1]; // Category is second part (docs/CATEGORY/file.md)
  }
  return 'general';
}

/**
 * Ingest a single markdown document into the vector database
 * Splits document by headings and creates embeddings for each section
 */
export async function ingestDocument(filePath: string): Promise<number> {
  // Read markdown file
  const absolutePath = path.resolve(filePath);
  const markdown = await fs.readFile(absolutePath, 'utf-8');

  // Extract document name from path
  const documentName = path.basename(filePath, '.md');
  const category = extractCategory(filePath);

  // Parse into sections
  const sections = parseMarkdownSections(markdown, filePath);

  // Delete existing chunks for this document
  await prisma.documentChunk.deleteMany({
    where: { documentId: filePath },
  });

  // Ingest each section
  let chunksCreated = 0;
  for (const section of sections) {
    // Generate embedding for section content
    const embedding = await generateEmbedding(section.content);

    // Convert embedding to pgvector format (array string)
    const embeddingVector = `[${embedding.join(',')}]`;

    // Create chunk in database
    await prisma.$executeRaw`
      INSERT INTO document_chunks (id, "documentId", "sectionId", title, content, embedding, metadata, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        ${filePath},
        ${section.id},
        ${`${documentName} - ${section.title}`},
        ${section.content},
        ${embeddingVector}::vector,
        ${JSON.stringify({ category, level: section.level })}::jsonb,
        NOW(),
        NOW()
      )
    `;

    chunksCreated++;
  }

  return chunksCreated;
}

/**
 * Search documentation using semantic vector similarity
 * Returns top K most relevant documentation chunks for a query
 */
export async function searchDocumentation(
  query: string,
  limit: number = 3,
  similarityThreshold: number = 0.7
): Promise<DocumentChunk[]> {
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);
  const queryVector = `[${queryEmbedding.join(',')}]`;

  // Search using pgvector cosine similarity
  // Cosine similarity: 1 - (embedding <=> query::vector)
  // Returns values between 0 (no similarity) and 1 (identical)
  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      documentId: string;
      sectionId: string;
      title: string;
      content: string;
      metadata: Record<string, any>;
      similarity: number;
    }>
  >`
    SELECT
      id,
      "documentId",
      "sectionId",
      title,
      content,
      metadata,
      1 - (embedding <=> ${queryVector}::vector) as similarity
    FROM document_chunks
    WHERE 1 - (embedding <=> ${queryVector}::vector) > ${similarityThreshold}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;

  return results.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    sectionId: row.sectionId,
    title: row.title,
    content: row.content,
    metadata: row.metadata,
    similarity: row.similarity,
  }));
}

/**
 * Get total count of ingested documents and chunks
 */
export async function getDocumentStats(): Promise<{
  totalChunks: number;
  totalDocuments: number;
}> {
  const totalChunks = await prisma.documentChunk.count();

  const uniqueDocs = await prisma.documentChunk.findMany({
    select: { documentId: true },
    distinct: ['documentId'],
  });

  return {
    totalChunks,
    totalDocuments: uniqueDocs.length,
  };
}
