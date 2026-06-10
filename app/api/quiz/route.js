import { NextResponse } from 'next/server';
import { auth } from '../../../auth.js';
import { ChatGroq } from '@langchain/groq';
import { z } from 'zod';
import dbConnect from '../../../lib/db.js';
import Topic from '../../../models/Topic.js';
import { KnowledgeBase } from '../../../models/index.js';
import { embedText } from '../../../lib/embeddings.js';

export const runtime = 'nodejs';

const quizSchema = z.object({
  questions: z.array(
    z.object({
      questionText: z.string().describe('The multiple-choice question text based strictly on the context provided'),
      options: z.array(z.string()).describe('Exactly 4 distinct plausible options'),
      correctAnswer: z.string().describe('The correct option from the options list (must exactly match one of the options)')
    })
  ).length(4).describe('Exactly 4 multiple choice questions based on the reference context')
});

export async function POST(request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let topicId;
  try {
    const body = await request.json();
    topicId = body.topicId;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!topicId) {
    return NextResponse.json(
      { error: 'topicId is required' },
      { status: 400 }
    );
  }

  try {
    await dbConnect();

    // 1. Fetch topic content
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    // 2. Retrieve chunks from RAG KnowledgeBase
    let contextChunks = [];
    try {
      contextChunks = await KnowledgeBase.find({ topicId }).limit(5);
    } catch (err) {
      console.warn("Could not find topic chunks by topicId:", err.message);
    }

    // Fallback to vector search if no chunks found directly
    if (contextChunks.length === 0) {
      try {
        const queryVector = await embedText(topic.title);
        contextChunks = await KnowledgeBase.aggregate([
          {
            $vectorSearch: {
              index: 'vector_index',
              path: 'embedding',
              queryVector,
              numCandidates: 60,
              limit: 4,
            },
          },
          {
            $project: {
              textContent: 1,
              subjectCategory: 1,
              score: { $meta: 'vectorSearchScore' },
            },
          },
        ]);
      } catch (err) {
        console.warn("RAG vector search in quiz route failed:", err.message);
      }
    }

    const contextText = contextChunks.map((c) => c.textContent).join('\n\n');
    const finalContext = contextText || topic.contentMarkdown || 'Reference topic content is empty.';

    // 3. Initialize Groq model with structured output
    const groq = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      apiKey: process.env.GROQ_API_KEY,
    });

    const structuredModel = groq.withStructuredOutput(quizSchema, { name: 'quizGenerator' });

    const systemPrompt = `You are a world-class assessment creator. Your job is to create a multiple-choice quiz of exactly 4 questions based strictly on the provided reference material.
Each question must have exactly 4 plausible options, and one correct answer that must exactly match one of the options.
Do not reference other facts outside of the provided text. Make the questions technically rigorous but fair.`;

    const userPrompt = `Generate a 4-question quiz based on this reference material:
---
${finalContext}
---`;

    console.log(`🤖 Generating quiz for topic "${topic.title}" (${topicId}) using RAG context...`);
    const result = await structuredModel.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in quiz API:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz: ' + error.message },
      { status: 500 }
    );
  }
}
