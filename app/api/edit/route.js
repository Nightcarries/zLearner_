import { NextResponse } from 'next/server';
import { auth } from '../../../auth.js';
import { ChatGroq } from '@langchain/groq';
import dbConnect from '../../../lib/db.js';
import Topic from '../../../models/Topic.js';
import Learning from '../../../models/Learning.js';
import { embedText, chunkText } from '../../../lib/embeddings.js';
import { KnowledgeBase } from '../../../models/index.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let topicId, instruction;
  try {
    const body = await request.json();
    topicId = body.topicId;
    instruction = body.instruction;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!topicId || !instruction) {
    return NextResponse.json(
      { error: 'topicId and instruction are required' },
      { status: 400 }
    );
  }

  try {
    await dbConnect();

    // Verify ownership of the parent learning
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    const learning = await Learning.findOne({
      _id: topic.learningId,
      userId: session.user.id,
    });

    if (!learning) {
      return NextResponse.json(
        { error: 'Unauthorized to edit this topic' },
        { status: 403 }
      );
    }

    const groq = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      apiKey: process.env.GROQ_API_KEY,
    });

    const systemPrompt = `You are a world-class technical educator and editor.
Your task is to edit/update the current course topic content in Markdown format based on the user's instructions (e.g. expand a section, add new content, rewrite or clarify concepts, add examples, etc.).

Requirements:
- You MUST output the ENTIRE updated content in Markdown format.
- Output ONLY the markdown content. Do NOT include any chat dialogue, introductions, or conversational preambles (like "Here is the updated content...").
- Keep proper markdown heading hierarchy (## for sections, ### for subsections, #### for smaller details).
- Maintain existing content structure unless asked to restructure.
- Use LaTeX equations ($...$ inline, $$...$$ display) where appropriate.

Current Content:
---
${topic.contentMarkdown || '(Empty content)'}
---`;

    const userPrompt = `Please edit the content based on this instruction:
"${instruction}"`;

    console.log(`🤖 Editing topic "${topic.title}" (${topicId}) with instruction: "${instruction.slice(0, 50)}..."`);

    // Stream from Groq using .stream()
    const eventStream = await groq.stream([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    const encoder = new TextEncoder();
    let completeMarkdown = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of eventStream) {
            const token = chunk.content;
            if (token) {
              completeMarkdown += token;
              controller.enqueue(encoder.encode(token));
            }
          }

          // Save complete markdown to DB at the end of the stream
          await Topic.findByIdAndUpdate(topicId, {
            contentMarkdown: completeMarkdown
          });
          console.log(`✅ Saved edited content (${completeMarkdown.length} chars) to topic ${topicId}`);

          // Ingest edited chunks to RAG
          try {
            await KnowledgeBase.deleteMany({ topicId });
            const chunks = chunkText(completeMarkdown, 1000, 200);
            for (const chunk of chunks) {
              const embedding = await embedText(chunk);
              await KnowledgeBase.create({
                textContent: chunk,
                embedding,
                subjectCategory: learning ? learning.title : 'edited',
                topicId,
              });
            }
            console.log(`✅ Ingested ${chunks.length} edited chunks to RAG for topic ${topicId}`);
          } catch (ragErr) {
            console.error("Failed to ingest edited topic to RAG:", ragErr);
          }
        } catch (err) {
          console.error("Stream error in edit API:", err);
          controller.error(err);
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
  } catch (error) {
    console.error("Error in edit API:", error);
    return NextResponse.json(
      { error: 'Failed to initiate content edit: ' + error.message },
      { status: 500 }
    );
  }
}
