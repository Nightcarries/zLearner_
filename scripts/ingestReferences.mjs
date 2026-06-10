/**
 * Local Vector Ingestion Script
 *
 * Connects to MongoDB Atlas, chunks input text into overlapping segments,
 * generates 384-dim embeddings locally using Xenova/all-MiniLM-L6-v2,
 * and saves them into a `knowledge_base` collection.
 *
 * Usage:
 *   node scripts/ingestReferences.mjs --file ./data/mytext.txt --category "physics"
 *   echo "Some text" | node scripts/ingestReferences.mjs --category "math"
 */

import { pipeline } from '@huggingface/transformers';
import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ─── Configuration ──────────────────────────────────────────────────────────
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// ─── MongoDB Schema for knowledge_base ──────────────────────────────────────
const KnowledgeBaseSchema = new mongoose.Schema(
  {
    textContent: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    subjectCategory: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const KnowledgeBase =
  mongoose.models.KnowledgeBase ||
  mongoose.model('KnowledgeBase', KnowledgeBaseSchema);

// ─── Text Chunking ──────────────────────────────────────────────────────────

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move forward by (chunkSize - overlap)
    start += chunkSize - overlap;
  }

  return chunks;
}

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { file: null, category: 'general' };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      parsed.file = args[++i];
    } else if (args[i] === '--category' && args[i + 1]) {
      parsed.category = args[++i];
    }
  }

  return parsed;
}

// ─── Read Input Text ────────────────────────────────────────────────────────

function getInputText(filePath) {
  if (filePath) {
    const resolved = resolve(filePath);
    if (!existsSync(resolved)) {
      console.error(`❌ File not found: ${resolved}`);
      process.exit(1);
    }
    console.log(`📄 Reading file: ${resolved}`);
    return readFileSync(resolved, 'utf-8');
  }

  // Check for piped stdin
  if (!process.stdin.isTTY) {
    console.log('📥 Reading from stdin...');
    return readFileSync(0, 'utf-8');
  }

  console.error(
    '❌ No input provided. Use --file <path> or pipe text via stdin.'
  );
  console.error(
    '   Example: node scripts/ingestReferences.mjs --file ./data/notes.txt --category "biology"'
  );
  process.exit(1);
}

// ─── Main Ingestion ─────────────────────────────────────────────────────────

async function main() {
  const { file, category } = parseArgs();

  // 1. Read input
  const text = getInputText(file);
  console.log(`\n📝 Input text length: ${text.length} characters`);
  console.log(`🏷️  Subject category:  ${category}`);

  // 2. Chunk the text
  const chunks = chunkText(text);
  console.log(
    `🔪 Split into ${chunks.length} chunks (~${CHUNK_SIZE} chars, ${CHUNK_OVERLAP} overlap)\n`
  );

  // 3. Connect to MongoDB Atlas
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error(
      '❌ MONGODB_URI not set. Add it to .env.local or set it as an environment variable.'
    );
    process.exit(1);
  }

  console.log('🔗 Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri, { bufferCommands: false });
  console.log('✅ Connected to MongoDB Atlas\n');

  // 4. Initialize the embedding pipeline (downloads model on first run)
  console.log(`🤖 Loading embedding model: ${EMBEDDING_MODEL}`);
  console.log('   (First run will download the model — this may take a minute)\n');
  const embedder = await pipeline('feature-extraction', EMBEDDING_MODEL);
  console.log('✅ Embedding model loaded\n');

  // 5. Process each chunk
  let saved = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const progress = `[${i + 1}/${chunks.length}]`;

    console.log(`${progress} Generating embedding for chunk (${chunk.length} chars)...`);

    // Generate embedding — output is a Tensor, extract the data
    const output = await embedder(chunk, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to a plain JS array compatible with MongoDB storage
    const embedding = Array.from(output.data);

    // Validate embedding dimension
    if (embedding.length !== 384) {
      console.warn(
        `⚠️  ${progress} Unexpected embedding dimension: ${embedding.length} (expected 384). Skipping.`
      );
      continue;
    }

    // Save to MongoDB
    await KnowledgeBase.create({
      textContent: chunk,
      embedding,
      subjectCategory: category,
    });

    saved++;
    console.log(`${progress} ✅ Saved to knowledge_base`);
  }

  // 6. Summary
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Ingestion complete!`);
  console.log(`   Chunks processed: ${chunks.length}`);
  console.log(`   Documents saved:  ${saved}`);
  console.log(`   Category:         ${category}`);
  console.log(`   Collection:       knowledge_base`);
  console.log('═'.repeat(50) + '\n');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
}

main().catch((err) => {
  console.error('❌ Fatal error during ingestion:', err);
  process.exit(1);
});
