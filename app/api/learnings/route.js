import { NextResponse } from 'next/server';
import { auth } from '../../../auth.js';
import dbConnect from '../../../lib/db.js';
import Learning from '../../../models/Learning.js';
import Topic from '../../../models/Topic.js';

export const runtime = 'nodejs';

// GET /api/learnings - Fetch all learnings and topics for the current user
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  try {
    await dbConnect();

    // Fetch all learnings belonging to the user
    const learnings = await Learning.find({ userId }).sort({ createdAt: -1 });

    // For each learning, fetch its topics sorted by orderIndex
    const populatedLearnings = await Promise.all(
      learnings.map(async (learning) => {
        const topics = await Topic.find({ learningId: learning._id }).sort({
          orderIndex: 1,
        });
        return {
          id: learning._id.toString(),
          name: learning.title,
          isExpanded: false, // UI state
          topics: topics.map((t) => ({
            id: t._id.toString(),
            name: t.title,
            orderIndex: t.orderIndex,
            contentMarkdown: t.contentMarkdown,
            flashcards: t.flashcards || [],
          })),
        };
      })
    );

    return NextResponse.json(populatedLearnings);
  } catch (error) {
    console.error('Error fetching learnings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learnings' },
      { status: 500 }
    );
  }
}

// DELETE /api/learnings?id=... - Delete learning and all its topics
export async function DELETE(request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const learningId = searchParams.get('id');

  if (!learningId) {
    return NextResponse.json(
      { error: 'Missing learning ID' },
      { status: 400 }
    );
  }

  try {
    await dbConnect();

    // Verify learning belongs to user
    const learning = await Learning.findOne({ _id: learningId, userId: session.user.id });

    if (!learning) {
      return NextResponse.json(
        { error: 'Learning not found or unauthorized' },
        { status: 404 }
      );
    }

    // Delete all topics associated with this learning
    await Topic.deleteMany({ learningId });

    // Delete the learning itself
    await Learning.deleteOne({ _id: learningId });

    return NextResponse.json({ success: true, message: 'Learning and associated topics deleted successfully' });
  } catch (error) {
    console.error('Error deleting learning:', error);
    return NextResponse.json(
      { error: 'Failed to delete learning' },
      { status: 500 }
    );
  }
}
