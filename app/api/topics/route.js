import { NextResponse } from 'next/server';
import { auth } from '../../../auth.js';
import dbConnect from '../../../lib/db.js';
import Learning from '../../../models/Learning.js';
import Topic from '../../../models/Topic.js';

export const runtime = 'nodejs';

// DELETE /api/topics?id=... - Delete a single topic
export async function DELETE(request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get('id');

  if (!topicId) {
    return NextResponse.json(
      { error: 'Missing topic ID' },
      { status: 400 }
    );
  }

  try {
    await dbConnect();

    // Find the topic first
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    // Verify parent learning belongs to current user
    const learning = await Learning.findOne({
      _id: topic.learningId,
      userId: session.user.id,
    });

    if (!learning) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this topic' },
        { status: 403 }
      );
    }

    // Delete the topic
    await Topic.deleteOne({ _id: topicId });

    return NextResponse.json({ success: true, message: 'Topic deleted successfully' });
  } catch (error) {
    console.error('Error deleting topic:', error);
    return NextResponse.json(
      { error: 'Failed to delete topic' },
      { status: 500 }
    );
  }
}
