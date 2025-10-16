import { glob } from 'glob';
import path from 'path';
import { ingestDocument, getDocumentStats } from '../src/services/chat/ragService.js';

async function ingestAllDocs() {
  console.log('🚀 Starting documentation ingestion...\n');

  // Find all markdown files in docs/ folder
  const docsPath = path.resolve(process.cwd(), '..', 'docs');
  const pattern = path.join(docsPath, '**', '*.md');
  const files = await glob(pattern, { windowsPathsNoEscape: true });

  if (files.length === 0) {
    console.log('⚠️  No markdown files found in docs/ folder');
    return;
  }

  console.log(`Found ${files.length} documentation files:\n`);

  let totalChunks = 0;
  for (const file of files) {
    const relativePath = path.relative(path.resolve(process.cwd(), '..'), file);

    // Convert Windows paths to forward slashes for consistency
    const normalizedPath = relativePath.replace(/\\/g, '/');

    try {
      console.log(`  📄 Ingesting: ${normalizedPath}`);
      const chunksCreated = await ingestDocument(file);
      console.log(`     ✓ Created ${chunksCreated} chunks`);
      totalChunks += chunksCreated;
    } catch (error) {
      console.error(`     ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get final stats
  const stats = await getDocumentStats();

  console.log('\n' + '='.repeat(50));
  console.log('✅ Documentation ingestion complete!');
  console.log('='.repeat(50));
  console.log(`📊 Total documents: ${stats.totalDocuments}`);
  console.log(`📦 Total chunks: ${stats.totalChunks}`);
  console.log(`📈 Average chunks per document: ${(stats.totalChunks / stats.totalDocuments).toFixed(1)}`);
  console.log('='.repeat(50) + '\n');
}

// Run ingestion
ingestAllDocs()
  .then(() => {
    console.log('👍 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
