import { NextResponse } from 'next/server';
import { auth } from '../../../auth.js';
import { ChatGroq } from '@langchain/groq';
import dbConnect from '../../../lib/db.js';
import Topic from '../../../models/Topic.js';
import Learning from '../../../models/Learning.js';
import { embedText } from '../../../lib/embeddings.js';
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

  let topicId, message, history;
  try {
    const body = await request.json();
    topicId = body.topicId;
    message = body.message;
    history = body.history || [];
  } catch {
    return NextResponse.json(
      { error: 'Invalid request payload' },
      { status: 400 }
    );
  }

  if (!topicId || !message) {
    return NextResponse.json(
      { error: 'topicId and message are required' },
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

    // 2. Fetch learning module context
    const learning = await Learning.findById(topic.learningId);
    const learningTitle = learning ? learning.title : 'General';

    // 3. Retrieve context chunks from RAG store
    let contextChunks = [];
    try {
      contextChunks = await KnowledgeBase.find({ topicId }).limit(4);
    } catch (err) {
      console.warn("Could not find topic chunks by topicId:", err.message);
    }

    // Fallback to vector search if no chunks are matched directly
    if (contextChunks.length === 0) {
      try {
        const queryVector = await embedText(message);
        contextChunks = await KnowledgeBase.aggregate([
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
              textContent: 1,
              subjectCategory: 1,
              score: { $meta: 'vectorSearchScore' },
            },
          },
        ]);
      } catch (err) {
        console.warn("RAG vector search in chat route failed:", err.message);
      }
    }

    const contextText = contextChunks.map((c) => c.textContent).join('\n\n');
    const finalContext = contextText || topic.contentMarkdown || 'No course content has been generated yet for this topic.';

    // 4. Initialize Groq model
    const groq = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      apiKey: process.env.GROQ_API_KEY,
    });

    // 5. Build message list
    const systemPrompt = `You are a helpful AI learning assistant for the zLearner course platform.
The user is studying a topic called "${topic.title}" within the course module "${learningTitle}".

Here is the relevant course context retrieved from the database to help answer the user's question:
---
${finalContext}
---

Your task:
- Answer the user's question clearly, constructively, and in detail based on the course content context above.
- You MUST generate your response in Markdown format.
- Use proper markdown heading hierarchy (### for sections, #### for subsections).
- Your markdown headings will be rendered in blue color, and the body text in grey, so construct clear sections using headings to make the structure visually premium.
- Answer in the same language as the user's question.`;

    // Optimize history length by slicing to last 6 messages
    const chatHistoryWindow = (history || []).slice(-6);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistoryWindow.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
      })),
      { role: 'user', content: message },
    ];

    console.log(`🤖 Chat request for topic "${topic.title}": "${message.slice(0, 50)}..."`);
    const response = await groq.invoke(messages);
    const replyText = response.content;

    return NextResponse.json({
      id: `m_ai_${Date.now()}`,
      sender: 'ai',
      text: replyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to generate chat response: ' + error.message },
      { status: 500 }
    );
  }
}
