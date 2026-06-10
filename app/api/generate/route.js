import { NextResponse } from 'next/server';
import { auth } from '../../../auth.js';
import courseGraph from '../../../lib/langgraph/courseWorkflow.js';
import { ChatGroq } from '@langchain/groq';
import { z } from 'zod';
import mongoose from 'mongoose';
import dbConnect from '../../../lib/db.js';
import Learning from '../../../models/Learning.js';
import Topic from '../../../models/Topic.js';

// Mongoose + HuggingFace transformers require Node runtime
export const runtime = 'nodejs';

// Human-friendly labels for each graph node
const NODE_LABELS = {
  syllabusArchitect: '📐 Syllabus Architect is structuring your course layout',
  contextRetriever: '🔍 Searching local knowledge base for relevant references',
  contentWriter: '✍️ Writing comprehensive module content',
  quizConstructor: '🧠 Generating review flashcards',
  incrementModule: '🔄 Advancing to next module',
};

// Embedding helper for single topic generation
let _embedder = null;
async function getEmbedder() {
  if (!_embedder) {
    const { pipeline } = await import('@huggingface/transformers');
    _embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return _embedder;
}

async function embedText(text) {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// Flashcard schema for assessment generator
const quizSchema = z.object({
  flashcards: z.array(
    z.object({
      front: z.string().describe('The question or concept prompt'),
      back: z.string().describe('The answer or explanation'),
    })
  ).describe('5 flashcard-style quiz items'),
});

export async function POST(request) {
  // ─── 1. Authentication ──────────────────────────────────────────────────
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized. Please log in to generate courses.' },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // ─── 2. Parse request body ──────────────────────────────────────────────
  let topic, targetAudience, learningId;

  try {
    const body = await request.json();
    topic = body.topic;
    targetAudience = body.targetAudience || 'general learners';
    learningId = body.learningId; // If provided, generate a single topic under this learning
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body. Expected JSON with "topic" field.' },
      { status: 400 }
    );
  }

  if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
    return NextResponse.json(
      { error: 'Topic is required and must be at least 3 characters.' },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  // ─── CASE A: Generate Single Topic ──────────────────────────────────────
  if (learningId) {
    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (eventType, data) => {
          const line = JSON.stringify({ type: eventType, ...data }) + '\n';
          controller.enqueue(encoder.encode(line));
        };

        try {
          enqueue('status', {
            message: `⚙️ Initializing single topic generation for "${topic.trim()}"...`,
            stage: 'init',
          });

          await dbConnect();

          // Verify learning exists and belongs to user
          const learning = await Learning.findOne({ _id: learningId, userId });
          if (!learning) {
            enqueue('error', { message: 'Learning module not found or unauthorized' });
            controller.close();
            return;
          }

          // Count topics to determine next orderIndex
          const orderIndex = await Topic.countDocuments({ learningId });

          // Create the topic document
          const topicDoc = await Topic.create({
            learningId,
            title: topic.trim(),
            orderIndex,
            contentMarkdown: '',
            flashcards: [],
          });

          // Stream the syllabus event to let frontend know topic is created
          enqueue('syllabus', {
            learningId,
            singleTopic: true,
            modules: [
              {
                title: topicDoc.title,
                topicId: topicDoc._id.toString(),
                orderIndex,
              }
            ],
            message: `✅ Created topic "${topicDoc.title}"`,
          });

          // Perform vector search context retrieval (graceful fallback)
          let retrievedContext = [];
          enqueue('status', { message: '🔍 Searching knowledge base for context...', stage: 'vector' });
          try {
            const queryVector = await embedText(topicDoc.title);
            const KnowledgeBase =
              mongoose.models.KnowledgeBase ||
              mongoose.model(
                'KnowledgeBase',
                new mongoose.Schema({
                  textContent: String,
                  embedding: [Number],
                  subjectCategory: String,
                })
              );

            const results = await KnowledgeBase.aggregate([
              {
                $vectorSearch: {
                  index: 'vector_index',
                  path: 'embedding',
                  queryVector,
                  numCandidates: 60,
                  limit: 3,
                },
              },
              {
                $project: {
                  _id: 0,
                  textContent: 1,
                  score: { $meta: 'vectorSearchScore' },
                },
              },
            ]);
            retrievedContext = results.map(r => r.textContent || '');
            enqueue('status', { message: `🔍 Found ${retrievedContext.length} reference sources.` });
          } catch (e) {
            console.warn("Vector search failed for single topic:", e.message);
          }

          // Generate Markdown content using Groq
          enqueue('status', { message: '✍️ Writing comprehensive topic content...', stage: 'write' });
          const groqCreative = new ChatGroq({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            apiKey: process.env.GROQ_API_KEY,
          });

          const contextBlock = retrievedContext.length > 0
            ? `\n\n## Reference Material\n${retrievedContext.map((c, i) => `### Source ${i + 1}\n${c}`).join('\n\n')}`
            : '';

          const systemPrompt = `You are a world-class technical educator. Write deeply comprehensive, 
publication-quality course content in Markdown format.

Requirements:
- Use proper heading hierarchy (## for sections, ### for subsections, #### for smaller details)
- Include clean LaTeX equations where relevant, wrapped in $...$ for inline and $$...$$ for display
- Include descriptive, runnable code blocks with language tags where appropriate
- Use clear explanations with real-world analogies
- Write at least 800-1200 words of substantive technical content
- Do NOT include a top-level # heading (the topic title is handled separately)`;

          const userPrompt = `Write comprehensive content for the topic: "${topicDoc.title}"
Target Audience: ${targetAudience}
${contextBlock}`;

          const writerStream = await groqCreative.stream([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]);

          let contentMarkdown = '';
          for await (const chunk of writerStream) {
            const token = chunk.content;
            if (token) {
              contentMarkdown += token;
              enqueue('content_token', {
                token,
                moduleIndex: 0,
              });
            }
          }

          // Save content to DB
          await Topic.findByIdAndUpdate(topicDoc._id, { contentMarkdown });
          enqueue('status', { message: '✅ Saved topic content to database.' });

          // Generate Flashcards
          enqueue('status', { message: '🧠 Generating study flashcards...', stage: 'flashcards' });
          const groqSyllabus = new ChatGroq({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.4,
            apiKey: process.env.GROQ_API_KEY,
          });
          const structuredGroq = groqSyllabus.withStructuredOutput(quizSchema);

          const quizResult = await structuredGroq.invoke([
            {
              role: 'system',
              content: `You are an expert assessment designer. Generate exactly 5 flashcard-style review questions 
that test understanding of the provided course content. Each flashcard should have:
- "front": A clear, specific question or concept prompt
- "back": A concise but complete answer or explanation`
            },
            {
              role: 'user',
              content: `Content:\n${contentMarkdown.slice(0, 6000)}`
            }
          ]);

          // Save flashcards
          await Topic.findByIdAndUpdate(topicDoc._id, {
            flashcards: quizResult.flashcards
          });

          enqueue('status', { message: `✅ Generated ${quizResult.flashcards.length} study cards.` });
          enqueue('complete', { message: '🎉 Topic added successfully!' });
        } catch (err) {
          console.error("Error generating single topic:", err);
          enqueue('error', { message: err.message });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  // ─── CASE B: Generate Full Course (LangGraph Workflow) ────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (eventType, data) => {
        const line = JSON.stringify({ type: eventType, ...data }) + '\n';
        controller.enqueue(encoder.encode(line));
      };

      try {
        enqueue('status', {
          message: `⚙️ Starting course generation for "${topic.trim()}"...`,
          stage: 'init',
        });

        const initialState = {
          topic: topic.trim(),
          targetAudience,
          userId,
          currentModuleIndex: 0,
        };

        const eventStream = courseGraph.streamEvents(initialState, {
          version: 'v2',
        });

        let currentNode = null;
        let moduleIndex = 0;

        for await (const event of eventStream) {
          const { event: eventName, name, data } = event;

          if (eventName === 'on_chain_start' && NODE_LABELS[name]) {
            currentNode = name;

            if (data?.input?.currentModuleIndex !== undefined) {
              moduleIndex = data.input.currentModuleIndex;
            }

            enqueue('node_start', {
              node: name,
              message: `${NODE_LABELS[name]}...`,
              moduleIndex,
            });
          }

          if (eventName === 'on_chain_end' && NODE_LABELS[name]) {
            const output = data?.output || {};

            if (name === 'syllabusArchitect' && output.syllabus) {
              enqueue('syllabus', {
                learningId: output.learningId,
                modules: output.syllabus.map((m) => ({
                  title: m.title,
                  topicId: m.topicId,
                  orderIndex: m.orderIndex,
                })),
                message: `✅ Created ${output.syllabus.length} modules`,
              });
            }

            if (name === 'quizConstructor') {
              enqueue('node_end', {
                node: name,
                message: `✅ Module ${moduleIndex} complete`,
                moduleIndex,
              });
            } else {
              enqueue('node_end', {
                node: name,
                message: `✅ ${name} finished`,
              });
            }

            currentNode = null;
          }

          if (eventName === 'on_chat_model_stream' && currentNode === 'contentWriter') {
            const chunk = data?.chunk;
            if (chunk?.content) {
              enqueue('content_token', {
                token: chunk.content,
                moduleIndex,
              });
            }
          }

          if (eventName === 'on_chat_model_start') {
            if (currentNode === 'syllabusArchitect') {
              enqueue('status', {
                message: '🤖 AI is designing your course structure...',
                stage: 'llm_syllabus',
              });
            } else if (currentNode === 'contentWriter') {
              enqueue('status', {
                message: `🤖 AI is writing content for module ${moduleIndex}...`,
                stage: 'llm_content',
                moduleIndex,
              });
            } else if (currentNode === 'quizConstructor') {
              enqueue('status', {
                message: `🤖 AI is creating flashcards for module ${moduleIndex}...`,
                stage: 'llm_quiz',
                moduleIndex,
              });
            }
          }

          if (
            eventName === 'on_chain_start' &&
            name === 'contextRetriever'
          ) {
            enqueue('status', {
              message: `🔍 Vector searching local knowledge base for module ${moduleIndex}...`,
              stage: 'vector_search',
              moduleIndex,
            });
          }

          if (eventName === 'on_chain_end' && name === 'incrementModule') {
            moduleIndex = (data?.output?.currentModuleIndex) ?? moduleIndex + 1;
            enqueue('status', {
              message: `🔄 Moving to module ${moduleIndex}...`,
              stage: 'increment',
              moduleIndex,
            });
          }
        }

        enqueue('complete', {
          message: '🏁 Course generation complete!',
        });
      } catch (err) {
        console.error('[generate] Workflow error:', err);

        enqueue('error', {
          message: `❌ Generation failed: ${err.message}`,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
